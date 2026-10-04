<script setup lang="ts">
import { computed } from "vue";
import { NuxtLink } from "#components";
import { ChevronRight, Trophy } from "lucide-vue-next";
import TimeAgo from "~/components/TimeAgo.vue";
import { e_tournament_status_enum } from "~/generated/zeus";
import { useTournamentDisplay } from "~/composables/useTournamentDisplay";
import { rememberTournaments } from "~/composables/useTournamentPreview";

// One line of the /tournaments agenda: the start date, then what it is, then
// where it stands. A past tournament opens its page; one still to come opens
// the quick look, which carries the register action.
const props = defineProps<{ tournament: any }>();
const emit = defineEmits<{ (e: "quick-look"): void }>();

rememberTournaments([props.tournament]);

const {
  state,
  registrationOpen,
  bannerSrc,
  statusLabel,
  categories,
  sub,
  teamsLabel,
  champion,
  start,
} = useTournamentDisplay(() => props.tournament);

const past = computed(() => state.value === "finished");
const cancelled = computed(
  () =>
    past.value && props.tournament.status !== e_tournament_status_enum.Finished,
);

const day = computed(() =>
  start.value
    ? new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(start.value)
    : "—",
);
const weekdayMonth = computed(() =>
  start.value
    ? [
        new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
          start.value,
        ),
        new Intl.DateTimeFormat(undefined, { month: "short" }).format(
          start.value,
        ),
      ].join(" · ")
    : "",
);

const meta = computed(() =>
  [categories.value[0], teamsLabel.value, sub.value]
    .filter(Boolean)
    .join(" · "),
);
</script>

<template>
  <component
    :is="past ? NuxtLink : 'button'"
    v-bind="
      past
        ? { to: `/tournaments/${tournament.id}` }
        : {
            type: 'button',
            'aria-label': $t('quick_look.at', { name: tournament.name }),
          }
    "
    class="group/row grid w-full grid-cols-[3.25rem_6.5rem_minmax(0,1fr)_auto_1rem] items-center gap-3.5 rounded-lg border border-border bg-card/40 py-2 pl-2.5 pr-3 text-left transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.45)] hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:grid-cols-[3rem_minmax(0,1fr)_1rem] max-sm:gap-x-3 max-sm:gap-y-1.5"
    @click="!past && emit('quick-look')"
  >
    <span
      class="grid justify-items-center border-r border-border py-1 pr-3 leading-none max-sm:row-span-2"
    >
      <b class="text-[1.35rem] font-extrabold tabular-nums">{{ day }}</b>
      <span
        class="mt-1 whitespace-nowrap font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted-foreground"
        >{{ weekdayMonth }}</span
      >
    </span>

    <span
      class="block aspect-[3/1] overflow-hidden rounded-md bg-muted/40 max-sm:hidden"
    >
      <img
        v-if="bannerSrc"
        :src="bannerSrc"
        alt=""
        loading="lazy"
        class="h-full w-full object-cover"
        :class="{ 'brightness-[0.6] grayscale': cancelled }"
      />
    </span>

    <span class="grid min-w-0 gap-0.5">
      <b
        class="truncate text-[0.92rem] font-bold"
        :class="{ 'text-muted-foreground': cancelled }"
        >{{ tournament.name }}</b
      >
      <span
        class="truncate font-mono text-[0.64rem] tabular-nums text-muted-foreground"
        >{{ meta }}</span
      >
    </span>

    <span
      class="grid justify-items-end gap-1 max-sm:col-start-2 max-sm:row-start-2 max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-x-2.5"
    >
      <template v-if="past">
        <span
          v-if="champion"
          class="flex min-w-0 max-w-[12rem] items-center gap-1.5 text-xs font-semibold"
        >
          <Trophy class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]" />
          <span class="truncate">{{ champion }}</span>
        </span>
        <span v-else class="text-xs text-muted-foreground">{{
          statusLabel
        }}</span>
      </template>
      <template v-else>
        <span
          class="inline-flex h-[22px] items-center whitespace-nowrap rounded-md px-[7px] text-xs font-semibold ring-1 ring-inset"
          :class="
            registrationOpen
              ? 'text-[hsl(var(--tac-amber))] ring-[hsl(var(--tac-amber)/0.5)]'
              : 'text-foreground/85 ring-white/[0.12]'
          "
          >{{ statusLabel }}</span
        >
        <TimeAgo
          v-if="tournament.start"
          :date="tournament.start"
          hide-icon
          class="font-mono text-[0.64rem] text-foreground/70"
        />
      </template>
    </span>

    <ChevronRight
      class="h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover/row:translate-x-0.5 max-sm:col-start-3 max-sm:row-span-2 max-sm:row-start-1 motion-reduce:transition-none"
    />
  </component>
</template>
