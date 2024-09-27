<script lang="ts" setup>
import { ref, watch } from "vue";
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";

const props = defineProps({
  rounds: {
    type: Map,
    required: true,
  },
});

watch(
  () => props.rounds,
  () => {
    nextTick(() => {
      clearConnectingLines();
      requestAnimationFrame(() => {
        drawConnectingLines();
      });
    });
  },
  { deep: true, immediate: true },
);

const bracketContainer = ref<HTMLElement | null>(null);

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
</script>

<template>
  <div
    class="tournament-bracket overflow-x-auto relative"
    ref="bracketContainer"
  >
    <div class="grid grid-flow-col auto-cols-max gap-20 min-w-max">
      <div
        v-for="round of Array.from(props.rounds.keys())"
        class="flex flex-col justify-around bracket-column"
      >
        <TournamentMatch
          :round="round"
          :brackets="props.rounds.get(round)"
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
</template>
