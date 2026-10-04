<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { ChevronRight, Clock, LogIn, Swords } from "lucide-vue-next";
import { $, order_by } from "~/generated/zeus";
import { generateSubscription } from "~/graphql/graphqlGen";
import HorizontalScrollRow from "~/components/common/HorizontalScrollRow.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import ScrimRequestDialog from "~/components/team/ScrimRequestDialog.vue";
import TeamsEmblem from "~/components/teams/TeamsEmblem.vue";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { loginLinks } from "~/utilities/loginLinks";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{ myTeamIds: string[] }>();

const CAP = 12;

const { t, locale } = useI18n();
const { client } = useApolloClient();
const auth = useAuthStore();
const settings = useApplicationSettingsStore();

const postingsQuery = generateSubscription({
  team_scrim_settings: [
    {
      where: { enabled: { _eq: true } },
      order_by: [{ updated_at: order_by.desc }],
    },
    {
      id: true,
      team_id: true,
      regions: true,
      map_ids: true,
      notes: true,
      allow_outside_availability: true,
      team: {
        id: true,
        name: true,
        short_name: true,
        avatar_url: true,
        ranks: {
          avg_elo: true,
          avg_wingman_elo: true,
          avg_duel_elo: true,
          avg_rush_elo: true,
          min_elo: true,
          max_elo: true,
          avg_faceit_level: true,
          avg_faceit_elo: true,
          avg_premier: true,
          roster_size: true,
        },
        reputation: {
          scrims_completed: true,
          no_shows: true,
          reliability_pct: true,
        },
        scrim_availability: {
          starts_at: true,
          ends_at: true,
          recurring_weekly: true,
        },
      },
    },
  ],
} as any);

// Teams the viewer can send a request from: owned, or run as a roster Admin.
const managedTeamsQuery = generateSubscription({
  teams: [
    {
      where: {
        _or: [
          { owner_steam_id: { _eq: $("steamId", "bigint!") } },
          {
            roster: {
              _and: [
                { role: { _eq: "Admin" } },
                { player_steam_id: { _eq: $("steamId", "bigint!") } },
              ],
            },
          },
        ],
      },
    },
    { id: true },
  ],
} as any);

const postings = ref<any[]>([]);
const managedTeamIds = ref<string[]>([]);
let postingsSub: { unsubscribe: () => void } | undefined;
let managedSub: { unsubscribe: () => void } | undefined;

watch(
  () => settings.scrimFinderEnabled,
  (enabled) => {
    postingsSub?.unsubscribe();
    postingsSub = undefined;
    postings.value = [];
    if (!enabled || typeof window === "undefined") return;
    postingsSub = client.subscribe({ query: postingsQuery }).subscribe({
      next: ({ data }: any) => {
        postings.value = data?.team_scrim_settings ?? [];
      },
      error: (error: any) => {
        console.error("[teams] scrim postings subscription error", error);
      },
    });
  },
  { immediate: true },
);

watch(
  () => auth.me?.steam_id,
  (steamId) => {
    managedSub?.unsubscribe();
    managedSub = undefined;
    managedTeamIds.value = [];
    if (!steamId || typeof window === "undefined") return;
    managedSub = client
      .subscribe({ query: managedTeamsQuery, variables: { steamId } })
      .subscribe({
        next: ({ data }: any) => {
          managedTeamIds.value = (data?.teams ?? []).map(
            (team: any) => team.id,
          );
        },
        error: (error: any) => {
          console.error("[teams] managed teams subscription error", error);
        },
      });
  },
  { immediate: true },
);

const now = ref(new Date());
const clock =
  typeof window !== "undefined"
    ? setInterval(() => (now.value = new Date()), 60_000)
    : null;

onBeforeUnmount(() => {
  postingsSub?.unsubscribe();
  managedSub?.unsubscribe();
  if (clock) clearInterval(clock);
});

function sameDate(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function time(date: Date) {
  return date.toLocaleTimeString(locale.value, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// When a team plays: today's window if it has one, else the weekdays it
// posts, else "any time" (it takes requests outside posted hours).
function availability(posting: any): { label: string; today: boolean } {
  const windows: any[] = (posting.team?.scrim_availability ?? []).filter(
    (w: any) => w.recurring_weekly || new Date(w.ends_at) > now.value,
  );
  const today = windows.filter((w) => {
    const start = new Date(w.starts_at);
    return w.recurring_weekly
      ? start.getDay() === now.value.getDay()
      : sameDate(start, now.value);
  });
  if (today.length) {
    const starts = today.map((w) => new Date(w.starts_at));
    const ends = today.map((w) => new Date(w.ends_at));
    const first = starts.reduce((a, b) =>
      a.getHours() * 60 + a.getMinutes() <= b.getHours() * 60 + b.getMinutes()
        ? a
        : b,
    );
    const lastEnd = ends.reduce((a, b) =>
      a.getHours() * 60 + a.getMinutes() >= b.getHours() * 60 + b.getMinutes()
        ? a
        : b,
    );
    return {
      label: t("pages.teams.scrims.today", {
        from: time(first),
        to: time(lastEnd),
      }),
      today: true,
    };
  }
  if (windows.length) {
    const days = [
      ...new Set(windows.map((w) => new Date(w.starts_at).getDay())),
    ]
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      .map((day) =>
        // 2023-01-01 was a Sunday, so day 0..6 lands on the right weekday.
        new Date(2023, 0, 1 + day).toLocaleDateString(locale.value, {
          weekday: "short",
        }),
      );
    return { label: days.join(" · "), today: false };
  }
  return { label: t("pages.teams.scrims.any_time"), today: false };
}

const visible = computed(() =>
  postings.value
    .filter((posting) => !props.myTeamIds.includes(posting.team_id))
    .map((posting) => ({ posting, availability: availability(posting) }))
    .sort(
      (a, b) =>
        Number(b.availability.today) - Number(a.availability.today) ||
        (b.posting.team?.reputation?.reliability_pct ?? -1) -
          (a.posting.team?.reputation?.reliability_pct ?? -1) ||
        (a.posting.team?.name ?? "").localeCompare(b.posting.team?.name ?? ""),
    ),
);
const shown = computed(() => visible.value.slice(0, CAP));

function canRequest(posting: any) {
  return managedTeamIds.value.some((id) => id !== posting.team_id);
}

const dialogOpen = ref(false);
const selectedPosting = ref<any>(null);
function openRequest(posting: any) {
  selectedPosting.value = posting;
  dialogOpen.value = true;
}

function signIn() {
  window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(
    window.location.toString(),
  )}`;
}

function elo(posting: any) {
  const value = posting.team?.ranks?.avg_elo;
  return value != null ? Math.round(value).toLocaleString(locale.value) : null;
}

const touchTarget =
  "relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden";
const linkClasses =
  "relative inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] [@media(pointer:fine)]:after:hidden";
</script>

<template>
  <section
    v-if="settings.scrimFinderEnabled && visible.length"
    aria-labelledby="teams-scrims-label"
  >
    <div
      class="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2
          id="teams-scrims-label"
          :class="[tacticalSectionLabelClasses, '!mb-0']"
        >
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.teams.scrims.title") }}
        </h2>
        <span class="text-[12.5px] text-muted-foreground">
          {{ $t("pages.teams.scrims.subtitle") }}
        </span>
      </div>
      <NuxtLink to="/scrims" :class="linkClasses">
        {{ $t("pages.scrims.title") }}
        <ChevronRight class="size-3.5" />
      </NuxtLink>
    </div>

    <HorizontalScrollRow>
      <article
        v-for="{ posting, availability: avail } in shown"
        :key="posting.id"
        class="flex w-[17rem] shrink-0 snap-start flex-col gap-2.5 rounded-lg border border-border bg-muted/20 p-3.5"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <TeamsEmblem :team="posting.team" :size="36" />
          <div class="grid min-w-0">
            <NuxtLink
              :to="`/teams/${posting.team_id}`"
              class="truncate font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
              >{{ posting.team?.name }}</NuxtLink
            >
            <span class="truncate text-xs text-muted-foreground">
              {{ posting.regions?.join(" · ") || $t("scrim.any_region") }}
            </span>
          </div>
        </div>

        <p
          class="m-0 flex items-center gap-1.5 text-[13px]"
          :class="
            avail.today
              ? 'font-semibold text-[hsl(var(--tac-amber))]'
              : 'text-foreground/85'
          "
        >
          <Clock class="size-3.5 shrink-0" aria-hidden="true" />
          <span class="truncate">{{ avail.label }}</span>
        </p>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          <Badge
            v-if="posting.team?.reputation?.reliability_pct != null"
            variant="outline"
            :title="
              $t('team.rank_summary.reputation_title', {
                completed: posting.team.reputation.scrims_completed ?? 0,
                noShows: posting.team.reputation.no_shows ?? 0,
              })
            "
          >
            {{
              $t("team.rank_summary.reliable", {
                pct: posting.team.reputation.reliability_pct,
              })
            }}
          </Badge>
          <span v-if="elo(posting)" class="tabular-nums text-muted-foreground">
            <span class="font-semibold text-foreground">{{
              elo(posting)
            }}</span>
            {{ $t("common.avg") }}
          </span>
        </div>

        <div class="mt-auto pt-1">
          <Button
            v-if="!auth.me"
            size="sm"
            variant="outline"
            :class="['h-8 w-full gap-1.5', touchTarget]"
            @click="signIn"
          >
            <LogIn class="size-3.5" />
            {{ $t("pages.teams.scrims.sign_in_to_request") }}
          </Button>
          <Button
            v-else-if="canRequest(posting)"
            size="sm"
            variant="outline"
            :class="['h-8 w-full gap-1.5', touchTarget]"
            @click="openRequest(posting)"
          >
            <Swords class="size-3.5" />
            {{ $t("scrim.request_scrim") }}
          </Button>
          <FiveStackToolTip v-else as-child>
            <template #trigger>
              <span class="block w-full" tabindex="0">
                <Button
                  size="sm"
                  variant="outline"
                  class="h-8 w-full gap-1.5"
                  disabled
                >
                  <Swords class="size-3.5" />
                  {{ $t("scrim.request_scrim") }}
                </Button>
              </span>
            </template>
            {{ $t("pages.teams.scrims.need_team") }}
          </FiveStackToolTip>
        </div>
      </article>

      <div v-if="visible.length > CAP" class="flex shrink-0 snap-start">
        <NuxtLink
          to="/scrims"
          class="flex w-44 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border px-3 text-center text-[13px] text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
        >
          {{ $t("pages.teams.scrims.see_all") }}
          <ChevronRight class="size-4" aria-hidden="true" />
        </NuxtLink>
      </div>
    </HorizontalScrollRow>

    <ScrimRequestDialog v-model:open="dialogOpen" :posting="selectedPosting" />
  </section>
</template>
