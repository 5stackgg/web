<script lang="ts" setup>
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import { ref, onMounted, watch } from "vue";
import { useWindowSize } from "@vueuse/core";

const bracketContainer = ref(null);

onMounted(() => {
  drawConnectingLines();
});

const { width, height } = useWindowSize();

watch([width, height], () => {
  clearConnectingLines();
  drawConnectingLines();
});

const clearConnectingLines = () => {
  if (!bracketContainer.value) return;
  const existingSvg = bracketContainer.value.querySelector("svg");
  if (existingSvg) {
    existingSvg.remove();
  }
};

const redrawLines = () => {
  clearConnectingLines();
  drawConnectingLines();
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

  const columns = bracketContainer.value.querySelectorAll(".bracket-column");
  for (let i = 0; i < columns.length - 1; i++) {
    const currentColumn = columns[i];
    const nextColumn = columns[i + 1];
    const currentMatches = currentColumn.querySelectorAll(".tournament-match");
    const nextMatches = nextColumn.querySelectorAll(".tournament-match");

    currentMatches.forEach((match, index) => {
      const startX = match.offsetLeft + match.offsetWidth;
      const startY = match.offsetTop + match.offsetHeight / 2;
      const endX = nextMatches[Math.floor(index / 2)].offsetLeft;
      const endY =
        nextMatches[Math.floor(index / 2)].offsetTop +
        nextMatches[Math.floor(index / 2)].offsetHeight / 2;

      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.setAttribute("x1", startX.toString());
      line.setAttribute("y1", startY.toString());
      line.setAttribute("x2", endX.toString());
      line.setAttribute("y2", endY.toString());
      line.setAttribute("stroke", "white");
      line.setAttribute("stroke-width", "2");
      svg.appendChild(line);
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
          class="tournament-match"
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

<style lang="scss">
.tournament-bracket {
  position: relative;
}
</style>
