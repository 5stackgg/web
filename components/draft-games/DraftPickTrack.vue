<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

type DraftPickCell = {
  no: number;
  lineup: number;
  state: "done" | "current" | "upcoming";
  name: string;
  avatar?: string | null;
  auto?: boolean;
};

const props = defineProps<{
  cells: Array<DraftPickCell>;
}>();

const scroller = ref<HTMLElement | null>(null);

watch(
  () => props.cells.findIndex((cell) => cell.state === "current"),
  async (index) => {
    await nextTick();
    const el = scroller.value;
    const cell = el?.querySelectorAll("li")[index];
    if (!el || !cell || el.scrollWidth <= el.clientWidth) {
      return;
    }
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo({
      left: cell.offsetLeft - (el.clientWidth - cell.offsetWidth) / 2,
      behavior: reduce ? "auto" : "smooth",
    });
  },
  { immediate: true },
);
</script>

<template>
  <div ref="scroller" class="pick-track-scroll">
    <ol
      class="pick-track"
      :style="{ '--cells': cells.length }"
      :aria-label="$t('draft_games.room.pick_order')"
    >
      <li
        v-for="cell in cells"
        :key="cell.no"
        class="pick-cell"
        :class="[`is-${cell.state}`, cell.lineup === 2 ? 'is-bravo' : '']"
        :aria-current="cell.state === 'current' ? 'step' : undefined"
      >
        <span class="flex items-center gap-1.5">
          <span class="pick-no">{{ String(cell.no).padStart(2, "0") }}</span>
          <span class="pick-team">T{{ cell.lineup }}</span>
          <span
            v-if="cell.auto"
            class="pick-auto"
            :title="$t('draft_games.room.auto_picked_hint')"
          >
            {{ $t("draft_games.room.auto_picked") }}
          </span>
        </span>
        <span class="flex min-w-0 items-center gap-1.5">
          <img
            v-if="cell.state === 'done' && cell.avatar"
            :src="cell.avatar"
            alt=""
            class="h-[18px] w-[18px] shrink-0 rounded object-cover"
          />
          <span class="pick-name truncate">{{ cell.name }}</span>
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.pick-track-scroll {
  position: relative;
  overflow-x: auto;
  scrollbar-width: none;
}
.pick-track-scroll::-webkit-scrollbar {
  display: none;
}
.pick-track {
  display: grid;
  grid-template-columns: repeat(var(--cells), minmax(5.75rem, 1fr));
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pick-cell {
  --team: var(--tac-amber);
  display: flex;
  min-width: 0;
  height: 3.6rem;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 0.5rem;
  border: 1px dashed hsl(var(--border));
  padding: 0.45rem 0.55rem;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}
.pick-cell.is-bravo {
  --team: var(--tac-blue);
}
.pick-cell.is-done {
  border-style: solid;
  background: hsl(var(--card) / 0.6);
}
.pick-cell.is-current {
  border-style: solid;
  border-color: hsl(var(--team));
  background: hsl(var(--team) / 0.12);
  box-shadow: 0 0 14px hsl(var(--team) / 0.25);
}
.pick-no {
  font-family: var(--font-mono, monospace);
  font-size: 0.62rem;
  font-weight: 700;
  color: hsl(var(--muted-foreground));
}
.pick-team {
  display: inline-grid;
  height: 0.95rem;
  place-items: center;
  border-radius: 0.2rem;
  border: 1px solid hsl(var(--team) / 0.5);
  padding: 0 0.25rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.55rem;
  font-weight: 700;
  color: hsl(var(--team));
}
.pick-auto {
  margin-left: auto;
  font-family: var(--font-mono, monospace);
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
.pick-name {
  font-size: 0.78rem;
  font-weight: 600;
}
.is-upcoming .pick-name {
  font-weight: 500;
  color: hsl(var(--muted-foreground) / 0.7);
}
.is-current .pick-name {
  color: hsl(var(--team));
}
.is-done .pick-name {
  animation: pick-land 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes pick-land {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pick-cell {
    transition: none;
  }
  .is-done .pick-name {
    animation: none;
  }
}
</style>
