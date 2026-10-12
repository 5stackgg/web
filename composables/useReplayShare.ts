import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "~/components/ui/toast";
import type { CameraModule } from "~/utilities/replayStage/camera";
import {
  CLIP_FONT,
  createClipRecorder,
  downloadBlob,
  pickClipFormat,
} from "~/utilities/replayStage/clip";
import type { ClipCaption, ClipRecorder } from "~/utilities/replayStage/clip";
import type { MapLevel } from "~/utilities/replayStage/mapLevels";
import {
  decodeMoment,
  encodeMoment,
  locateTick,
} from "~/utilities/replayStage/moment";
import type { ReplayMoment } from "~/utilities/replayStage/moment";
import type { Stage } from "~/utilities/replayStage/stage";

type StageHandle = {
  stage: Stage | null;
  camera: CameraModule | null;
  whenReady(fn: () => void): void;
};

export type ReplayShareOptions = {
  stage: () => StageHandle | null | undefined;
  /** The stage is what is on screen (not the old board or the buy overlay). */
  stageActive: () => boolean;
  rounds: () => number[];
  round: Ref<number | null>;
  /** The active round's sample ticks. */
  ticks: () => number[];
  tickIndex: Ref<number>;
  fractional: Ref<number>;
  /** The tick on screen, between samples. */
  tick: () => number;
  tickRate: () => number;
  /** Where the active round goes live (freeze time over), when known. */
  liveStart: () => number | null;
  playing: () => boolean;
  play(): void;
  pause(): void;
  speed: Ref<number>;
  view: Ref<"2d" | "3d">;
  level: () => string | null;
  levels: () => MapLevel[];
  pickLevel(id: string): void;
  follow: Ref<string | null>;
  caption: () => Omit<ClipCaption, "round"> & { round: number };
  mapName: () => string | null;
};

export type ClipRangeKind = "round" | "last" | "marks";

type ClipRange = { round: number; start: number; end: number };

type ExportSession = {
  recorder: ClipRecorder;
  extension: string;
  range: ClipRange;
  speed: number;
  started: boolean;
  hidden: boolean;
  /** Playing when the tab was hidden, so showing it again plays on. */
  resumeOnShow: boolean;
  off: () => void;
};

const LAST_SECONDS = 10;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function formatClipTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Share links to a moment (round, tick, view, storey, followed player and
 * camera, in the URL hash) and clip export of the replay stage.
 */
export function useReplayShare(o: ReplayShareOptions) {
  const { t } = useI18n();
  const format = import.meta.client ? pickClipFormat() : null;

  // ── Moments ──────────────────────────────────────────────────────
  const incoming = import.meta.client
    ? decodeMoment(window.location.hash)
    : null;
  if (incoming?.view) {
    o.view.value = incoming.view;
  }

  async function seek(round: number, tick: number) {
    if (o.round.value !== round) {
      o.round.value = round;
      // The viewer resets to the round's live start when it changes.
      await nextTick();
    }
    const { index, fraction } = locateTick(o.ticks(), tick);
    o.tickIndex.value = index;
    o.fractional.value = fraction;
  }

  async function applyMoment(moment: ReplayMoment) {
    // The viewer picks its first round (and skips its freeze time) as the
    // data lands; land after that.
    await nextTick();
    await wait(0);
    if (o.rounds().includes(moment.round)) {
      await seek(moment.round, moment.tick);
    }
    const handle = o.stage();
    const place = () => {
      if (moment.camera) {
        handle?.camera?.place(moment.camera.eye, moment.camera.target);
      }
      if (moment.follow) {
        o.follow.value = moment.follow;
      } else if (
        moment.level &&
        o.levels().some((level) => level.id === moment.level)
      ) {
        o.pickLevel(moment.level);
      }
    };
    if (handle && o.stageActive()) {
      handle.whenReady(place);
    } else {
      place();
    }
  }

  function currentMoment(): ReplayMoment | null {
    const round = o.round.value;
    if (round === null) {
      return null;
    }
    const camera = o.stageActive() ? o.stage()?.camera?.pose() : null;
    return {
      round,
      tick: o.tick(),
      view: o.view.value,
      level: (o.levels().length && o.level()) || undefined,
      follow: o.follow.value ?? undefined,
      camera: camera ?? undefined,
    };
  }

  function momentLink() {
    const moment = currentMoment();
    if (!moment || !import.meta.client) {
      return null;
    }
    const { origin, pathname, search } = window.location;
    return `${origin}${pathname}${search}#${encodeMoment(moment)}`;
  }

  const copied = ref(false);
  let copiedTimer: ReturnType<typeof setTimeout> | null = null;
  async function copyLink() {
    const link = momentLink();
    if (!link) {
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      toast({
        title: t("match.replay.share.copy_failed"),
        variant: "destructive",
      });
      return;
    }
    toast({ title: t("match.replay.share.link_copied") });
    copied.value = true;
    if (copiedTimer) {
      clearTimeout(copiedTimer);
    }
    copiedTimer = setTimeout(() => (copied.value = false), 1600);
  }

  // ── Marks ────────────────────────────────────────────────────────
  const marks = reactive({
    round: null as number | null,
    in: null as number | null,
    out: null as number | null,
  });

  function setMark(which: "in" | "out") {
    const round = o.round.value;
    if (round === null) {
      return;
    }
    if (marks.round !== round) {
      marks.round = round;
      marks.in = null;
      marks.out = null;
    }
    const tick = Math.round(o.tick());
    marks[which] = tick;
    if (marks.in !== null && marks.out !== null && marks.out <= marks.in) {
      marks[which === "in" ? "out" : "in"] = null;
    }
  }

  /** Seconds into the round on screen, null when unset or on another round. */
  function markSeconds(which: "in" | "out") {
    const tick = marks[which];
    if (tick === null || marks.round !== o.round.value) {
      return null;
    }
    return (tick - (o.ticks()[0] ?? 0)) / o.tickRate();
  }

  function clearMarks() {
    marks.round = marks.in = marks.out = null;
  }

  /** The marks as shares of the seek bar, while their round is on screen. */
  const chromeMarks = computed(() => {
    if (!format) {
      return undefined;
    }
    const ticks = o.ticks();
    const first = ticks[0] ?? 0;
    const span = (ticks[ticks.length - 1] ?? 0) - first;
    const frac = (tick: number | null) =>
      tick === null || span <= 0 || marks.round !== o.round.value
        ? null
        : Math.max(0, Math.min(1, (tick - first) / span));
    return { in: frac(marks.in), out: frac(marks.out) };
  });

  function rangeFor(kind: ClipRangeKind): ClipRange | null {
    const round = o.round.value;
    const ticks = o.ticks();
    if (round === null || ticks.length < 2) {
      return null;
    }
    const first = ticks[0];
    const last = ticks[ticks.length - 1];
    const rate = o.tickRate();
    let range: ClipRange;
    if (kind === "round") {
      const live = o.liveStart();
      const start = live !== null && live > first && live < last ? live : first;
      range = { round, start, end: last };
    } else if (kind === "last") {
      const end = Math.min(last, o.tick());
      range = { round, start: Math.max(first, end - LAST_SECONDS * rate), end };
    } else {
      if (marks.round !== round || marks.in === null || marks.out === null) {
        return null;
      }
      range = { round, start: marks.in, end: marks.out };
    }
    return range.end - range.start >= rate * 0.5 ? range : null;
  }

  const rangeSeconds = (kind: ClipRangeKind) => {
    const range = rangeFor(kind);
    return range ? (range.end - range.start) / o.tickRate() : null;
  };

  // ── Export ───────────────────────────────────────────────────────
  const canExport = computed(() => !!format && o.stageActive());
  const exporting = ref(false);
  const exportHidden = ref(false);
  const exportElapsed = ref(0);
  const exportLength = ref(0);
  let session: ExportSession | null = null;

  function captionNow(): ClipCaption {
    const caption = o.caption();
    return {
      ...caption,
      round: t("match.replay.share.caption_round", { round: caption.round }),
    };
  }

  async function fontsReady() {
    try {
      await Promise.race([
        document.fonts?.load(`700 20px ${CLIP_FONT}`),
        wait(1500),
      ]);
    } catch {
      // The caption falls back to the system font.
    }
  }

  async function begin(s: ExportSession) {
    s.started = true;
    await s.recorder.start();
    if (session !== s) {
      return;
    }
    o.speed.value = 1;
    if (s.hidden) {
      s.resumeOnShow = true;
    } else {
      o.play();
    }
  }

  function onFrame() {
    const s = session;
    if (!s || !s.started || s.hidden || !o.playing()) {
      return;
    }
    const tick = o.tick();
    if (o.round.value !== s.range.round || tick >= s.range.end) {
      void finish();
      return;
    }
    s.recorder.capture();
    exportElapsed.value = Math.max(0, (tick - s.range.start) / o.tickRate());
  }

  function end(s: ExportSession) {
    session = null;
    s.off();
    o.pause();
    o.speed.value = s.speed;
    exporting.value = false;
    exportHidden.value = false;
  }

  async function finish() {
    const s = session;
    if (!s) {
      return;
    }
    end(s);
    try {
      const blob = await s.recorder.stop();
      const elapsed = (s.range.start - (o.ticks()[0] ?? 0)) / o.tickRate();
      const map = (o.mapName() || "replay").replace(/[^a-z0-9_-]+/gi, "_");
      const at = formatClipTime(elapsed).replace(":", "m");
      downloadBlob(
        blob,
        `5stack-${map}-round${s.range.round}-${at}s.${s.extension}`,
      );
      toast({ title: t("match.replay.share.clip_saved") });
    } catch {
      toast({
        title: t("match.replay.share.clip_failed"),
        variant: "destructive",
      });
    }
  }

  async function exportClip(kind: ClipRangeKind) {
    const stage = o.stage()?.stage;
    const range = rangeFor(kind);
    if (session || !format || !stage || !o.stageActive() || !range) {
      return;
    }
    o.pause();
    await seek(range.round, range.start);
    // The first frames of a new moment are heavy (smoke grids, textures):
    // let them land before the clock starts.
    await Promise.all([
      fontsReady(),
      Promise.race([stage.settle(), wait(3000)]),
    ]);
    if (session || !o.stageActive()) {
      return;
    }
    let recorder: ClipRecorder;
    try {
      recorder = createClipRecorder({
        source: stage.ctx.renderer.domElement,
        format,
        caption: captionNow,
      });
    } catch {
      toast({
        title: t("match.replay.share.clip_failed"),
        variant: "destructive",
      });
      return;
    }
    const s: ExportSession = {
      recorder,
      extension: format.extension,
      range,
      speed: o.speed.value,
      started: false,
      hidden: document.hidden,
      resumeOnShow: true,
      off: stage.onRender(onFrame),
    };
    session = s;
    exporting.value = true;
    exportHidden.value = s.hidden;
    exportElapsed.value = 0;
    exportLength.value = (range.end - range.start) / o.tickRate();
    // A hidden tab draws nothing: the recording starts once it is shown.
    if (!s.hidden) {
      void begin(s);
    }
  }

  function cancelExport() {
    const s = session;
    if (!s) {
      return;
    }
    end(s);
    s.recorder.cancel();
  }

  // Pausing the replay pauses the clip with it.
  watch(
    () => o.playing(),
    (playing) => {
      const s = session;
      if (!s?.started || s.hidden) {
        return;
      }
      if (playing) {
        s.recorder.resume();
      } else {
        s.recorder.pause();
      }
    },
  );

  // A hidden tab stops drawing, and its first frame back would jump the
  // clock: pause both while it is away.
  function onVisibility() {
    const s = session;
    if (!s) {
      return;
    }
    if (document.hidden) {
      if (s.hidden) {
        return;
      }
      s.resumeOnShow = !s.started || o.playing();
      s.hidden = true;
      exportHidden.value = true;
      s.recorder.pause();
      o.pause();
      return;
    }
    if (!s.hidden) {
      return;
    }
    s.hidden = false;
    exportHidden.value = false;
    if (!s.started) {
      void begin(s);
    } else if (s.resumeOnShow) {
      s.recorder.resume();
      o.play();
    }
  }

  // I and O mark a clip's start and end, like an editor.
  function onKeyDown(event: KeyboardEvent) {
    if (!format || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (
      target &&
      (target.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT")
    ) {
      return;
    }
    if (event.code === "KeyI" || event.code === "KeyO") {
      event.preventDefault();
      setMark(event.code === "KeyI" ? "in" : "out");
    }
  }

  onMounted(() => {
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKeyDown);
    if (incoming) {
      void applyMoment(incoming);
    }
  });
  onBeforeUnmount(() => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("keydown", onKeyDown);
    if (copiedTimer) {
      clearTimeout(copiedTimer);
    }
    cancelExport();
  });

  return reactive({
    copied,
    copyLink,
    momentLink,
    marks,
    chromeMarks,
    setMark,
    markSeconds,
    clearMarks,
    rangeSeconds,
    format: format?.extension ?? null,
    canExport,
    exporting,
    exportHidden,
    exportElapsed,
    exportLength,
    exportClip,
    cancelExport,
  });
}

export type ReplayShare = ReturnType<typeof useReplayShare>;
