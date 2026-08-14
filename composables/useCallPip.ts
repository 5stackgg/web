import { ref, computed, watch, onScopeDispose } from "vue";
import { useVoiceVideoPrefs } from "~/composables/useVoiceVideoPrefs";
import type { VoiceParticipant } from "~/composables/useVoiceApi";

// Real Picture-in-Picture for a multi-party call.
//
// The browser will only ever hand PiP a single <video>, so the call is
// composited onto a canvas first and that canvas' captured stream is what gets
// handed over. This is the same trick every video-call app uses, and it is what
// buys the things a document-PiP window cannot do: it leaves the browser
// entirely, moves to another display, resizes, and stays above full-screen
// apps -- the same window the live streams already use.
//
// Avatars are drawn as initials rather than images on purpose. A remote avatar
// painted into the canvas taints it, and a tainted canvas cannot be captured at
// all -- captureStream throws SecurityError and the whole feature dies for the
// sake of a 40px picture.

// Enough to read a face in a small floating window; more is bandwidth spent on
// a surface a few hundred pixels wide.
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;
const FPS = 15;

export type CallPipSource = {
  participants: () => Array<VoiceParticipant>;
  peerVideo: () => Map<string, MediaStream>;
  localVideo: () => MediaStream | null;
  mySteamId: () => string | null;
  selfMuted: () => boolean;
  // Whether the call is actually on screen. Not the same as the tab being
  // visible: closing the hub hides the grid while the page stays in front of
  // you, and that is the most common way to stop being able to see the call.
  onScreen?: () => boolean;
  // Which call this is. A dismissal belongs to one call, not to the player.
  channelId?: () => string | null;
  // Whether anyone has a camera on. A floating window of avatars is noise; the
  // point of following you is the video.
  hasVideo?: () => boolean;
};

// One host, module scope. Every panel used to build its own, which meant two
// canvases compositing the same call and two things deciding whether to open a
// window. The host is set up once by VoiceHost; every control just drives it.
const active = ref(false);

// Closed by hand: stop offering it for the rest of this call. Without this a
// window you dismissed reappears the next time you change page, which is worse
// than never having offered it.
const dismissed = ref(false);

// Set while *we* are the ones exiting, so the close handler can tell an exit we
// asked for from the player closing the window themselves.
let exiting = false;

// Firefox and Safari report pictureInPictureEnabled false, and there the
// pop-out button used to be a control that did nothing at all. When this is set
// the call floats in an in-page panel instead -- less capable, but not nothing,
// which is what it was.
const floating = ref(false);

export function useCallPip() {
  return {
    // There is always *a* way to pop the call out now, so this stays true and
    // the surfaces stop having to care which one they get.
    supported: true,
    floating: computed(() => floating.value),
    active: computed(() => active.value),
    enter: () => enterPip(),
    exit: () => exitPip(),
    toggle: () => togglePip(),
  };
}

let enterPip: () => Promise<boolean> = async () => false;
let exitPip: () => Promise<void> = async () => {};
let togglePip: () => Promise<unknown> = async () => {};

export function useCallPipHost(source: CallPipSource) {
  // The canvas composites the call itself rather than reusing the rendered
  // tiles, so it has to honour the same choices they do -- otherwise a camera
  // you hid, or your own view you never asked for, reappears the moment the
  // call pops out.
  const videoPrefs = useVoiceVideoPrefs();

  const supported =
    typeof document !== "undefined" && document.pictureInPictureEnabled;

  let canvas: HTMLCanvasElement | null = null;
  let video: HTMLVideoElement | null = null;
  let stream: MediaStream | null = null;
  let frame: number | null = null;
  let lastDraw = 0;

  // One offscreen <video> per peer: a MediaStream cannot be drawn to a canvas
  // directly, it has to be playing in an element first. Kept across frames so
  // the decode is not restarted sixteen times a second.
  const feeds = new Map<string, HTMLVideoElement>();

  function feedFor(key: string, media: MediaStream) {
    let el = feeds.get(key);

    if (!el) {
      el = document.createElement("video");
      el.muted = true;
      el.playsInline = true;
      el.autoplay = true;
      feeds.set(key, el);
    }

    if (el.srcObject !== media) {
      el.srcObject = media;
      void el.play().catch(() => {});
    }

    return el;
  }

  function layout(count: number) {
    if (count <= 1) {
      return { cols: 1, rows: 1 };
    }

    if (count <= 2) {
      return { cols: 2, rows: 1 };
    }

    if (count <= 4) {
      return { cols: 2, rows: 2 };
    }

    return { cols: 3, rows: 2 };
  }

  function initials(name: string | null) {
    return (name ?? "?").trim().slice(0, 2).toUpperCase();
  }

  // Cover, not contain: a letterboxed face in an already-small tile wastes the
  // few pixels there are.
  function drawCover(
    context: CanvasRenderingContext2D,
    el: HTMLVideoElement,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const vw = el.videoWidth;
    const vh = el.videoHeight;

    if (!vw || !vh) {
      return false;
    }

    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;

    context.save();
    context.beginPath();
    context.rect(x, y, w, h);
    context.clip();
    context.drawImage(el, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    context.restore();

    return true;
  }

  function draw() {
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const me = source.mySteamId();

    // Yourself only if you asked for it. Suppressing just your *video* left a
    // tile with your name and initials in it, which is still a slot in a small
    // window spent on the one person you do not need to look at -- and reads as
    // the preference having been ignored, because from the outside it was.
    const showSelf = videoPrefs.prefs.value.showSelf;

    const members = source
      .participants()
      .filter((participant) => participant.connected || participant.video)
      .filter(
        (participant) =>
          showSelf || !me || participant.steamId !== me,
      );

    context.fillStyle = "#09090b";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (members.length === 0) {
      return;
    }

    const { cols, rows } = layout(members.length);
    const gap = 6;
    const cellW = (CANVAS_WIDTH - gap * (cols + 1)) / cols;
    const cellH = (CANVAS_HEIGHT - gap * (rows + 1)) / rows;

    members.slice(0, cols * rows).forEach((participant, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = gap + col * (cellW + gap);
      const y = gap + row * (cellH + gap);

      const isMe = !!me && participant.steamId === me;
      const media = isMe
        ? source.localVideo()
        : videoPrefs.isHidden(participant.steamId)
          ? null
          : (source.peerVideo().get(participant.steamId) ?? null);

      context.fillStyle = "#18181b";
      context.fillRect(x, y, cellW, cellH);

      const painted = media
        ? drawCover(context, feedFor(participant.steamId, media), x, y, cellW, cellH)
        : false;

      if (!painted) {
        context.fillStyle = "#3f3f46";
        context.font = "600 22px ui-monospace, monospace";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(
          initials(participant.name),
          x + cellW / 2,
          y + cellH / 2,
        );
      }

      // Name plate, and the one piece of state that matters at this size:
      // whether their microphone is actually open.
      const micOff = isMe ? source.selfMuted() : !participant.connected;

      context.fillStyle = "rgba(0,0,0,0.65)";
      context.fillRect(x, y + cellH - 20, cellW, 20);

      context.font = "500 12px ui-sans-serif, system-ui, sans-serif";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillStyle = micOff ? "#a1a1aa" : "#ffffff";

      const label = `${micOff ? "🔇 " : ""}${isMe ? "You" : (participant.name ?? participant.steamId)}`;
      context.fillText(label, x + 6, y + cellH - 10, cellW - 12);

      if (participant.speaking && !micOff) {
        context.strokeStyle = "#34d399";
        context.lineWidth = 2;
        context.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
      }
    });
  }

  function pump(now: number) {
    frame = requestAnimationFrame(pump);

    if (now - lastDraw < 1000 / FPS) {
      return;
    }

    lastDraw = now;
    draw();
  }

  function ensureCanvas() {
    if (canvas && video && stream) {
      return video;
    }

    canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Drawn once before capture so the stream starts with a real frame rather
    // than a blank one, which some engines show for a beat on entering PiP.
    draw();

    stream = canvas.captureStream(FPS);

    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    video.addEventListener("leavepictureinpicture", () => {
      active.value = false;
      stopDrawing();

      // Closed by the player rather than by us: take the hint for the rest of
      // this call.
      if (!exiting) {
        dismissed.value = true;
      }

      exiting = false;
    });

    return video;
  }

  // Ready to be handed over the instant it is asked for.
  //
  // requestPictureInPicture has two preconditions that fight each other on the
  // path that matters. It needs a <video> that already has metadata, and it
  // needs the click that led here to still be fresh -- and building the canvas,
  // capturing it and waiting for the first frame at that moment spends the
  // click on media startup, so the request lands after the activation window
  // has closed and throws NotAllowedError. That is invisible: it looks exactly
  // like the feature simply not firing.
  //
  // So the pipeline is built as soon as the call has a camera on it. Drawing
  // stops again once there is a frame -- readyState does not fall back, so the
  // element stays eligible while costing nothing until it is needed.
  let primed = false;

  async function prewarm() {
    if (!supported || primed) {
      return;
    }


    primed = true;

    try {
      const el = ensureCanvas();

      startDrawing();

      await el.play();

      if (el.readyState < 1) {
        await new Promise<void>((resolve) => {
          el.addEventListener("loadedmetadata", () => resolve(), { once: true });
          setTimeout(resolve, 2000);
        });
      }
    } catch {
      // Priming is an optimisation; enter() still has the slow path.
      primed = false;
    } finally {
      if (!active.value) {
        stopDrawing();
      }
    }
  }

  function startDrawing() {
    if (frame === null) {
      frame = requestAnimationFrame(pump);
    }
  }

  function stopDrawing() {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  }

  async function enter() {
    if (active.value) {
      return false;
    }

    // No native window here. The in-page panel needs no gesture and cannot be
    // refused, so it is set directly rather than attempted.
    if (!supported) {
      floating.value = true;
      active.value = true;

      return true;
    }

    try {
      const el = ensureCanvas();

      startDrawing();

      // Only when priming has not already done it. Every await here burns into
      // the user-activation window that the request below depends on.
      if (el.readyState < 1 || el.paused) {
        await el.play();
      }

      await el.requestPictureInPicture();

      active.value = true;

      return true;
    } catch (error) {
      stopDrawing();

      // Not thrown to the caller -- a floating window failing to appear must
      // never break the call underneath it. But it is logged, because the
      // usual cause (NotAllowedError: no transient user activation) is
      // indistinguishable from the feature being switched off if it is
      // swallowed, which is exactly how this went unexplained.
      console.warn("[voice] picture-in-picture refused", error);

      return false;
    }
  }

  async function exit() {
    if (!active.value) {
      return;
    }

    if (floating.value) {
      floating.value = false;
      active.value = false;

      return;
    }

    exiting = true;

    try {
      await document.exitPictureInPicture();
    } catch {
      // Already gone.
      exiting = false;
    }

    active.value = false;
    stopDrawing();
  }

  function toggle() {
    if (active.value) {
      dismissed.value = true;
      disarm();
      return exit();
    }

    // Asking for it back is the clearest possible signal they want it.
    dismissed.value = false;
    return enter();
  }

  // Can you currently see the call? Closing the hub and switching tabs are the
  // same question wearing different clothes.
  function visible() {
    if (typeof document !== "undefined" && document.hidden) {
      return false;
    }

    return source.onScreen?.() ?? true;
  }

  // Auto-enter the way a call app should: when the call goes off screen, it
  // follows you. Only while somebody actually has a camera on -- a floating
  // window of avatars is noise, and there is a participant list for that.
  //
  // Deliberately not "somebody started video, so everyone gets a window": a
  // window nobody asked for, appearing over whatever they were doing, is the
  // thing people disable the feature over. Following *your* attention is
  // consented to by the act of looking away; interrupting is not.
  function sync() {
    if (visible()) {
      disarm();

      if (active.value) {
        void exit();
      }

      return;
    }

    if (!active.value && !dismissed.value && (source.hasVideo?.() ?? false)) {
      void enter().then((entered) => {
        if (!entered) {
          armRetry();
        }
      });
    }
  }

  // Some ways of leaving a page carry no user gesture at all -- the back and
  // forward buttons are the common ones, and the browser refuses
  // Picture-in-Picture without one. Nothing we can do makes that call succeed.
  //
  // What we can do is not give up silently. Arm the next real interaction
  // anywhere on the page to retry, so the window arrives on the player's next
  // click instead of never. Still their gesture, still their choice -- it just
  // stops the back button being the one route that quietly breaks the feature.
  let armed: (() => void) | null = null;

  function disarm() {
    armed?.();
    armed = null;
  }

  function armRetry() {
    if (armed) {
      return;
    }

    const attempt = () => {
      disarm();

      // Everything may have changed between the failure and this click.
      if (active.value || dismissed.value || visible()) {
        return;
      }

      if (source.hasVideo?.() ?? false) {
        void enter();
      }
    };

    document.addEventListener("pointerdown", attempt, { once: true });
    document.addEventListener("keydown", attempt, { once: true });

    armed = () => {
      document.removeEventListener("pointerdown", attempt);
      document.removeEventListener("keydown", attempt);
    };
  }

  function onVisibility() {
    sync();
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  // Closing the hub is a click, which is the gesture the browser wants before
  // it will hand over Picture-in-Picture -- so this is the one moment auto-enter
  // reliably works without the player having opened it manually first.
  if (source.onScreen) {
    watch(() => source.onScreen!(), sync);
  }

  // The moment a camera comes on is the last quiet moment before the window
  // might be wanted, and it is nowhere near a user gesture -- which is what
  // makes it the right place to pay the setup cost.
  watch(
    () => source.hasVideo?.() ?? false,
    (has) => {
      if (has) {
        void prewarm();
      }
    },
    { immediate: true },
  );

  // A new call is a new decision. Leaving and rejoining, or switching channel,
  // clears a dismissal that was about the old one.
  watch(
    () => source.channelId?.() ?? null,
    () => {
      dismissed.value = false;
    },
  );

  onScopeDispose(() => {
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }

    disarm();
    floating.value = false;
    void exit();
    stopDrawing();

    for (const el of feeds.values()) {
      el.srcObject = null;
    }

    feeds.clear();

    for (const track of stream?.getTracks() ?? []) {
      track.stop();
    }

    stream = null;
    canvas = null;
    video = null;
  });

  enterPip = enter;
  exitPip = exit;
  togglePip = toggle;

  return { supported, active, enter, exit, toggle };
}
