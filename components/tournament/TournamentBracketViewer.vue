<script lang="ts" setup>
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import { ref, onMounted, watch } from "vue";
import { useWindowSize } from "@vueuse/core";

const bracketContainer = ref<HTMLElement | null>(null);

onMounted(() => {
  requestAnimationFrame(drawConnectingLines);
});

const { width, height } = useWindowSize();

watch([width, height], () => {
  clearConnectingLines();
  requestAnimationFrame(drawConnectingLines);
});

const clearConnectingLines = () => {
  if (!bracketContainer.value) return;
  const container = bracketContainer.value as HTMLElement;
  const existingSvg = container.querySelector("svg");
  if (existingSvg) {
    existingSvg.remove();
  }
};

const redrawLines = () => {
  clearConnectingLines();
  requestAnimationFrame(drawConnectingLines);
};

// Expose redrawLines method to parent components if needed
defineExpose({ redrawLines });

const drawConnectingLines = () => {
  if (!bracketContainer.value) return;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";
  svg.style.pointerEvents = "none";

  const columns = (bracketContainer.value as HTMLElement).querySelectorAll(
    ".bracket-column",
  );

  for (let i = 0; i < columns.length - 1; i++) {
    const currentColumn = columns[i];
    const nextColumn = columns[i + 1];
    const currentMatches = currentColumn.querySelectorAll(".tournament-match");
    const nextMatches = nextColumn.querySelectorAll(".tournament-match");

    currentMatches.forEach((match, index) => {
      const matchEl = match as HTMLElement;
      const nextMatchEl = nextMatches[Math.floor(index / 2)] as HTMLElement;
      const startX = matchEl.offsetLeft + matchEl.offsetWidth;
      const startY = matchEl.offsetTop + matchEl.offsetHeight / 2;
      const endX = nextMatchEl.offsetLeft;
      const endY = nextMatchEl.offsetTop + nextMatchEl.offsetHeight / 2;
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
    });
  }

  bracketContainer.value.appendChild(svg);
};
</script>

<template>
  <div class="tournament-bracket" ref="bracketContainer">
    <div :class="`grid grid-cols-${rounds.size}`">
      <div
        v-for="round of Array.from(rounds.keys())"
        class="flex flex-col justify-around mr-20 bracket-column"
      >
        <TournamentMatch
          :round="round"
          :brackets="rounds.get(round)"
        ></TournamentMatch>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    rounds: {
      type: Map,
      required: true,
    },
  },
};
</script>
