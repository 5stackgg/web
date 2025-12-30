<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from "vue";
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import { Maximize, Minimize, ZoomIn, ZoomOut } from "lucide-vue-next";
import {
  getRoundLabel,
  getWinnerLabel,
} from "~/utilities/tournamentRoundLabels";

interface TournamentRound {
  length: number;
  [key: number]: any;
}

const props = defineProps({
  stage: {
    type: Number,
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
});

const roundLabels = computed(() => {
  const labels = new Map<number, string>();

  for (const [roundNumber, round] of props.rounds.entries()) {
    const label = getRoundLabel(
      roundNumber,
      props.stage,
      props.isFinalStage,
      round.length,
      props.isLoserBracket,
      props.stageType,
    );
    labels.set(roundNumber, label);
  }
  return labels;
});

const bracketContainer = ref<HTMLElement | null>(null);
const minimapContainer = ref<HTMLElement | null>(null);
const viewportIndicator = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const isBracketDragging = ref(false);
const bracketDragStart = ref({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

// For momentum
let lastPositions: { x: number; y: number; t: number }[] = [];
let momentumFrame: number | null = null;
let momentumVelocity = { x: 0, y: 0 };
const MOMENTUM_DECAY = 0.95; // Deceleration factor
const MOMENTUM_MIN_VELOCITY = 0.5; // px/frame

const isFullscreen = ref(false);
const bracketWrapper = ref<HTMLElement | null>(null);
const bracketContent = ref<HTMLElement | null>(null);
const bracketContentWrapper = ref<HTMLElement | null>(null);
const zoomLevel = ref(0.75);
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;

// Calculate dynamic max height based on number of groups
const maxHeight = computed(() => {
  if (props.totalGroups === 1) {
    return "80vh";
  } else if (props.totalGroups === 2) {
    return "40vh";
  } else if (props.totalGroups === 3) {
    return "28vh";
  } else {
    return "22vh";
  }
});

const updateMinimap = () => {
  if (
    !bracketContainer.value ||
    !minimapContainer.value ||
    !viewportIndicator.value
  )
    return;
  const container = bracketContainer.value;
  const minimap = minimapContainer.value;
  const indicator = viewportIndicator.value;
  // Always use unzoomed scrollWidth/scrollHeight for minimap preview
  const naturalWidth = container.scrollWidth;
  const naturalHeight = container.scrollHeight;
  const scaleX = minimap.clientWidth / naturalWidth;
  const scaleY = minimap.clientHeight / naturalHeight;
  // For the indicator, just use the visible area
  const indicatorWidth = container.clientWidth * scaleX;
  const indicatorHeight = container.clientHeight * scaleY;
  const indicatorLeft = container.scrollLeft * scaleX;
  const indicatorTop = container.scrollTop * scaleY;
  indicator.style.width = `${indicatorWidth}px`;
  indicator.style.height = `${indicatorHeight}px`;
  indicator.style.left = `${indicatorLeft}px`;
  indicator.style.top = `${indicatorTop}px`;
  // Update minimap preview
  const previewContainer = minimap.querySelector(".minimap-preview");
  if (previewContainer) {
    const columns = container.querySelectorAll(".bracket-column");
    const previewColumns = previewContainer.querySelectorAll(".minimap-column");
    columns.forEach((column, i) => {
      const previewColumn = previewColumns[i] as HTMLElement;
      if (previewColumn) {
        const matches = column.querySelectorAll(".tournament-match");
        const previewMatches = previewColumn.querySelectorAll(".minimap-match");
        matches.forEach((match, j) => {
          const previewMatch = previewMatches[j] as HTMLElement;
          if (previewMatch) {
            const matchEl = match as HTMLElement;
            const matchTop = matchEl.offsetTop;
            const matchHeight = matchEl.offsetHeight;
            // Use naturalHeight for minimap scaling
            const relativeTop =
              (matchTop / naturalHeight) * minimap.clientHeight;
            const relativeHeight =
              (matchHeight / naturalHeight) * minimap.clientHeight;
            previewMatch.style.top = `${relativeTop}px`;
            previewMatch.style.height = `${relativeHeight}px`;
          }
        });
      }
    });
  }
};

const handleScroll = () => {
  requestAnimationFrame(updateMinimap);
};

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
};

const redrawLines = () => {
  clearConnectingLines();
  // Wait for transform to be applied, then redraw
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      drawConnectingLines();
      updateMinimap();
    });
  });
};

const zoomIn = () => {
  zoomLevel.value = Math.min(MAX_ZOOM, zoomLevel.value + ZOOM_STEP);
  nextTick(() => {
    redrawLines();
  });
};

const zoomOut = () => {
  zoomLevel.value = Math.max(MIN_ZOOM, zoomLevel.value - ZOOM_STEP);
  nextTick(() => {
    redrawLines();
  });
};

const resetZoom = () => {
  zoomLevel.value = 0.75;
  nextTick(() => {
    redrawLines();
  });
};

const handleWheel = (e: WheelEvent) => {
  // Only zoom if Ctrl/Cmd key is held
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomIn();
    } else {
      zoomOut();
    }
  }
};

onMounted(() => {
  if (bracketContainer.value) {
    bracketContainer.value.addEventListener("scroll", handleScroll);
    bracketContainer.value.addEventListener("wheel", handleWheel, {
      passive: false,
    });
    window.addEventListener("resize", updateMinimap);
    updateMinimap();
  }
  document.addEventListener("fullscreenchange", onFullscreenChange);
});

onUnmounted(() => {
  if (bracketContainer.value) {
    bracketContainer.value.removeEventListener("scroll", handleScroll);
    bracketContainer.value.removeEventListener("wheel", handleWheel);
    window.removeEventListener("resize", updateMinimap);
  }
  window.removeEventListener("mousemove", onMinimapPointerMove);
  window.removeEventListener("touchmove", onMinimapPointerMove);
  window.removeEventListener("mouseup", onMinimapPointerUp);
  window.removeEventListener("touchend", onMinimapPointerUp);
  window.removeEventListener("mousemove", onBracketPointerMove);
  window.removeEventListener("touchmove", onBracketPointerMove);
  window.removeEventListener("mouseup", onBracketPointerUp);
  window.removeEventListener("touchend", onBracketPointerUp);
  if (momentumFrame) cancelAnimationFrame(momentumFrame);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
});

watch(
  () => props.rounds,
  () => {
    nextTick(() => {
      clearConnectingLines();
      requestAnimationFrame(() => {
        drawConnectingLines();
        updateMinimap();
      });
    });
  },
  { deep: true, immediate: true },
);

watch(zoomLevel, () => {
  nextTick(() => {
    redrawLines();
  });
});

const clearConnectingLines = () => {
  // Clear SVG from both container and wrapper (in case it's in either location)
  if (bracketContainer.value) {
    const container = bracketContainer.value as HTMLElement;
    const existingSvg = container.querySelector("svg");
    if (existingSvg) {
      existingSvg.remove();
    }
  }
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

  const container = bracketContainer.value as HTMLElement;
  const wrapper = bracketContentWrapper.value as HTMLElement;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  // Set SVG dimensions to match the wrapper size (unscaled dimensions)
  const fullWidth = wrapper.scrollWidth;
  const fullHeight = wrapper.scrollHeight;

  svg.setAttribute("width", fullWidth + "px");
  svg.setAttribute("height", fullHeight + "px");

  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";

  svg.style.pointerEvents = "none";

  // Iterate through all rounds and brackets to draw connecting lines
  for (const [roundNumber, round] of props.rounds.entries()) {
    // Convert round to array (it's array-like with length property)
    const brackets = Array.from(
      { length: round.length },
      (_, i) => round[i],
    ).filter(Boolean);

    for (const bracket of brackets) {
      if (!bracket || !bracket.id) continue;

      // Find the source match element by ID (search within wrapper)
      const sourceMatchEl = wrapper.querySelector(
        `#bracket-${bracket.id}`,
      ) as HTMLElement;
      if (!sourceMatchEl) continue;

      // Draw line to parent bracket (winner advances)
      if (bracket.parent_bracket?.id) {
        const targetMatchEl = wrapper.querySelector(
          `#bracket-${bracket.parent_bracket.id}`,
        ) as HTMLElement;
        if (targetMatchEl) {
          drawLine(svg, sourceMatchEl, targetMatchEl, "winner");
        }
      }

      // Draw line to loser bracket (loser goes to losers bracket)
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

  // Get positions relative to the wrapper (which has the scale transform)
  // Since SVG is now in the same coordinate system, offsetLeft/offsetTop work correctly
  const sourceX = sourceEl.offsetLeft + sourceEl.offsetWidth;
  const sourceY = sourceEl.offsetTop + sourceEl.offsetHeight / 2;

  const targetX = targetEl.offsetLeft;
  const targetY = targetEl.offsetTop + targetEl.offsetHeight / 2;

  // Adjust Y position based on type (winner goes to top, loser to bottom of target)
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

const getMinimapScroll = (clientX: number, clientY: number) => {
  if (!bracketContainer.value || !minimapContainer.value)
    return { scrollLeft: 0, scrollTop: 0 };
  const minimap = minimapContainer.value;
  const container = bracketContainer.value;
  const rect = minimap.getBoundingClientRect();
  // Calculate the position within the minimap
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  // Calculate the scroll positions
  const scrollLeft =
    (x / minimap.clientWidth) * container.scrollWidth -
    container.clientWidth / 2;
  const scrollTop =
    (y / minimap.clientHeight) * container.scrollHeight -
    container.clientHeight / 2;
  return {
    scrollLeft: Math.max(
      0,
      Math.min(scrollLeft, container.scrollWidth - container.clientWidth),
    ),
    scrollTop: Math.max(
      0,
      Math.min(scrollTop, container.scrollHeight - container.clientHeight),
    ),
  };
};

const onMinimapPointerDown = (e: MouseEvent | TouchEvent) => {
  isDragging.value = true;
  document.body.style.userSelect = "none";
  moveViewport(e);
  window.addEventListener("mousemove", onMinimapPointerMove);
  window.addEventListener("touchmove", onMinimapPointerMove, {
    passive: false,
  });
  window.addEventListener("mouseup", onMinimapPointerUp);
  window.addEventListener("touchend", onMinimapPointerUp);
};

const onMinimapPointerMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return;
  moveViewport(e);
  if (e.cancelable) e.preventDefault();
};

const onMinimapPointerUp = () => {
  isDragging.value = false;
  document.body.style.userSelect = "";
  window.removeEventListener("mousemove", onMinimapPointerMove);
  window.removeEventListener("touchmove", onMinimapPointerMove);
  window.removeEventListener("mouseup", onMinimapPointerUp);
  window.removeEventListener("touchend", onMinimapPointerUp);
};

function moveViewport(e: MouseEvent | TouchEvent) {
  let clientX: number, clientY: number;
  if (e instanceof TouchEvent) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  const { scrollLeft, scrollTop } = getMinimapScroll(clientX, clientY);
  if (bracketContainer.value) {
    bracketContainer.value.scrollLeft = scrollLeft;
    bracketContainer.value.scrollTop = scrollTop;
  }
}

const onBracketPointerDown = (e: MouseEvent | TouchEvent) => {
  if (!bracketContainer.value) return;
  isBracketDragging.value = true;
  document.body.style.userSelect = "none";
  let clientX: number, clientY: number;
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
  let clientX: number, clientY: number;
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
  // Track last positions for velocity
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
  // Calculate velocity for momentum
  if (lastPositions.length >= 2 && bracketContainer.value) {
    const last = lastPositions[lastPositions.length - 1];
    const first = lastPositions[0];
    const dt = last.t - first.t || 1;
    momentumVelocity.x = ((last.x - first.x) / dt) * -1; // negative because drag direction
    momentumVelocity.y = ((last.y - first.y) / dt) * -1;
    startMomentum();
  }
};

function startMomentum() {
  if (!bracketContainer.value) return;
  let { scrollLeft, scrollTop } = bracketContainer.value;
  function step() {
    if (!bracketContainer.value) return;
    scrollLeft += momentumVelocity.x * 16; // 16ms per frame approx
    scrollTop += momentumVelocity.y * 16;
    // Boundaries
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
  <div class="relative" ref="bracketWrapper">
    <div
      class="tournament-bracket overflow-auto relative cursor-grab"
      :style="{
        maxHeight: maxHeight,
        minHeight: props.totalGroups > 1 ? '200px' : 'auto',
      }"
      ref="bracketContainer"
      @mousedown="onBracketPointerDown"
      @touchstart="onBracketPointerDown"
      :class="{ 'fullscreen-bracket': isFullscreen }"
    >
      <div
        class="bracket-content-wrapper"
        ref="bracketContentWrapper"
        :style="{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left',
        }"
      >
        <div
          class="grid grid-flow-col auto-cols-max gap-20 min-w-max"
          ref="bracketContent"
        >
          <div
            v-for="round of Array.from(props.rounds.keys())"
            class="flex flex-col bracket-column"
          >
            <!-- Round Label -->
            <div class="text-center mb-2">
              <div
                class="bg-gray-700 text-white rounded-lg px-4 py-2 shadow-md"
              >
                <span class="font-semibold text-sm">{{
                  roundLabels.get(round) || `Round ${round}`
                }}</span>
              </div>
            </div>

            <div class="flex flex-col justify-around flex-1">
              <TournamentMatch
                :round="Number(round)"
                :brackets="props.rounds.get(round) as any[]"
                :stage="props.stage"
                :tournament="props.tournament"
              ></TournamentMatch>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Zoom and Fullscreen Controls - Always Visible -->
    <div
      class="zoom-controls-container absolute top-4 right-4 z-50 flex flex-col gap-3 opacity-40 hover:opacity-100 transition-opacity duration-300 ease-in-out"
    >
      <!-- Zoom Controls -->
      <div
        class="flex flex-col gap-1.5 bg-gray-800/90 backdrop-blur-md rounded-lg p-2.5 shadow-xl border border-gray-700/50"
      >
        <button
          class="zoom-control-btn bg-gray-700/60 hover:bg-gray-600/80 active:bg-gray-500/90 text-white rounded-md p-2.5 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700/60 transition-all duration-200 ease-in-out flex items-center justify-center"
          @click="zoomIn"
          :disabled="zoomLevel >= MAX_ZOOM"
          title="Zoom In (Ctrl/Cmd + Scroll)"
        >
          <ZoomIn class="w-4 h-4" />
        </button>
        <button
          class="zoom-control-btn bg-gray-700/60 hover:bg-gray-600/80 active:bg-gray-500/90 text-white rounded-md p-2.5 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700/60 transition-all duration-200 ease-in-out flex items-center justify-center"
          @click="zoomOut"
          :disabled="zoomLevel <= MIN_ZOOM"
          title="Zoom Out (Ctrl/Cmd + Scroll)"
        >
          <ZoomOut class="w-4 h-4" />
        </button>
        <button
          class="zoom-control-btn bg-gray-700/60 hover:bg-gray-600/80 active:bg-gray-500/90 text-white rounded-md px-3 py-2 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-700/60 transition-all duration-200 ease-in-out text-xs font-medium min-w-[3rem] flex items-center justify-center"
          @click="resetZoom"
          :disabled="zoomLevel === 0.75"
          title="Reset Zoom"
        >
          {{ Math.round(zoomLevel * 100) }}%
        </button>
      </div>
      <!-- Fullscreen Control -->
      <button
        class="zoom-control-btn bg-gray-800/90 backdrop-blur-md hover:bg-gray-700/90 active:bg-gray-600/90 text-white rounded-lg p-2.5 shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-gray-700/50 transition-all duration-200 ease-in-out flex items-center justify-center"
        @click="toggleFullscreen"
        :title="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
      >
        <Maximize v-if="!isFullscreen" class="w-4 h-4" />
        <Minimize v-else class="w-4 h-4" />
      </button>
    </div>

    <!-- Minimap - Only shown when there are more than 4 rounds -->
    <div class="absolute top-4 right-24 z-40" v-if="rounds.size > 4">
      <!-- Minimap -->
      <div
        class="minimap-container cursor-grab w-80 h-56 bg-gray-700/70 rounded-sm overflow-hidden shadow-lg backdrop-blur-sm transition-all duration-200 ease-in-out relative"
        ref="minimapContainer"
        @mousedown="onMinimapPointerDown"
        @touchstart="onMinimapPointerDown"
      >
        <div
          class="minimap-preview absolute inset-0 pointer-events-none h-full"
        >
          <template
            v-for="(round, i) in Array.from(props.rounds.keys())"
            :key="'col-' + i"
          >
            <div
              class="minimap-column absolute top-0 bottom-0 mx-[8px]"
              :style="{
                left: `${(i / Array.from(props.rounds.keys()).length) * 100}%`,
                width: `${100 / Array.from(props.rounds.keys()).length}%`,
              }"
            >
              <div
                v-for="(_, index) in props.rounds.get(round) || []"
                class="minimap-match absolute w-full bg-white/40 rounded-sm transition-all duration-100 ease-out shadow-sm min-h-[4px] mb-1"
              ></div>
            </div>
          </template>
        </div>
        <!-- Blue viewport indicator rendered last for layering -->
        <div
          class="viewport-indicator absolute border-4 rounded-sm border-blue-400 bg-blue-400/5 cursor-pointer shadow-lg transition-all duration-100 ease-out z-[70]"
          ref="viewportIndicator"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tournament-bracket {
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  transition: max-height 0.3s ease-in-out;
}

.tournament-bracket::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.tournament-bracket::-webkit-scrollbar-track {
  background: transparent;
}

.tournament-bracket::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.tournament-bracket:active {
  cursor: grabbing;
}

.fullscreen-bracket {
  max-height: none !important;
  height: 100vh !important;
}

.bracket-content-wrapper {
  transition: transform 0.2s ease-out;
}

.zoom-control-btn {
  position: relative;
  overflow: hidden;
}

.zoom-control-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.zoom-control-btn:not(:disabled):active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.zoom-control-btn:not(:disabled)::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  transition: left 0.5s ease;
}

.zoom-control-btn:not(:disabled):hover::before {
  left: 100%;
}
</style>
