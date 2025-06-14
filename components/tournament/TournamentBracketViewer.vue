<script lang="ts" setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import { Maximize, Minimize } from "lucide-vue-next";

interface TournamentRound {
  length: number;
  [key: number]: any;
}

const props = defineProps({
  rounds: {
    type: Map<number, TournamentRound>,
    required: true,
  },
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

onMounted(() => {
  if (bracketContainer.value) {
    bracketContainer.value.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", updateMinimap);
    updateMinimap();
  }
  document.addEventListener("fullscreenchange", onFullscreenChange);
});

onUnmounted(() => {
  if (bracketContainer.value) {
    bracketContainer.value.removeEventListener("scroll", handleScroll);
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

const clearConnectingLines = () => {
  if (!bracketContainer.value) return;
  const container = bracketContainer.value as HTMLElement;
  const existingSvg = container.querySelector("svg");
  if (existingSvg) {
    existingSvg.remove();
  }
};

const drawConnectingLines = () => {
  if (!bracketContainer.value) {
    return;
  }

  const container = bracketContainer.value as HTMLElement;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  // Set SVG dimensions to match the full content size of the container
  const containerRect = container.getBoundingClientRect();
  const fullWidth = container.scrollWidth;
  const fullHeight = container.scrollHeight;

  svg.setAttribute("width", fullWidth + "px");
  svg.setAttribute("height", fullHeight + "px");

  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";

  svg.style.pointerEvents = "none";

  const columns = container.querySelectorAll(".bracket-column");

  for (let i = 0; i < columns.length - 1; i++) {
    const currentColumn = columns[i];
    const nextColumn = columns[i + 1];

    const currentMatches = currentColumn.querySelectorAll(".tournament-match");
    const nextMatches = nextColumn.querySelectorAll(".tournament-match");

    for (let index = 0; index < currentMatches.length; index++) {
      const matchEl = currentMatches[index] as HTMLElement;

      const nextMatchEl = nextMatches[Math.floor(index / 2)] as HTMLElement;

      // TODO - how to calcualte this
      const margins = 12.5;

      const startX = matchEl.offsetLeft + matchEl.offsetWidth;
      const startY = matchEl.offsetTop + matchEl.offsetHeight / 2 - margins;

      const endX = nextMatchEl.offsetLeft;
      const endY =
        nextMatchEl.offsetTop + nextMatchEl.offsetHeight / 2 - margins;

      const midX = (startX + endX) / 2;

      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );

      path.setAttribute(
        "d",
        `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`,
      );

      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "white");
      path.setAttribute("stroke-width", "2");

      svg.appendChild(path);
    }
  }

  container.appendChild(svg);
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
      class="tournament-bracket overflow-auto relative max-h-[80vh] cursor-grab"
      ref="bracketContainer"
      @mousedown="onBracketPointerDown"
      @touchstart="onBracketPointerDown"
      :class="{ 'fullscreen-bracket': isFullscreen }"
    >
      <div class="grid grid-flow-col auto-cols-max gap-20 min-w-max">
        <div
          v-for="round of Array.from(props.rounds.keys())"
          class="flex flex-col justify-around bracket-column"
        >
          <TournamentMatch
            :round="Number(round)"
            :brackets="props.rounds.get(round) as any[]"
          ></TournamentMatch>
        </div>
        <div class="flex flex-col justify-around bracket-column">
          <div class="tournament-match">
            <div class="items-center mx-4">
              <div
                class="bg-gray-600 text-gray-300 rounded-lg p-3 shadow-md -mt-6"
              >
                <span class="font-bold text-xl"> </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Minimap and Controls Group -->
    <div
      class="absolute top-4 right-24 flex flex-row items-start z-50 space-x-2"
      v-if="rounds.size > 4"
    >
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
        <!-- Controls -->
        <div class="absolute top-2 right-2 z-[80]">
          <button
            class="bg-secondary hover:bg-background/80 text-white rounded p-2 shadow-lg focus:outline-none"
            @click="toggleFullscreen"
            :title="isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'"
          >
            <Maximize v-if="!isFullscreen" class="w-5 h-5" />
            <Minimize v-else class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tournament-bracket {
  position: relative;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
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
</style>
