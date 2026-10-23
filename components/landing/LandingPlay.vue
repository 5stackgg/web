<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useResizeObserver } from "@vueuse/core";
import { Play } from "lucide-vue-next";
import PlayModeTile from "~/components/play/PlayModeTile.vue";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import { Button } from "~/components/ui/button";
import { e_match_types_enum } from "~/generated/zeus";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";
import { signInWithSteam } from "~/utilities/loginLinks";
import {
  EXPECTED_PLAYERS,
  canPartyQueue,
} from "~/utilities/matchmakingPartySize";

const PARTY = 2;
const IN_QUEUE: Partial<Record<e_match_types_enum, number>> = {
  [e_match_types_enum.Competitive]: 42,
  [e_match_types_enum.Wingman]: 12,
  [e_match_types_enum.Duel]: 6,
  [e_match_types_enum.Rush]: 9,
};

const settings = useApplicationSettingsStore();
const auth = useAuthStore();

const modes = computed(() =>
  [
    e_match_types_enum.Competitive,
    e_match_types_enum.Wingman,
    e_match_types_enum.Duel,
    e_match_types_enum.Rush,
  ]
    .filter((type) => settings.isMatchmakingTypeEnabled(type))
    .map((type) => ({
      type,
      key: type.toLowerCase(),
      expected: EXPECTED_PLAYERS[type] ?? 0,
      inQueue: IN_QUEUE[type] ?? 0,
      canQueue: canPartyQueue(type, PARTY),
    })),
);

const selected = ref<e_match_types_enum>(e_match_types_enum.Competitive);

const grid = ref<HTMLElement | null>(null);
const frame = ref({ x: 0, y: 0, w: 0, h: 0 });
const frameShown = ref(false);
const frameGlides = ref(false);

function placeFrame(glide: boolean) {
  const index = modes.value.findIndex((mode) => mode.type === selected.value);
  const tile =
    index < 0
      ? null
      : grid.value?.querySelectorAll<HTMLElement>('[role="radio"]')[index];
  if (!tile) {
    frameShown.value = false;
    return;
  }
  frameGlides.value = glide && frameShown.value;
  frame.value = {
    x: tile.offsetLeft,
    y: tile.offsetTop,
    w: tile.offsetWidth,
    h: tile.offsetHeight,
  };
  frameShown.value = true;
}

watch(selected, () => nextTick(() => placeFrame(true)));
onMounted(() => placeFrame(false));
useResizeObserver(grid, () => placeFrame(false));

function onModeKey(event: KeyboardEvent) {
  const forward = ["ArrowRight", "ArrowDown"].includes(event.key);
  const back = ["ArrowLeft", "ArrowUp"].includes(event.key);
  if (!forward && !back) return;
  event.preventDefault();
  const list = modes.value;
  const index = list.findIndex((mode) => mode.type === selected.value);
  const next = (index + (forward ? 1 : -1) + list.length) % list.length;
  selected.value = list[next].type;
  grid.value?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
}

function findMatch() {
  if (auth.me) {
    void navigateTo("/play");
  } else {
    signInWithSteam();
  }
}
</script>

<template>
  <div
    class="rounded-lg border border-border bg-[linear-gradient(180deg,hsl(var(--muted)/0.22),hsl(var(--muted)/0.06))] p-[18px] max-sm:p-3.5"
  >
    <div
      ref="grid"
      role="radiogroup"
      :aria-label="$t('pages.welcome.play.modes_label')"
      class="relative grid grid-cols-2 gap-3 max-sm:gap-2"
      @keydown="onModeKey"
    >
      <PlayModeTile
        v-for="mode in modes"
        :key="mode.type"
        :title="$t(`matchmaking.match_types.${mode.key}.title`)"
        :description="$t(`matchmaking.match_types.${mode.key}.description`)"
        :expected="mode.expected"
        :in-queue="mode.inQueue"
        :party="PARTY"
        :can-queue="mode.canQueue"
        :selected="mode.type === selected"
        :tab-stop="mode.type === selected"
        :locked="false"
        @select="selected = mode.type"
      />
      <span
        aria-hidden="true"
        class="pointer-events-none absolute left-0 top-0 z-10 rounded-lg shadow-[inset_0_0_0_2px_hsl(var(--tac-amber))] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        :class="[
          frameShown ? 'opacity-100' : 'opacity-0',
          frameGlides
            ? 'transition-[transform,width,height,opacity]'
            : 'transition-opacity',
        ]"
        :style="{
          transform: `translate3d(${frame.x}px, ${frame.y}px, 0)`,
          width: `${frame.w}px`,
          height: `${frame.h}px`,
        }"
      ></span>
    </div>
    <div
      class="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border/70 pt-4"
    >
      <p class="m-0 text-[13px] text-foreground/75">
        {{ $t("pages.welcome.play.party_line") }}
      </p>
      <Button
        class="h-11 min-w-[188px] gap-2 px-[22px] text-[15px] font-semibold bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)] max-sm:min-w-0 max-sm:flex-1"
        @click="findMatch"
      >
        <template v-if="auth.me">
          <Play class="size-4 fill-current" />
          {{ $t("pages.play.matchmaking.find_match") }}
        </template>
        <template v-else>
          <SteamIcon class="size-4" />
          {{ $t("pages.play.matchmaking.sign_in") }}
        </template>
      </Button>
    </div>
  </div>
</template>
