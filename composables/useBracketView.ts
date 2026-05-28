import { ref } from "vue";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;
const DEFAULT_ZOOM = 0.75;

// Shared zoom state — applied to every visible bracket viewer at once.
const autoFit = ref(true);
const manualZoom = ref(DEFAULT_ZOOM);
// The fit zoom reported by the primary (upper) viewer, used to seed manual
// zoom when the user first steps away from auto-fit.
const currentFitZoom = ref(DEFAULT_ZOOM);

// Shared fullscreen state — the target element is owned by the bracket page
// wrapper (TournamentStageBuilder), controls live in its top bar.
const isFullscreen = ref(false);
const fullscreenTarget = ref<HTMLElement | null>(null);

// Contextual labels for the fullscreen status bar, written by the components
// that actually know them (group from TournamentStage, scope from BracketPair).
const groupLabel = ref<string | null>(null);
const bracketScope = ref<"upper" | "lower" | null>(null);

const zoomBase = () => (autoFit.value ? currentFitZoom.value : manualZoom.value);

const zoomIn = () => {
  manualZoom.value = Math.min(MAX_ZOOM, zoomBase() + ZOOM_STEP);
  autoFit.value = false;
};

const zoomOut = () => {
  manualZoom.value = Math.max(MIN_ZOOM, zoomBase() - ZOOM_STEP);
  autoFit.value = false;
};

const resetZoom = () => {
  autoFit.value = true;
};

const enterFullscreen = async () => {
  const el = fullscreenTarget.value;
  if (!el) return;
  if (el.requestFullscreen) {
    await el.requestFullscreen();
  } else if ((el as any).webkitRequestFullscreen) {
    (el as any).webkitRequestFullscreen();
  }
};

const exitFullscreen = async () => {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
  } else if ((document as any).webkitExitFullscreen) {
    (document as any).webkitExitFullscreen();
  }
};

const toggleFullscreen = () => {
  if (isFullscreen.value) {
    void exitFullscreen();
  } else {
    void enterFullscreen();
  }
};

let listenerAttached = false;
const ensureListener = () => {
  if (listenerAttached || typeof document === "undefined") return;
  listenerAttached = true;
  document.addEventListener("fullscreenchange", () => {
    isFullscreen.value = !!document.fullscreenElement;
  });
};

export function useBracketView() {
  ensureListener();
  return {
    MIN_ZOOM,
    MAX_ZOOM,
    autoFit,
    manualZoom,
    currentFitZoom,
    isFullscreen,
    fullscreenTarget,
    groupLabel,
    bracketScope,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
