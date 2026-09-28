import {
  getCurrentScope,
  onScopeDispose,
  reactive,
  readonly,
  watch,
} from "vue";
import { brandedFaviconHref, faviconOverride } from "~/composables/useBranding";
import {
  isTabFlashEnabled,
  type TabFlashKind,
} from "~/composables/useTabFlashSettings";

// Most urgent first: the title names the top kind that has anything waiting.
const PRIORITY: TabFlashKind[] = ["admin_call", "match_found", "chat", "bell"];

const BLINK_MS = 1000;
const SEEN_KEY_LIMIT = 500;
const ICON_SIZE = 64;
const ICON_LOAD_TIMEOUT_MS = 5000;
const ICON_RETRY_MS = 60_000;
const DEFAULT_FAVICON = "/favicon.ico";
const BUNDLED_ICON = "/favicon/64.png";
const COUNT_DOT_COLOR = "#ef4444";

const counts = reactive<Record<TabFlashKind, number>>({
  admin_call: 0,
  match_found: 0,
  chat: 0,
  bell: 0,
});

const seenKeys = new Set<string>();
const alertIcons = new Map<string, Promise<string | null>>();

let installed = false;
let blinkTimer: ReturnType<typeof setInterval> | null = null;
let baseTitle: string | null = null;
let alertTitle = "";
let showingAlert = false;
let iconRequest = 0;

function isHidden() {
  return document.visibilityState === "hidden";
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function total() {
  return PRIORITY.reduce((sum, kind) => sum + counts[kind], 0);
}

function alertText(kind: TabFlashKind, count: number): string {
  const i18n = useNuxtApp().$i18n;

  switch (kind) {
    case "admin_call":
      return i18n.t("tab_flash.admin_call", count);
    case "match_found":
      return i18n.t("tab_flash.match_found", count);
    case "chat":
      return i18n.t("tab_flash.chat", count);
    case "bell":
      return i18n.t("tab_flash.bell", count);
  }
}

// unhead owns document.title and rewrites it whenever the page's head changes,
// flash or not. Anything that isn't one of our two strings is its newer title,
// and is what the flash alternates with and hands back when it stops.
function adoptExternalTitle() {
  const current = document.title;

  if (current !== alertTitle && current !== baseTitle) {
    baseTitle = current;
  }
}

function blink() {
  adoptExternalTitle();
  showingAlert = prefersReducedMotion() ? true : !showingAlert;
  document.title = showingAlert ? alertTitle : (baseTitle ?? "");
}

function stop() {
  if (blinkTimer) {
    clearInterval(blinkTimer);
    blinkTimer = null;
  }

  if (baseTitle !== null) {
    adoptExternalTitle();
    document.title = baseTitle;
    baseTitle = null;
  }

  alertTitle = "";
  showingAlert = false;
  iconRequest += 1;
  faviconOverride.value = null;
}

function refresh() {
  const count = total();
  const top = PRIORITY.find((kind) => counts[kind] > 0);

  if (!top || !isHidden()) {
    stop();
    return;
  }

  if (baseTitle === null) {
    baseTitle = document.title;
  } else {
    adoptExternalTitle();
  }

  // Read back, document.title comes with its whitespace collapsed, and the
  // alert has to compare equal to it or it would be adopted as the page's own.
  alertTitle = `(${count}) ${alertText(top, count)}`
    .replace(/\s+/g, " ")
    .trim();

  if (!blinkTimer) {
    showingAlert = true;
    blinkTimer = setInterval(blink, BLINK_MS);
  }

  if (showingAlert) {
    document.title = alertTitle;
  }

  void showAlertIcon(count > 9 ? "9+" : String(count));
}

// Hidden tabs throttle timers to as little as once a minute, so the icon holds
// its alert state for the whole flash instead of blinking with the title.
async function showAlertIcon(label: string) {
  const request = ++iconRequest;
  const icon = await alertIcon(brandedFaviconHref.value, label);

  if (request !== iconRequest || !icon) {
    return;
  }

  faviconOverride.value = icon;
}

function alertIcon(href: string, label: string) {
  const cacheKey = `${href}|${label}`;
  const cached = alertIcons.get(cacheKey);

  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;

  let context: CanvasRenderingContext2D | null = null;
  try {
    context = canvas.getContext("2d");
  } catch {
    context = null;
  }

  if (!context) {
    return Promise.resolve(null);
  }

  const icon = drawAlertIcon(canvas, context, href, label);
  alertIcons.set(cacheKey, icon);

  // One failed load (an API blip) shouldn't leave every later flash
  // title-only, but it shouldn't be retried on every signal either.
  void icon.then((drawn) => {
    if (!drawn) {
      setTimeout(() => alertIcons.delete(cacheKey), ICON_RETRY_MS);
    }
  });

  return icon;
}

async function drawAlertIcon(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  href: string,
  label: string,
): Promise<string | null> {
  // The branded icon lives on the API's origin. The tab already fetched it
  // without CORS, and a cached copy of that response would taint the canvas,
  // so the CORS request goes to a URL of its own. If it still can't be drawn
  // the flash stays title-only: the bundled icon is 5stack's, not the brand's.
  const source =
    href === DEFAULT_FAVICON
      ? BUNDLED_ICON
      : `${href}${href.includes("?") ? "&" : "?"}tab-flash=1`;

  try {
    const image = await loadImage(source);
    context.drawImage(image, 0, 0, ICON_SIZE, ICON_SIZE);
    drawCountDot(context, label);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(
      () => reject(new Error("icon load timed out")),
      ICON_LOAD_TIMEOUT_MS,
    );

    image.crossOrigin = "anonymous";
    image.onload = () => {
      clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("icon failed to load"));
    };
    image.src = src;
  });
}

function drawCountDot(context: CanvasRenderingContext2D, label: string) {
  const radius = 20;
  const fontSize = label.length > 1 ? 26 : 32;

  context.font = `700 ${fontSize}px Oxanium, system-ui, sans-serif`;

  const width = Math.max(radius * 2, context.measureText(label).width + 14);
  const left = ICON_SIZE - width;

  context.beginPath();
  context.arc(left + radius, radius, radius, Math.PI / 2, (Math.PI * 3) / 2);
  context.arc(
    ICON_SIZE - radius,
    radius,
    radius,
    (Math.PI * 3) / 2,
    Math.PI / 2,
  );
  context.closePath();
  context.fillStyle = COUNT_DOT_COLOR;
  context.fill();

  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, left + width / 2, radius + 1);
}

function remember(key: string) {
  if (seenKeys.size >= SEEN_KEY_LIMIT) {
    const oldest = seenKeys.values().next().value;
    if (oldest !== undefined) {
      seenKeys.delete(oldest);
    }
  }

  seenKeys.add(key);
}

// A key is spent the first time it is seen, even while the tab is visible:
// something the player already saw must not flash once they look away.
function signal(kind: TabFlashKind, key?: string) {
  if (!installed) {
    return;
  }

  if (key !== undefined) {
    const seenKey = `${kind}:${key}`;

    if (seenKeys.has(seenKey)) {
      return;
    }

    remember(seenKey);
  }

  if (!isHidden() || !isTabFlashEnabled(kind)) {
    return;
  }

  counts[kind] += 1;
  safely(refresh);
}

function clear(kind: TabFlashKind) {
  if (counts[kind] === 0) {
    return;
  }

  counts[kind] = 0;
  safely(refresh);
}

// Signals come from inside chat and call handlers, which must not lose their
// own work to a title that failed to update.
function safely(update: () => void) {
  try {
    update();
  } catch (error) {
    console.error("[tab-flash] failed to update the tab", error);
  }
}

function onVisibilityChange() {
  if (isHidden()) {
    return;
  }

  for (const kind of PRIORITY) {
    counts[kind] = 0;
  }

  stop();
}

// Counts what arrives after the tab is hidden, never what was already there:
// the baseline is taken on hide, or when the source first loads if the tab was
// hidden before that. A drop (read elsewhere, preferences loading) never
// flashes, and neither does climbing back to where it was.
export function trackBellCount(
  read: () => { loaded: boolean; count: number },
) {
  let baseline: number | null = null;
  let signalled = 0;

  const takeBaseline = () => {
    const { loaded, count } = read();
    baseline = loaded ? count : null;
    signalled = 0;
  };

  const onVisibilityChange = () => {
    if (isHidden()) {
      takeBaseline();
      return;
    }

    baseline = null;
  };

  if (isHidden()) {
    takeBaseline();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);

  const stopWatching = watch(read, ({ loaded, count }) => {
    if (!isHidden()) {
      return;
    }

    if (!loaded) {
      baseline = null;
      return;
    }

    if (baseline === null) {
      takeBaseline();
      return;
    }

    while (signalled < count - baseline) {
      signalled += 1;
      signal("bell");
    }
  });

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopWatching();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    });
  }
}

// Only the main window installs this. The chat pop-out is a document of its
// own, and flashing it too would double every alert.
export function installTabFlash() {
  if (installed || typeof document === "undefined") {
    return;
  }

  installed = true;
  document.addEventListener("visibilitychange", onVisibilityChange);
}

export function useTabFlash() {
  return {
    counts: readonly(counts),
    signal,
    clear,
  };
}
