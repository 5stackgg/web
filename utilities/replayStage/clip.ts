/**
 * Records the replay stage to a video file in the browser: each drawn frame
 * is copied onto a 2D canvas with a small caption burned in (the chrome is
 * DOM, so it is not in the WebGL canvas), and that canvas is recorded with
 * MediaRecorder.
 */

export type ClipFormat = {
  mimeType: string;
  extension: "mp4" | "webm";
};

const VIDEO_TYPES: ClipFormat[] = [
  { mimeType: "video/mp4;codecs=avc1.640028", extension: "mp4" },
  { mimeType: "video/mp4;codecs=avc1.4d0028", extension: "mp4" },
  { mimeType: "video/mp4;codecs=avc1.42E01F", extension: "mp4" },
  { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
  { mimeType: "video/mp4", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9", extension: "webm" },
  { mimeType: "video/webm;codecs=vp8", extension: "webm" },
  { mimeType: "video/webm", extension: "webm" },
];

/** The best format this browser can record, mp4 (H.264) first; null when it cannot. */
export function pickClipFormat(): ClipFormat | null {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof HTMLCanvasElement === "undefined" ||
    typeof HTMLCanvasElement.prototype.captureStream !== "function"
  ) {
    return null;
  }
  const supported = (type: string) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  };
  return VIDEO_TYPES.find((format) => supported(format.mimeType)) ?? null;
}

export type ClipCaption = {
  ctName: string;
  tName: string;
  ctScore: number;
  tScore: number;
  /** "Round 12", already translated. */
  round: string;
  clock: string;
  /** Seconds left on a planted C4 ("32s"), drawn instead of the clock. */
  bomb?: string | null;
};

export const CLIP_COLORS = {
  ct: "hsl(210, 80%, 60%)",
  t: "hsl(33, 94%, 58%)",
  text: "#e6edf3",
  muted: "#8a98a8",
  bomb: "#ff5a4d",
  panel: "rgba(10, 12, 16, 0.78)",
  line: "rgba(255, 255, 255, 0.08)",
};

export const CLIP_FONT = "Oxanium";

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) {
    return text;
  }
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * One quiet row in the bottom-left corner:
 * `| CT name  7 : 5  T name |  Round 12  1:24`.
 */
export function drawClipCaption(
  ctx: CanvasRenderingContext2D,
  caption: ClipCaption,
  width: number,
  height: number,
) {
  const size = Math.round(Math.min(30, Math.max(12, height * 0.024)));
  const pad = Math.round(size * 0.7);
  const gap = Math.round(size * 0.55);
  const margin = Math.round(Math.max(10, height * 0.028));
  const bar = Math.max(2, Math.round(size * 0.16));
  const nameMax = width * 0.22;

  ctx.save();
  ctx.textBaseline = "middle";
  const regular = `600 ${size}px ${CLIP_FONT}, system-ui, sans-serif`;
  const bold = `700 ${size}px ${CLIP_FONT}, system-ui, sans-serif`;
  ctx.font = regular;
  const ctName = fit(ctx, caption.ctName, nameMax);
  const tName = fit(ctx, caption.tName, nameMax);
  const clock = caption.bomb ? `C4 ${caption.bomb}` : caption.clock;

  type Item = {
    text?: string;
    bar?: string;
    font?: string;
    color?: string;
    after: number;
  };
  const items: Item[] = [
    { bar: CLIP_COLORS.ct, after: gap },
    { text: ctName, font: regular, color: CLIP_COLORS.text, after: gap },
    {
      text: String(caption.ctScore),
      font: bold,
      color: CLIP_COLORS.ct,
      after: gap * 0.6,
    },
    { text: ":", font: regular, color: CLIP_COLORS.muted, after: gap * 0.6 },
    {
      text: String(caption.tScore),
      font: bold,
      color: CLIP_COLORS.t,
      after: gap,
    },
    { text: tName, font: regular, color: CLIP_COLORS.text, after: gap },
    { bar: CLIP_COLORS.t, after: gap * 2 },
    {
      text: caption.round,
      font: regular,
      color: CLIP_COLORS.muted,
      after: gap,
    },
    {
      text: clock,
      font: bold,
      color: caption.bomb ? CLIP_COLORS.bomb : CLIP_COLORS.text,
      after: 0,
    },
  ];
  const span = (item: Item) => {
    if (item.bar) {
      return bar;
    }
    ctx.font = item.font!;
    return ctx.measureText(item.text!).width;
  };
  const inner = items.reduce((sum, item) => sum + span(item) + item.after, 0);
  const boxW = Math.round(inner + pad * 2);
  const boxH = Math.round(size * 2);
  const x = margin;
  const y = height - margin - boxH;
  const mid = y + boxH / 2;

  roundRect(ctx, x, y, boxW, boxH, Math.round(size * 0.3));
  ctx.fillStyle = CLIP_COLORS.panel;
  ctx.fill();
  ctx.strokeStyle = CLIP_COLORS.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  const barH = Math.round(size * 1.05);
  let cursor = x + pad;
  for (const item of items) {
    const w = span(item);
    if (item.bar) {
      ctx.fillStyle = item.bar;
      ctx.fillRect(cursor, mid - barH / 2, w, barH);
    } else {
      ctx.fillStyle = item.color!;
      ctx.fillText(item.text!, cursor, mid);
    }
    cursor += w + item.after;
  }
  ctx.restore();
}

export type ClipRecorder = {
  readonly width: number;
  readonly height: number;
  /** Copies the source canvas and the caption into the next video frame. */
  capture(): void;
  /** Resolves once the recorder is actually taking frames. */
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  /** Finishes the file. */
  stop(): Promise<Blob>;
  /** Stops and throws the recording away. */
  cancel(): void;
};

export type ClipRecorderOptions = {
  source: HTMLCanvasElement;
  format: ClipFormat;
  caption: () => ClipCaption | null;
  /** Output height cap; the source is scaled down to it. */
  maxHeight?: number;
  /** Frames above this rate are skipped. */
  maxFps?: number;
};

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export function createClipRecorder(options: ClipRecorderOptions): ClipRecorder {
  const { source, format } = options;
  const maxHeight = options.maxHeight ?? 1080;
  const minFrameMs = 1000 / (options.maxFps ?? 60) - 2;
  const scale = Math.min(1, maxHeight / Math.max(1, source.height));
  const width = even(source.width * scale);
  const height = even(source.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("No 2D canvas for the clip");
  }
  ctx.imageSmoothingQuality = "high";

  // Frames are pushed one per drawn stage frame; a browser without
  // requestFrame samples the canvas at a fixed rate instead.
  let stream = canvas.captureStream(0);
  let track = stream.getVideoTracks()[0] as
    (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
  if (typeof track?.requestFrame !== "function") {
    stream.getTracks().forEach((t) => t.stop());
    stream = canvas.captureStream(options.maxFps ?? 60);
    track = undefined;
  }
  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: height > 720 ? 10_000_000 : 6_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) {
      chunks.push(event.data);
    }
  };
  let lastFrame = -Infinity;
  let cancelled = false;

  function capture() {
    const now = performance.now();
    if (now - lastFrame < minFrameMs) {
      return;
    }
    lastFrame = now;
    // A resized window keeps the clip's size: the picture is fitted into it.
    const s = Math.min(width / source.width, height / source.height);
    const w = source.width * s;
    const h = source.height * s;
    if (w < width || h < height) {
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, width, height);
    }
    ctx!.drawImage(source, (width - w) / 2, (height - h) / 2, w, h);
    const caption = options.caption();
    if (caption) {
      drawClipCaption(ctx!, caption, width, height);
    }
    track?.requestFrame?.();
  }

  function release() {
    for (const t of stream.getTracks()) {
      t.stop();
    }
  }

  return {
    width,
    height,
    capture,
    start() {
      return new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 1000);
        recorder.onstart = () => {
          clearTimeout(timer);
          resolve();
        };
        recorder.start(1000);
      });
    },
    pause() {
      if (recorder.state === "recording") {
        recorder.pause();
      }
    },
    resume() {
      if (recorder.state === "paused") {
        lastFrame = -Infinity;
        recorder.resume();
      }
    },
    stop() {
      return new Promise<Blob>((resolve, reject) => {
        if (recorder.state === "inactive") {
          release();
          reject(new Error("The clip recorder is not running"));
          return;
        }
        recorder.onstop = () => {
          release();
          if (cancelled) {
            reject(new Error("cancelled"));
            return;
          }
          resolve(new Blob(chunks, { type: format.mimeType.split(";")[0] }));
        };
        recorder.onerror = (event) => {
          release();
          reject((event as ErrorEvent).error ?? new Error("Recording failed"));
        };
        recorder.stop();
      });
    },
    cancel() {
      cancelled = true;
      if (recorder.state !== "inactive") {
        recorder.onstop = release;
        recorder.stop();
      } else {
        release();
      }
      chunks.length = 0;
    },
  };
}

/** Saves a blob as a file through a temporary link. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
