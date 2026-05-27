<script lang="ts" setup>
import {
  ref,
  watch,
  onMounted,
  onUnmounted,
  nextTick,
  computed,
  type PropType,
} from "vue";
import { useI18n } from "vue-i18n";
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import BracketScheduleDialog from "~/components/tournament/BracketScheduleDialog.vue";
import { Maximize, Minimize, ZoomIn, ZoomOut, Scan } from "lucide-vue-next";
import { getRoundLabel } from "~/utilities/tournamentRoundLabels";
import type { Bracket } from "~/types/tournament";

interface TournamentRound {
  length: number;
  [key: number]: any;
}

const props = defineProps({
  stage: {
    type: Object,
    required: true,
  },
  tournament: {
    type: Object,
    required: true,
  },
  rounds: {
    type: Map<number, TournamentRound>,
    required: true,
  },
  isFinalStage: {
    type: Boolean,
    default: false,
  },
  isLoserBracket: {
    type: Boolean,
    default: false,
  },
  totalGroups: {
    type: Number,
    default: 1,
  },
  stageType: {
    type: String,
    default: null,
  },
  embed: {
    type: Boolean,
    default: false,
  },
  fitHeight: {
    type: [String, Number] as PropType<string | number | null>,
    default: null,
  },
  hideFinishedRounds: {
    type: Boolean,
    default: false,
  },
  pageScroll: {
    type: Boolean,
    default: false,
  },
  stickyTopOffset: {
    type: Number,
    default: 0,
  },
});

const { t } = useI18n();

const zoomBtnShineClasses =
  "relative overflow-hidden before:content-[''] before:absolute before:top-0 before:-left-full before:w-full before:h-full before:[background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)] before:transition-[left] before:duration-500 enabled:hover:-translate-y-px enabled:hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)] enabled:active:translate-y-0 enabled:active:shadow-[0_2px_6px_rgba(0,0,0,0.2)] enabled:hover:before:left-full";

const isRoundFinished = (round: any): boolean => {
  if (!round || !round.length) return false;
  const brackets = Array.from(
    { length: round.length },
    (_, i) => round[i],
  ).filter(Boolean);
  if (!brackets.length) return false;
  return brackets.every((b: any) => {
    if (b.bye) return true;
    if (!b.team_1 && !b.team_2) return false;
    return !!b.match?.winning_lineup_id;
  });
};

const displayRounds = computed(() => {
  if (!props.hideFinishedRounds) return props.rounds;
  const filtered = new Map<number, any>();
  for (const [k, v] of props.rounds.entries()) {
    if (!isRoundFinished(v)) filtered.set(k, v);
  }
  // If filtering removes everything, fall back to all rounds so we don't render empty
  if (filtered.size === 0) return props.rounds;
  return filtered;
});

const roundLabels = computed(() => {
  const labels = new Map<number, string>();
  if (!props.rounds.size) return labels;
  const maxRound = Math.max(...props.rounds.keys());

  for (const [roundNumber, round] of props.rounds.entries()) {
    const label = getRoundLabel(
      roundNumber,
      props.stage.order,
      props.isFinalStage,
      round.length,
      props.isLoserBracket,
      props.stageType,
      roundNumber === maxRound,
    );
    labels.set(roundNumber, t(label.key, label.params));
  }
  return labels;
});

const bracketContainer = ref<HTMLElement | null>(null);
const isBracketDragging = ref(false);
const bracketDragStart = ref({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

let lastPositions: { x: number; y: number; t: number }[] = [];
let momentumFrame: number | null = null;
let momentumVelocity = { x: 0, y: 0 };
const MOMENTUM_DECAY = 0.95;
const MOMENTUM_MIN_VELOCITY = 0.5;

const isFullscreen = ref(false);
const bracketWrapper = ref<HTMLElement | null>(null);
const bracketContent = ref<HTMLElement | null>(null);
const bracketContentWrapper = ref<HTMLElement | null>(null);

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const MAX_FIT_ZOOM = 1.0;
const MIN_FIT_ZOOM = 0.55;
const ZOOM_STEP = 0.1;

const autoFit = ref(true);
const manualZoom = ref(0.75);

const naturalSize = ref({ width: 0, height: 0 });
const availableSize = ref({ width: 0, height: 0 });

let contentResizeObserver: ResizeObserver | null = null;
let containerResizeObserver: ResizeObserver | null = null;

const scheduleDialogOpen = ref(false);
const selectedBracket = ref<Bracket | null>(null);

const handleScheduleBracket = (bracket: Bracket) => {
  selectedBracket.value = bracket;
  scheduleDialogOpen.value = true;
};

const containerMaxHeight = computed(() => `${availableSize.value.height}px`);

const FIT_PADDING = 8;

const fitZoom = computed(() => {
  const natW = naturalSize.value.width;
  const natH = naturalSize.value.height;
  const ctW = availableSize.value.width - FIT_PADDING * 2;
  const ctH = availableSize.value.height - FIT_PADDING * 2;
  if (!natW || !natH) return manualZoom.value;
  if (props.pageScroll) {
    if (ctW <= 0) return MAX_FIT_ZOOM;
    const wScale = ctW / natW;
    return Math.max(MIN_FIT_ZOOM, Math.min(MAX_FIT_ZOOM, wScale));
  }
  if (ctH <= 0) return manualZoom.value;
  const hScale = ctH / natH;
  if (ctW <= 0)
    return Math.max(MIN_FIT_ZOOM, Math.min(MAX_FIT_ZOOM, hScale));
  const wScale = ctW / natW;
  return Math.max(
    MIN_FIT_ZOOM,
    Math.min(MAX_FIT_ZOOM, Math.min(hScale, wScale)),
  );
});

const effectiveZoom = computed(() =>
  autoFit.value ? fitZoom.value : manualZoom.value,
);

const scaledContentHeight = computed(
  () => naturalSize.value.height * effectiveZoom.value,
);
const scaledContentWidth = computed(
  () => naturalSize.value.width * effectiveZoom.value,
);

const clampedContainerHeight = computed(() => {
  if (props.pageScroll) {
    // Let the container size to its natural content; page handles scroll
    return null;
  }
  if (!availableSize.value.height) return 0;
  if (props.fitHeight != null) {
    return availableSize.value.height;
  }
  if (props.totalGroups > 1 || isFullscreen.value || props.embed) {
    return availableSize.value.height;
  }
  if (!scaledContentHeight.value) return 0;
  return Math.min(scaledContentHeight.value, availableSize.value.height);
});

const needsHorizontalScroll = computed(() => {
  if (props.pageScroll) {
    return naturalSize.value.width > availableSize.value.width + 1;
  }
  return scaledContentWidth.value > availableSize.value.width + 1;
});
const needsVerticalScroll = computed(
  () => scaledContentHeight.value > availableSize.value.height + 1,
);

const toggleFullscreen = async () => {
  if (!bracketWrapper.value) return;
  if (!isFullscreen.value) {
    if (bracketWrapper.value.requestFullscreen) {
      await bracketWrapper.value.requestFullscreen();
    } else if ((bracketWrapper.value as any).webkitRequestFullscreen) {
      (bracketWrapper.value as any).webkitRequestFullscreen();
    }
    isFullscreen.value = true;
  } else {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    }
    isFullscreen.value = false;
  }
};

const onFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement;
  nextTick(() => measureSizes());
};

const redrawLines = () => {
  clearConnectingLines();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      drawConnectingLines();
    });
  });
};

const zoomIn = () => {
  autoFit.value = false;
  manualZoom.value = Math.min(
    MAX_ZOOM,
    (autoFit.value ? fitZoom.value : manualZoom.value) + ZOOM_STEP,
  );
  nextTick(redrawLines);
};

const zoomOut = () => {
  autoFit.value = false;
  manualZoom.value = Math.max(
    MIN_ZOOM,
    (autoFit.value ? fitZoom.value : manualZoom.value) - ZOOM_STEP,
  );
  nextTick(redrawLines);
};

const resetZoom = () => {
  autoFit.value = true;
  nextTick(redrawLines);
};

const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  }
};

const measureSizes = () => {
  if (typeof window === "undefined") return;
  if (bracketContent.value) {
    naturalSize.value = {
      width: bracketContent.value.offsetWidth,
      height: bracketContent.value.offsetHeight,
    };
  }
  const vh = window.innerHeight;
  let height = 0;
  if (props.fitHeight != null) {
    const parsed =
      typeof props.fitHeight === "number"
        ? props.fitHeight
        : parseInt(props.fitHeight, 10);
    height = Number.isFinite(parsed) && parsed > 0 ? parsed : vh;
  } else if (isFullscreen.value) {
    height = vh;
  } else if (props.pageScroll) {
    height = naturalSize.value.height || vh - 220;
  } else if (props.embed) {
    const headerReserve = 60;
    if (props.totalGroups <= 1) height = vh - headerReserve;
    else height = (vh - headerReserve) / props.totalGroups;
  } else if (props.totalGroups === 1) {
    height = vh - 220;
  } else if (props.totalGroups === 2) {
    height = (vh - 240) / 2;
  } else if (props.totalGroups === 3) {
    height = (vh - 260) / 3;
  } else {
    height = (vh - 280) / 4;
  }
  const width = bracketContainer.value?.clientWidth || 0;
  availableSize.value = { width, height: Math.max(280, height) };
};

onMounted(() => {
  if (bracketContainer.value) {
    bracketContainer.value.addEventListener("wheel", handleWheel, {
      passive: false,
    });
    window.addEventListener("resize", measureSizes);
  }
  document.addEventListener("fullscreenchange", onFullscreenChange);

  if (bracketContent.value) {
    contentResizeObserver = new ResizeObserver(() => {
      measureSizes();
      redrawLines();
    });
    contentResizeObserver.observe(bracketContent.value);
  }
  if (bracketContainer.value) {
    containerResizeObserver = new ResizeObserver(() => {
      measureSizes();
    });
    containerResizeObserver.observe(bracketContainer.value);
  }
  nextTick(() => {
    measureSizes();
    redrawLines();
  });
});

onUnmounted(() => {
  if (bracketContainer.value) {
    bracketContainer.value.removeEventListener("wheel", handleWheel);
    window.removeEventListener("resize", measureSizes);
  }
  window.removeEventListener("mousemove", onBracketPointerMove);
  window.removeEventListener("touchmove", onBracketPointerMove);
  window.removeEventListener("mouseup", onBracketPointerUp);
  window.removeEventListener("touchend", onBracketPointerUp);
  if (momentumFrame) cancelAnimationFrame(momentumFrame);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  contentResizeObserver?.disconnect();
  containerResizeObserver?.disconnect();
});

watch(
  () => props.rounds,
  () => {
    nextTick(() => {
      measureSizes();
      redrawLines();
    });
  },
  { deep: true, immediate: true },
);

watch(effectiveZoom, () => {
  nextTick(redrawLines);
});

watch(
  [
    () => props.embed,
    () => props.fitHeight,
    () => props.hideFinishedRounds,
    () => props.pageScroll,
    isFullscreen,
  ],
  () => {
    nextTick(() => {
      measureSizes();
      redrawLines();
    });
  },
);

watch(displayRounds, () => {
  nextTick(() => {
    measureSizes();
    redrawLines();
  });
});

const clearConnectingLines = () => {
  if (bracketContentWrapper.value) {
    const wrapper = bracketContentWrapper.value as HTMLElement;
    const existingSvg = wrapper.querySelector("svg");
    if (existingSvg) {
      existingSvg.remove();
    }
  }
};

const drawConnectingLines = () => {
  if (!bracketContainer.value || !bracketContentWrapper.value) {
    return;
  }

  const wrapper = bracketContentWrapper.value as HTMLElement;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  const fullWidth = wrapper.scrollWidth;
  const fullHeight = wrapper.scrollHeight;

  svg.setAttribute("width", fullWidth + "px");
  svg.setAttribute("height", fullHeight + "px");

  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";

  svg.style.pointerEvents = "none";

  for (const [, round] of displayRounds.value.entries()) {
    const brackets = Array.from(
      { length: round.length },
      (_, i) => round[i],
    ).filter(Boolean);

    for (const bracket of brackets) {
      if (!bracket || !bracket.id) continue;

      const sourceMatchEl = wrapper.querySelector(
        `#bracket-${bracket.id}`,
      ) as HTMLElement;
      if (!sourceMatchEl) continue;

      if (bracket.parent_bracket?.id) {
        const targetMatchEl = wrapper.querySelector(
          `#bracket-${bracket.parent_bracket.id}`,
        ) as HTMLElement;
        if (targetMatchEl) {
          drawLine(svg, sourceMatchEl, targetMatchEl, "winner");
        }
      }

      if (bracket.loser_bracket?.id) {
        const targetMatchEl = wrapper.querySelector(
          `#bracket-${bracket.loser_bracket.id}`,
        ) as HTMLElement;
        if (targetMatchEl) {
          drawLine(svg, sourceMatchEl, targetMatchEl, "loser");
        }
      }
    }
  }

  wrapper.appendChild(svg);
};

const drawLine = (
  svg: SVGElement,
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  type: "winner" | "loser",
) => {
  const margins = 12.5;

  const sourceX = sourceEl.offsetLeft + sourceEl.offsetWidth;
  const sourceY = sourceEl.offsetTop + sourceEl.offsetHeight / 2;

  const targetX = targetEl.offsetLeft;
  const targetY = targetEl.offsetTop + targetEl.offsetHeight / 2;

  const adjustedSourceY =
    type === "winner" ? sourceY - margins : sourceY + margins;

  const adjustedTargetY =
    type === "winner" ? targetY - margins : targetY + margins;

  const midX = (sourceX + targetX) / 2;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  path.setAttribute(
    "d",
    `M ${sourceX} ${adjustedSourceY} H ${midX} V ${adjustedTargetY} H ${targetX}`,
  );

  path.setAttribute("fill", "none");
  path.setAttribute(
    "stroke",
    type === "winner" ? "white" : "rgba(255, 100, 100, 0.7)",
  );
  path.setAttribute("stroke-width", "2");

  svg.appendChild(path);
};

const onBracketPointerDown = (e: MouseEvent | TouchEvent) => {
  if (!bracketContainer.value) return;
  if (!needsHorizontalScroll.value && !needsVerticalScroll.value) return;
  isBracketDragging.value = true;
  document.body.style.userSelect = "none";
  let clientX: number;
  let clientY: number;
  if (e instanceof TouchEvent) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  bracketDragStart.value = {
    x: clientX,
    y: clientY,
    scrollLeft: bracketContainer.value.scrollLeft,
    scrollTop: bracketContainer.value.scrollTop,
  };
  lastPositions = [{ x: clientX, y: clientY, t: Date.now() }];
  if (momentumFrame) {
    cancelAnimationFrame(momentumFrame);
    momentumFrame = null;
  }
  window.addEventListener("mousemove", onBracketPointerMove);
  window.addEventListener("touchmove", onBracketPointerMove, {
    passive: false,
  });
  window.addEventListener("mouseup", onBracketPointerUp);
  window.addEventListener("touchend", onBracketPointerUp);
};

const onBracketPointerMove = (e: MouseEvent | TouchEvent) => {
  if (!isBracketDragging.value || !bracketContainer.value) return;
  let clientX: number;
  let clientY: number;
  if (e instanceof TouchEvent) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  const dx = clientX - bracketDragStart.value.x;
  const dy = clientY - bracketDragStart.value.y;
  bracketContainer.value.scrollLeft = bracketDragStart.value.scrollLeft - dx;
  bracketContainer.value.scrollTop = bracketDragStart.value.scrollTop - dy;
  const now = Date.now();
  lastPositions.push({ x: clientX, y: clientY, t: now });
  if (lastPositions.length > 5) lastPositions.shift();
  if (e.cancelable) e.preventDefault();
};

const onBracketPointerUp = () => {
  isBracketDragging.value = false;
  document.body.style.userSelect = "";
  window.removeEventListener("mousemove", onBracketPointerMove);
  window.removeEventListener("touchmove", onBracketPointerMove);
  window.removeEventListener("mouseup", onBracketPointerUp);
  window.removeEventListener("touchend", onBracketPointerUp);
  if (lastPositions.length >= 2 && bracketContainer.value) {
    const last = lastPositions[lastPositions.length - 1];
    const first = lastPositions[0];
    const dt = last.t - first.t || 1;
    momentumVelocity.x = ((last.x - first.x) / dt) * -1;
    momentumVelocity.y = ((last.y - first.y) / dt) * -1;
    startMomentum();
  }
};

function startMomentum() {
  if (!bracketContainer.value) return;
  let { scrollLeft, scrollTop } = bracketContainer.value;
  function step() {
    if (!bracketContainer.value) return;
    scrollLeft += momentumVelocity.x * 16;
    scrollTop += momentumVelocity.y * 16;
    scrollLeft = Math.max(
      0,
      Math.min(
        scrollLeft,
        bracketContainer.value.scrollWidth - bracketContainer.value.clientWidth,
      ),
    );
    scrollTop = Math.max(
      0,
      Math.min(
        scrollTop,
        bracketContainer.value.scrollHeight -
          bracketContainer.value.clientHeight,
      ),
    );
    bracketContainer.value.scrollLeft = scrollLeft;
    bracketContainer.value.scrollTop = scrollTop;
    momentumVelocity.x *= MOMENTUM_DECAY;
    momentumVelocity.y *= MOMENTUM_DECAY;
    if (
      Math.abs(momentumVelocity.x) > MOMENTUM_MIN_VELOCITY ||
      Math.abs(momentumVelocity.y) > MOMENTUM_MIN_VELOCITY
    ) {
      momentumFrame = requestAnimationFrame(step);
    } else {
      momentumFrame = null;
    }
  }
  step();
}
</script>

<template>
  <div
    class="relative"
    :class="isFullscreen ? 'flex h-screen w-screen items-center bg-background' : ''"
    ref="bracketWrapper"
  >
    <div
      class="relative"
      :class="[
        pageScroll
          ? ''
          : needsHorizontalScroll || needsVerticalScroll
            ? 'cursor-grab active:cursor-grabbing'
            : '',
        needsHorizontalScroll ? 'overflow-x-auto' : 'overflow-x-visible',
        needsVerticalScroll ? 'overflow-y-auto' : 'overflow-y-visible',
        isFullscreen ? 'mx-auto w-full' : '',
      ]"
      :style="
        pageScroll
          ? { padding: '8px' }
          : {
              maxHeight: containerMaxHeight,
              height: clampedContainerHeight
                ? `${clampedContainerHeight}px`
                : 'auto',
              padding: '8px',
              transition:
                'height 250ms cubic-bezier(0.4, 0, 0.2, 1), max-height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
            }
      "
      ref="bracketContainer"
      @mousedown="onBracketPointerDown"
      @touchstart="onBracketPointerDown"
    >
      <div
        :style="
          pageScroll
            ? {
                width: 'auto',
                height: 'auto',
                opacity: naturalSize.width ? 1 : 0,
                transition: 'opacity 150ms ease-out',
              }
            : {
                width: scaledContentWidth
                  ? `${scaledContentWidth}px`
                  : 'auto',
                height: scaledContentHeight
                  ? `${scaledContentHeight}px`
                  : 'auto',
                opacity: naturalSize.width ? 1 : 0,
                transition:
                  'opacity 150ms ease-out, width 250ms cubic-bezier(0.4, 0, 0.2, 1), height 250ms cubic-bezier(0.4, 0, 0.2, 1)',
              }
        "
        :class="['relative', 'overflow-visible']"
      >
        <div
          ref="bracketContentWrapper"
          :class="[
            'origin-top-left',
            !pageScroll && scaledContentWidth ? 'absolute top-0 left-0' : '',
          ]"
          :style="
            pageScroll
              ? {}
              : {
                  transform: `scale(${effectiveZoom})`,
                  transformOrigin: 'top left',
                  transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
                }
          "
        >
          <div
            class="grid grid-flow-col auto-cols-max gap-20 min-w-max"
            ref="bracketContent"
          >
            <div
              v-for="round of Array.from(displayRounds.keys())"
              :key="round"
              class="flex flex-col bracket-column"
            >
              <div
                class="text-center mb-2"
                :class="pageScroll ? 'sticky z-20 pt-1 pb-1' : ''"
                :style="
                  pageScroll
                    ? {
                        top: `${stickyTopOffset}px`,
                        background:
                          'linear-gradient(to bottom, hsl(var(--background)) 60%, hsl(var(--background) / 0.85))',
                      }
                    : undefined
                "
              >
                <div
                  class="bg-gray-700 text-white rounded-lg px-4 py-2 shadow-md"
                >
                  <span class="font-semibold text-sm">{{
                    roundLabels.get(round) || `Round ${round}`
                  }}</span>
                </div>
              </div>

              <div class="flex flex-col justify-around flex-1 gap-4">
                <TournamentMatch
                  :stage="stage"
                  :tournament="tournament"
                  :round="Number(round)"
                  :brackets="displayRounds.get(round) as any[]"
                  @schedule-bracket="handleScheduleBracket"
                ></TournamentMatch>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!embed"
      class="zoom-controls-container absolute top-0 right-4 z-50 flex flex-col gap-3 opacity-20 hover:opacity-80 transition-opacity duration-300 ease-in-out"
    >
      <div
        v-if="!pageScroll"
        class="flex flex-col gap-1.5 bg-gray-800/90 backdrop-blur-md rounded-lg p-2.5 shadow-xl border border-gray-700/50"
      >
        <button
          :class="zoomBtnShineClasses"
          class="bg-gray-700/60 hover:bg-gray-600/80 active:bg-gray-500/90 text-white rounded-md p-2.5 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700/60 transition-all duration-200 ease-in-out flex items-center justify-center"
          @click="zoomIn"
          :disabled="effectiveZoom >= MAX_ZOOM"
          :title="$t('ui.tooltips.zoom_in_scroll')"
        >
          <ZoomIn class="w-4 h-4" />
        </button>
        <button
          :class="zoomBtnShineClasses"
          class="bg-gray-700/60 hover:bg-gray-600/80 active:bg-gray-500/90 text-white rounded-md p-2.5 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700/60 transition-all duration-200 ease-in-out flex items-center justify-center"
          @click="zoomOut"
          :disabled="effectiveZoom <= MIN_ZOOM"
          :title="$t('ui.tooltips.zoom_out_scroll')"
        >
          <ZoomOut class="w-4 h-4" />
        </button>
        <button
          :class="[
            zoomBtnShineClasses,
            autoFit
              ? 'bg-[hsl(var(--tac-amber)/0.25)] text-[hsl(var(--tac-amber))]'
              : 'bg-gray-700/60 text-white hover:bg-gray-600/80',
          ]"
          class="rounded-md p-2.5 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 ease-in-out flex items-center justify-center"
          :title="$t('tournament.bracket.fit_to_view')"
          @click="resetZoom"
        >
          <Scan class="w-4 h-4" />
        </button>
        <div
          class="text-white text-[0.62rem] font-mono text-center opacity-70 tabular-nums"
        >
          {{ Math.round(effectiveZoom * 100) }}%
        </div>
      </div>
      <button
        :class="zoomBtnShineClasses"
        class="bg-gray-800/90 backdrop-blur-md hover:bg-gray-700/90 active:bg-gray-600/90 text-white rounded-lg p-2.5 shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-gray-700/50 transition-all duration-200 ease-in-out flex items-center justify-center"
        @click="toggleFullscreen"
        :title="
          isFullscreen
            ? $t('common.exit_fullscreen')
            : $t('common.enter_fullscreen')
        "
      >
        <Maximize v-if="!isFullscreen" class="w-4 h-4" />
        <Minimize v-else class="w-4 h-4" />
      </button>
    </div>

    <BracketScheduleDialog
      v-if="!embed"
      :open="scheduleDialogOpen"
      :bracket="selectedBracket"
      @update:open="scheduleDialogOpen = $event"
    />
  </div>
</template>
