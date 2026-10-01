<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { Info } from "lucide-vue-next";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import {
  COMMUNITY_OPTIONAL,
  SERVER_LEADERBOARD_QUERY,
} from "~/graphql/communityGraphql";
import { useCommunityFormat } from "~/composables/useCommunityFormat";
import { useAuthStore } from "~/stores/AuthStore";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = withDefaults(
  defineProps<{
    serverId: string;
    limit?: number;
  }>(),
  { limit: 10 },
);

type Entry = {
  rank: number;
  steam_id: string | number;
  name: string;
  avatar_url: string | null;
  country: string | null;
  seconds: number;
  kills: number;
  deaths: number;
  sessions: number;
};

// The api rebuilds a leaderboard at most every two minutes, so this matches it.
const REFRESH_MS = 2 * 60 * 1000;

type Board = {
  period: string;
  metric: string;
  entries: Entry[];
  you: Entry | null;
};

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const format = useCommunityFormat();
const authStore = useAuthStore();
const apiDomain = useRuntimeConfig().public.apiDomain;

const period = ref<string>("week");
const metric = ref<string>("time");
const shown = ref<Board | null>(null);
const loaded = ref(false);
const grown = ref(false);
let generation = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const periodOptions = computed(() => [
  { key: "week", label: t("community.this_week") },
  { key: "all", label: t("community.all_time") },
]);

const metricOptions = computed(() => [
  { key: "time", label: t("community.leaderboard.by_time") },
  { key: "kills", label: t("community.leaderboard.by_kills") },
]);

// Follows the board on screen, not the toggle, so values never switch metric
// before the rows they belong to have arrived.
const byTime = computed(
  () => (shown.value?.metric ?? metric.value) === "time",
);

const shownPeriod = computed(() => shown.value?.period ?? period.value);

const valueOf = (entry: Entry) => (byTime.value ? entry.seconds : entry.kills);

const entries = computed(() =>
  [...(shown.value?.entries ?? [])].sort((a, b) => a.rank - b.rank),
);

const top = computed(() =>
  Math.max(1, ...entries.value.map((entry) => valueOf(entry))),
);

const myId = computed(() => {
  const you = shown.value?.you;

  return you ? String(you.steam_id) : (authStore.me?.steam_id ?? null);
});

const pinned = computed(() => {
  const you = shown.value?.you;

  if (!you) {
    return null;
  }

  return entries.value.some((entry) => String(entry.steam_id) === myId.value)
    ? null
    : you;
});

function isMe(entry: Entry) {
  return !!myId.value && String(entry.steam_id) === myId.value;
}

function width(entry: Entry) {
  if (!grown.value) {
    return "0%";
  }

  return `${Math.max(0, Math.min(1, valueOf(entry) / top.value)) * 100}%`;
}

function mainValue(entry: Entry) {
  return byTime.value
    ? format.played(entry.seconds)
    : format.count(entry.kills);
}

function subValue(entry: Entry) {
  return byTime.value
    ? format.count(entry.kills)
    : format.played(entry.seconds);
}

function avatar(entry: Entry) {
  return resolveAvatarUrl(entry.avatar_url, apiDomain);
}

async function load() {
  const variablesPeriod = period.value;
  const variablesMetric = metric.value;
  const request = ++generation;

  try {
    const { data } = await nuxtApp.$apollo.defaultClient.query({
      query: SERVER_LEADERBOARD_QUERY,
      variables: {
        serverId: props.serverId,
        period: variablesPeriod,
        metric: variablesMetric,
        limit: props.limit,
      },
      fetchPolicy: "network-only",
      context: COMMUNITY_OPTIONAL,
    });

    const board: Board = {
      period: variablesPeriod,
      metric: variablesMetric,
      entries: data?.getServerLeaderboard?.entries ?? [],
      you: data?.getServerLeaderboard?.you ?? null,
    };

    if (request === generation) {
      shown.value = board;
    }
  } catch {
    const sameBoard =
      shown.value?.period === variablesPeriod &&
      shown.value?.metric === variablesMetric;

    if (request === generation && !sameBoard) {
      shown.value = {
        period: variablesPeriod,
        metric: variablesMetric,
        entries: [],
        you: null,
      };
    }
  } finally {
    if (request === generation) {
      loaded.value = true;
    }
  }
}

watch([period, metric], () => {
  void load();
});

watch(
  () => props.serverId,
  () => {
    void load();
  },
);

onMounted(async () => {
  refreshTimer = setInterval(() => {
    void load();
  }, REFRESH_MS);

  await load();
  requestAnimationFrame(() => {
    grown.value = true;
  });
});

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
});

const gridClasses =
  "grid grid-cols-[1.875rem_minmax(0,1fr)_5rem] items-center gap-2.5 px-2.5 md:grid-cols-[2.75rem_minmax(7.5rem,13.75rem)_minmax(0,1fr)_5.75rem_5.25rem] md:gap-3 md:px-3.5";
</script>

<template>
  <section aria-labelledby="server-leaderboard">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2
        id="server-leaderboard"
        :class="[tacticalSectionLabelClasses, 'mb-0']"
      >
        <span :class="tacticalSectionTickClasses"></span>
        {{ $t("community.leaderboard.title") }}
      </h2>
      <div class="flex flex-wrap gap-2">
        <AnimatedFilters v-model="period" square :options="periodOptions" />
        <AnimatedFilters v-model="metric" square :options="metricOptions" />
      </div>
    </div>

    <div
      class="overflow-hidden rounded-lg border border-border"
      role="table"
      :aria-label="$t('community.leaderboard.title')"
    >
      <div
        role="row"
        :class="gridClasses"
        class="h-9 border-b border-border font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        <span role="columnheader">#</span>
        <span role="columnheader">{{ $t("community.recent.player") }}</span>
        <span role="columnheader" class="max-md:hidden"></span>
        <span role="columnheader" class="text-right">
          {{ byTime ? $t("community.time") : $t("community.kills") }}
        </span>
        <span role="columnheader" class="text-right max-md:hidden">
          {{ byTime ? $t("community.kills") : $t("community.time") }}
        </span>
      </div>

      <TransitionGroup
        tag="div"
        name="board-row"
        class="relative"
        data-testid="leaderboard-rows"
      >
        <div
          v-for="entry in entries"
          :key="String(entry.steam_id)"
          role="row"
          :class="[
            gridClasses,
            isMe(entry) && 'bg-[hsl(var(--tac-amber)/0.12)]',
          ]"
          class="h-12 border-b border-border last:border-b-0"
          :data-steam-id="String(entry.steam_id)"
          :data-you="isMe(entry) ? '' : undefined"
        >
          <span
            role="cell"
            class="font-mono text-sm font-bold tabular-nums"
            :class="
              entry.rank <= 3 ? 'text-foreground' : 'text-muted-foreground'
            "
          >
            {{ entry.rank }}
          </span>
          <span role="cell" class="flex min-w-0 items-center gap-2.5">
            <Avatar shape="square" class="h-7 w-7 shrink-0">
              <AvatarImage
                v-if="avatar(entry)"
                :src="avatar(entry) as string"
                :alt="entry.name"
              />
              <AvatarFallback class="text-[0.65rem] font-bold">
                {{ entry.name.slice(0, 2) }}
              </AvatarFallback>
            </Avatar>
            <NuxtLink
              :to="{
                name: 'players-id',
                params: { id: String(entry.steam_id) },
              }"
              class="truncate font-semibold transition-colors hover:text-[hsl(var(--tac-amber))]"
            >
              {{ entry.name }}
            </NuxtLink>
            <span
              v-if="isMe(entry)"
              class="shrink-0 rounded-sm bg-[hsl(var(--tac-amber))] px-1 py-0.5 font-mono text-[0.55rem] font-bold uppercase leading-none tracking-[0.12em] text-[hsl(var(--tac-amber-foreground))]"
            >
              {{ $t("community.leaderboard.you") }}
            </span>
          </span>
          <span
            role="cell"
            class="relative h-2.5 max-md:hidden"
            aria-hidden="true"
          >
            <span
              class="absolute inset-y-0 left-0 min-w-[3px] rounded-r transition-[width] duration-500 ease-out motion-reduce:transition-none"
              :class="
                isMe(entry)
                  ? 'bg-[hsl(var(--tac-amber))]'
                  : 'bg-muted-foreground/40'
              "
              :style="{ width: width(entry) }"
            />
          </span>
          <span
            role="cell"
            class="whitespace-nowrap text-right font-mono text-[0.8rem] font-semibold tabular-nums"
          >
            {{ mainValue(entry) }}
          </span>
          <span
            role="cell"
            class="whitespace-nowrap text-right font-mono text-xs tabular-nums text-muted-foreground max-md:hidden"
          >
            {{ subValue(entry) }}
          </span>
        </div>
      </TransitionGroup>

      <Transition
        enter-active-class="transition-opacity duration-300 motion-reduce:transition-none"
        leave-active-class="transition-opacity duration-200 motion-reduce:transition-none"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="pinned" data-testid="leaderboard-pinned">
          <div
            class="grid h-6 place-items-center border-y border-border font-mono text-[0.7rem] tracking-[0.3em] text-muted-foreground"
            aria-hidden="true"
          >
            · · ·
          </div>
          <div
            role="row"
            :class="gridClasses"
            class="h-12 bg-[hsl(var(--tac-amber)/0.12)]"
            :data-steam-id="String(pinned.steam_id)"
            data-you
          >
            <span
              role="cell"
              class="font-mono text-sm font-bold tabular-nums text-muted-foreground"
            >
              {{ pinned.rank }}
            </span>
            <span role="cell" class="flex min-w-0 items-center gap-2.5">
              <Avatar shape="square" class="h-7 w-7 shrink-0">
                <AvatarImage
                  v-if="avatar(pinned)"
                  :src="avatar(pinned) as string"
                  :alt="pinned.name"
                />
                <AvatarFallback class="text-[0.65rem] font-bold">
                  {{ pinned.name.slice(0, 2) }}
                </AvatarFallback>
              </Avatar>
              <NuxtLink
                :to="{
                  name: 'players-id',
                  params: { id: String(pinned.steam_id) },
                }"
                class="truncate font-semibold transition-colors hover:text-[hsl(var(--tac-amber))]"
              >
                {{ pinned.name }}
              </NuxtLink>
              <span
                class="shrink-0 rounded-sm bg-[hsl(var(--tac-amber))] px-1 py-0.5 font-mono text-[0.55rem] font-bold uppercase leading-none tracking-[0.12em] text-[hsl(var(--tac-amber-foreground))]"
              >
                {{ $t("community.leaderboard.you") }}
              </span>
            </span>
            <span
              role="cell"
              class="relative h-2.5 max-md:hidden"
              aria-hidden="true"
            >
              <span
                class="absolute inset-y-0 left-0 min-w-[3px] rounded-r bg-[hsl(var(--tac-amber))] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                :style="{ width: width(pinned) }"
              />
            </span>
            <span
              role="cell"
              class="whitespace-nowrap text-right font-mono text-[0.8rem] font-semibold tabular-nums"
            >
              {{ mainValue(pinned) }}
            </span>
            <span
              role="cell"
              class="whitespace-nowrap text-right font-mono text-xs tabular-nums text-muted-foreground max-md:hidden"
            >
              {{ subValue(pinned) }}
            </span>
          </div>
        </div>
      </Transition>

      <p
        v-if="loaded && entries.length === 0"
        class="py-8 text-center text-sm text-muted-foreground"
      >
        {{
          shownPeriod === "week"
            ? $t("community.leaderboard.empty_week")
            : $t("community.leaderboard.empty_all")
        }}
      </p>
    </div>

    <p class="mt-2.5 flex items-start gap-2 text-xs text-muted-foreground">
      <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {{ $t("community.leaderboard.footnote") }}
        <template v-if="!authStore.me">
          {{ $t("community.leaderboard.sign_in_hint") }}
        </template>
      </span>
    </p>
  </section>
</template>

<style scoped>
.board-row-enter-active {
  transition: opacity 0.3s ease;
}

.board-row-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  transition: opacity 0.2s ease;
}

.board-row-enter-from,
.board-row-leave-to {
  opacity: 0;
}

.board-row-move {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .board-row-enter-active,
  .board-row-leave-active,
  .board-row-move {
    transition: none;
  }
}
</style>
