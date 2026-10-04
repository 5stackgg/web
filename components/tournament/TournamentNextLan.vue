<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { MapPin, Trophy, Users } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { useAuthStore } from "~/stores/AuthStore";
import { loginLinks } from "~/utilities/loginLinks";
import { useTournamentDisplay } from "~/composables/useTournamentDisplay";

// `hero` is for when it's the only thing on the page: the full card
// instead of the slim strip that sits above a live tournament.
const props = defineProps<{ tournament: any; hero?: boolean }>();
defineEmits<{ (e: "quick-look"): void }>();

const { t } = useI18n();
const {
  registrationOpen,
  bannerSrc,
  statusLabel,
  start,
  startDay,
  startTime,
  teamsLabel,
  spotsLeft,
  maxTeams,
  teams,
  categories,
  sub,
  prizePool,
} = useTournamentDisplay(() => props.tournament);

const longDay = computed(() =>
  start.value
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(start.value)
    : null,
);

const path = computed(() => `/tournaments/${props.tournament.id}`);
const isGuest = computed(() => !useAuthStore().me?.steam_id);
const canRegister = computed(
  () => registrationOpen.value && !props.tournament.invite_only,
);

const until = computed(() => {
  if (!start.value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(start.value);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return t("pages.tournaments.next_lan.today");
  if (days === 1) return t("pages.tournaments.next_lan.tomorrow");
  return t("pages.tournaments.next_lan.in_days", { count: days }, days);
});

const month = computed(() =>
  start.value
    ? new Intl.DateTimeFormat(undefined, { month: "short" }).format(start.value)
    : null,
);

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}
</script>

<template>
  <article
    v-if="hero"
    class="grid overflow-hidden rounded-lg border border-[hsl(var(--tac-amber)/0.35)] bg-card/40 lg:grid-cols-[minmax(0,1fr)_21rem]"
  >
    <div
      class="relative isolate flex min-h-[18rem] items-end px-4 pb-5 pt-28 sm:px-6 sm:pb-6"
    >
      <img
        v-if="bannerSrc"
        :src="bannerSrc"
        alt=""
        class="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_40%]"
      />
      <div aria-hidden="true" class="hero-scrim absolute inset-0 -z-10"></div>
      <div class="grid min-w-0 max-w-[40rem] gap-2.5">
        <p
          class="m-0 flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-foreground/80"
        >
          <span class="font-semibold text-[hsl(var(--tac-amber))]">
            {{ $t("pages.tournaments.sections.next_lan") }}
          </span>
          <template v-if="statusLabel">
            <span aria-hidden="true">·</span>
            <span>{{ statusLabel }}</span>
          </template>
          <template v-for="category in categories" :key="category">
            <span aria-hidden="true">·</span>
            <span>{{ category }}</span>
          </template>
        </p>
        <h2
          class="m-0 text-[clamp(1.875rem,3.4vw,3rem)] font-extrabold leading-none [text-wrap:balance]"
        >
          <NuxtLink
            :to="path"
            class="hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {{ tournament.name }}
          </NuxtLink>
        </h2>
        <p class="m-0 text-[0.8125rem] text-foreground/75">{{ sub }}</p>
      </div>
    </div>

    <aside
      class="flex flex-col gap-4 border-t border-border bg-muted/15 p-5 lg:border-l lg:border-t-0"
    >
      <div v-if="start" class="flex items-center gap-3.5">
        <div
          class="grid h-[3.75rem] w-14 shrink-0 place-content-center justify-items-center gap-0.5 rounded-md bg-[hsl(var(--tac-amber)/0.12)] leading-none"
        >
          <span
            class="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
          >
            {{ month }}
          </span>
          <span class="text-2xl font-bold tabular-nums">{{
            start.getDate()
          }}</span>
        </div>
        <div class="min-w-0">
          <b class="block text-base font-bold leading-tight">{{ longDay }}</b>
          <span class="text-[0.8125rem] text-muted-foreground">
            {{ startTime }}<template v-if="until"> · {{ until }}</template>
          </span>
        </div>
      </div>

      <ul class="m-0 grid list-none gap-2.5 p-0 text-[0.8125rem] text-foreground/85">
        <li
          v-if="tournament.location"
          class="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2"
        >
          <MapPin class="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
          <span>{{ tournament.location }}</span>
        </li>
        <li class="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2">
          <Users class="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
          <span class="tabular-nums">
            {{ teamsLabel }}
            <template v-if="registrationOpen && maxTeams > 0">
              ·
              {{ $t("pages.tournaments.spots_left", { count: spotsLeft }, spotsLeft) }}
            </template>
          </span>
        </li>
        <li
          v-if="prizePool"
          class="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2"
        >
          <Trophy class="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
          <span>{{ $t("pages.watch.events.in_prizes", { amount: prizePool }) }}</span>
        </li>
      </ul>

      <div
        v-if="maxTeams > 0"
        class="h-1 overflow-hidden rounded-full bg-muted"
        role="presentation"
      >
        <div
          class="h-full bg-[hsl(var(--tac-amber))]"
          :style="{ width: `${Math.min(teams / maxTeams, 1) * 100}%` }"
        ></div>
      </div>

      <div class="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <template v-if="canRegister">
          <Button
            v-if="isGuest"
            size="sm"
            class="h-9 flex-1 border border-[hsl(var(--tac-amber)/0.55)] bg-transparent text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.1)]"
            @click="signIn"
          >
            {{ $t("pages.watch.tournaments.sign_in_to_register") }}
          </Button>
          <Button
            v-else
            as-child
            size="sm"
            class="h-9 flex-1 bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
          >
            <NuxtLink :to="path">
              {{ $t("pages.watch.tournaments.register") }}
            </NuxtLink>
          </Button>
        </template>
        <span
          v-else
          class="flex-1 text-[0.8125rem] font-semibold text-[hsl(var(--tac-amber))]"
        >
          {{ statusLabel }}
        </span>
        <Button
          size="sm"
          variant="secondary"
          class="h-9"
          @click="$emit('quick-look')"
        >
          {{ $t("pages.watch.tournaments.details") }}
        </Button>
      </div>
    </aside>
  </article>

  <article
    v-else
    class="relative isolate overflow-hidden rounded-lg border border-[hsl(var(--tac-amber)/0.35)] bg-card/40"
  >
    <img
      v-if="bannerSrc"
      :src="bannerSrc"
      alt=""
      class="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_40%]"
    />
    <div aria-hidden="true" class="scrim absolute inset-0 -z-10"></div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-3 p-3 sm:px-4">
      <div
        v-if="start"
        class="grid h-[3.25rem] w-12 shrink-0 place-content-center justify-items-center gap-0.5 rounded-md bg-[hsl(var(--tac-amber)/0.12)] leading-none"
      >
        <span
          class="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--tac-amber))]"
        >
          {{ month }}
        </span>
        <span class="text-xl font-bold tabular-nums">{{ start.getDate() }}</span>
      </div>

      <div class="grid min-w-0 flex-1 basis-56 gap-0.5">
        <p
          class="m-0 flex flex-wrap items-center gap-x-1.5 text-xs text-foreground/75"
        >
          <span class="font-semibold text-[hsl(var(--tac-amber))]">
            {{ $t("pages.tournaments.sections.next_lan") }}
          </span>
          <span aria-hidden="true">·</span>
          <span>{{ startDay }} · {{ startTime }}</span>
          <template v-if="until">
            <span aria-hidden="true">·</span>
            <span>{{ until }}</span>
          </template>
        </p>
        <h2 class="m-0 truncate text-base font-bold leading-tight">
          <NuxtLink
            :to="path"
            class="hover:underline hover:underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {{ tournament.name }}
          </NuxtLink>
        </h2>
        <p class="m-0 truncate text-[0.8125rem] text-foreground/70">
          <template v-if="tournament.location"
            >{{ tournament.location }} ·
          </template>
          <span class="tabular-nums">{{ teamsLabel }}</span>
          <template v-if="registrationOpen && maxTeams > 0">
            ·
            {{ $t("pages.tournaments.spots_left", { count: spotsLeft }, spotsLeft) }}
          </template>
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <template v-if="canRegister">
          <Button
            v-if="isGuest"
            size="sm"
            class="h-8 border border-[hsl(var(--tac-amber)/0.55)] bg-transparent text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.1)]"
            @click="signIn"
          >
            {{ $t("pages.watch.tournaments.sign_in_to_register") }}
          </Button>
          <Button
            v-else
            as-child
            size="sm"
            class="h-8 bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
          >
            <NuxtLink :to="path">
              {{ $t("pages.watch.tournaments.register") }}
            </NuxtLink>
          </Button>
        </template>
        <span
          v-else
          class="text-[0.8125rem] font-semibold text-[hsl(var(--tac-amber))]"
        >
          {{ statusLabel }}
        </span>
        <Button
          size="sm"
          variant="secondary"
          class="h-8"
          @click="$emit('quick-look')"
        >
          {{ $t("pages.watch.tournaments.details") }}
        </Button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.hero-scrim {
  background:
    linear-gradient(
      90deg,
      hsl(240 10% 2% / 0.92) 0%,
      hsl(240 10% 2% / 0.62) 55%,
      hsl(240 10% 2% / 0.2) 100%
    ),
    linear-gradient(180deg, transparent 40%, hsl(240 10% 2% / 0.72));
}
.scrim {
  background: linear-gradient(
    90deg,
    hsl(240 10% 2% / 0.95) 0%,
    hsl(240 10% 2% / 0.8) 55%,
    hsl(240 10% 2% / 0.5) 100%
  );
}
</style>
