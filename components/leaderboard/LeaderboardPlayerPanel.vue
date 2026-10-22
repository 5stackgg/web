<script setup lang="ts">
import gql from "graphql-tag";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { ArrowUp, Trophy, UserRound, X } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import LeaderboardYouTag from "~/components/leaderboard/LeaderboardYouTag.vue";
import StatChevron from "~/components/StatChevron.vue";
import { Button } from "~/components/ui/button";
import { tierFor } from "~/utils/eloTier";
import {
  AWARD_COLORS,
  LEADERBOARD_CATEGORIES,
  PLACE_COLORS,
  formatLeaderboardField,
  formatLeaderboardValue,
  leaderboardFieldColor,
  leaderboardFieldTier,
  leaderboardOrderBy,
  type LeaderboardEntry,
  type LeaderboardField,
} from "~/utilities/leaderboard";

export type LeaderboardPanelPlayer = {
  steam_id: string;
  name: string;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  country: string | null;
};

export type LeaderboardFilters = {
  window_days: number;
  season_id: string | null;
  match_type: string | null;
  exclude_tournaments: boolean;
  role: string | null;
  source: string;
};

const props = withDefaults(
  defineProps<{
    player: LeaderboardPanelPlayer;
    category: string;
    categories: string[];
    // The player's row on this board, when it's on the page shown.
    entry: LeaderboardEntry | null;
    entries: LeaderboardEntry[];
    total: number;
    filters: LeaderboardFilters;
    isMe?: boolean;
    closable?: boolean;
  }>(),
  { isMe: false, closable: true },
);

const emit = defineEmits<{
  close: [];
  board: [category: string, rank: number | null];
}>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

type BoardRank = { rank: number; total: number; value: number };

const RANK_FIELDS = "rank total value";

// One request for the player's rank on every board. The rank lookup has no
// role argument, so these are role-less ranks.
const boardRanks = ref<Record<string, BoardRank | null>>({});
const boardRanksLoading = ref(false);
let boardRanksGen = 0;

const rankFilters = computed(() => ({
  window_days: props.filters.window_days,
  season_id: props.filters.season_id,
  match_type: props.filters.match_type,
  exclude_tournaments: props.filters.exclude_tournaments,
  source: props.filters.source,
}));

async function fetchBoardRanks() {
  const gen = ++boardRanksGen;
  boardRanksLoading.value = true;
  const cats = props.categories;
  const query = gql`
    query LeaderboardPlayerBoards(
      $window_days: Int!
      $match_type: String
      $exclude_tournaments: Boolean!
      $season_id: uuid
      $source: String
      $player_steam_id: String!
    ) {
      ${cats
        .map(
          (cat) => `${cat}: get_player_leaderboard_rank(
        args: {
          _category: "${cat}"
          _window_days: $window_days
          _match_type: $match_type
          _exclude_tournaments: $exclude_tournaments
          _season_id: $season_id
          _source: $source
          _player_steam_id: $player_steam_id
        }
      ) { ${RANK_FIELDS} }`,
        )
        .join("\n")}
    }
  `;
  try {
    const { data } = await apolloClient.query({
      query,
      variables: {
        ...rankFilters.value,
        player_steam_id: props.player.steam_id,
      },
      fetchPolicy: "cache-first",
    });
    if (gen !== boardRanksGen) return;
    const next: Record<string, BoardRank | null> = {};
    for (const cat of cats) {
      const row = (data as any)?.[cat]?.[0];
      next[cat] = row
        ? {
            rank: Number(row.rank),
            total: Number(row.total),
            value: Number(row.value),
          }
        : null;
    }
    boardRanks.value = next;
  } catch (error) {
    if (gen !== boardRanksGen) return;
    console.error("Error fetching leaderboard ranks:", error);
    boardRanks.value = {};
  } finally {
    if (gen === boardRanksGen) boardRanksLoading.value = false;
  }
}

watch(
  [
    () => props.player.steam_id,
    () => JSON.stringify(rankFilters.value),
    () => props.categories.join(),
  ],
  ([steamId], previous) => {
    if (steamId !== previous?.[0]) boardRanks.value = {};
    void fetchBoardRanks();
  },
  { immediate: true },
);

// Where the player stands on the board shown: their row when it's on the
// page (it carries the role filter), else the every-board lookup.
const standing = computed(() => {
  if (props.entry) {
    return {
      rank: props.entry.rank,
      value: props.entry.value,
      total: props.total,
      fromList: true,
    };
  }
  const r = boardRanks.value[props.category];
  return r ? { ...r, fromList: false } : null;
});

const isAwards = computed(() => props.category === "awards");
const categoryLabel = computed(() =>
  t(`pages.leaderboard.categories.${props.category}`),
);

// The player one place up (or #2, for the leader) for the gap line. Usually
// on the page already; the first row of a later page asks for its neighbour.
const fetchedNeighbor = ref<{ key: string; entry: LeaderboardEntry } | null>(
  null,
);
let neighborGen = 0;
const neighborRank = computed(() => {
  const s = standing.value;
  if (!s || isAwards.value) return null;
  return s.rank === 1 ? 2 : s.rank - 1;
});
const neighborKey = computed(
  () =>
    `${props.category}|${JSON.stringify(props.filters)}|${neighborRank.value}`,
);
const neighbor = computed(() => {
  const rank = neighborRank.value;
  if (!rank) return null;
  return (
    props.entries.find((e) => e.rank === rank) ??
    (fetchedNeighbor.value?.key === neighborKey.value
      ? fetchedNeighbor.value.entry
      : null)
  );
});

const NEIGHBOR_QUERY = gql`
  query LeaderboardNeighbor(
    $category: String!
    $window_days: Int!
    $match_type: String
    $exclude_tournaments: Boolean!
    $role: String
    $season_id: uuid
    $source: String
    $offset: Int
    $order_by: [leaderboard_entries_order_by!]
  ) {
    get_leaderboard(
      args: {
        _category: $category
        _window_days: $window_days
        _match_type: $match_type
        _exclude_tournaments: $exclude_tournaments
        _role: $role
        _season_id: $season_id
        _source: $source
      }
      limit: 1
      offset: $offset
      order_by: $order_by
    ) {
      player_steam_id
      player_name
      value
    }
  }
`;

watch(
  [neighborKey, () => props.entries],
  async ([key]) => {
    const gen = ++neighborGen;
    const rank = neighborRank.value;
    const s = standing.value;
    if (!rank || !s || props.entries.some((e) => e.rank === rank)) return;
    if (fetchedNeighbor.value?.key === key) return;
    // A rank from the role-less lookup doesn't index the role-filtered board.
    if (!s.fromList && props.filters.role) return;
    if (s.rank === 1 && s.total < 2) return;
    try {
      const { data } = await apolloClient.query({
        query: NEIGHBOR_QUERY,
        variables: {
          category: props.category,
          ...props.filters,
          offset: rank - 1,
          order_by: leaderboardOrderBy(props.category),
        },
        fetchPolicy: "cache-first",
      });
      if (gen !== neighborGen) return;
      const row = (data as any)?.get_leaderboard?.[0];
      fetchedNeighbor.value = row
        ? {
            key,
            entry: { ...row, rank, value: Number(row.value) },
          }
        : null;
    } catch {
      if (gen === neighborGen) fetchedNeighbor.value = null;
    }
  },
  { immediate: true },
);

const gap = computed(() => {
  const s = standing.value;
  if (!s || isAwards.value) return null;
  const n = neighbor.value;
  if (s.rank === 1) {
    if (s.total < 2)
      return { icon: Trophy, text: t("pages.leaderboard.panel.only_player") };
    if (!n) return null;
    return {
      icon: Trophy,
      text: t("pages.leaderboard.panel.leads", {
        rank: n.rank,
        name: n.player_name,
        gap: gapValue(s.value - n.value),
      }),
    };
  }
  if (!n) return null;
  const diff = n.value - s.value;
  return {
    icon: ArrowUp,
    text:
      Math.abs(diff) < 1e-9
        ? t("pages.leaderboard.panel.tied", {
            rank: n.rank,
            name: n.player_name,
          })
        : t("pages.leaderboard.panel.behind", {
            rank: n.rank,
            name: n.player_name,
            gap: gapValue(diff),
          }),
  };
});

function gapValue(diff: number) {
  const value = formatLeaderboardValue(props.category, Math.abs(diff));
  return props.category === "elo" || props.category === "faceit_elo"
    ? `${value} ${t("pages.leaderboard.categories.elo")}`
    : value;
}

// The board's other columns for this player, under the headline figure.
const extraFields = computed<LeaderboardField[]>(() => {
  const columns = LEADERBOARD_CATEGORIES[props.category]?.columns ?? {};
  const fields: LeaderboardField[] = isAwards.value
    ? ["value", "secondary_value", "tertiary_value"]
    : ["secondary_value", "tertiary_value"];
  return fields.filter((field) => columns[field]);
});

function columnLabel(field: LeaderboardField) {
  const key = LEADERBOARD_CATEGORIES[props.category]?.columns[field];
  return key ? t(key) : "";
}

const headline = computed(() => {
  const s = standing.value;
  if (!s) return null;
  if (isAwards.value) {
    const mvps = props.entry?.matches_played;
    return {
      text: mvps != null ? String(mvps) : "—",
      color: AWARD_COLORS.mvp,
      label: t("pages.leaderboard.col.mvp"),
    };
  }
  return {
    text: formatLeaderboardValue(props.category, s.value),
    color: leaderboardFieldColor(props.category, "value", s.value),
    label: columnLabel("value"),
  };
});

const eloTier = computed(() =>
  props.category === "elo" && standing.value
    ? tierFor(standing.value.value)
    : null,
);

const matchesPlayed = computed(() =>
  !isAwards.value &&
  LEADERBOARD_CATEGORIES[props.category]?.columns.matches_played &&
  props.entry?.matches_played != null
    ? props.entry.matches_played
    : null,
);

function topPercent(r: BoardRank) {
  return Math.max(1, Math.round(((r.rank - 0.5) / r.total) * 100));
}

function percentile(r: BoardRank) {
  return Math.max(3, (1 - (r.rank - 1) / r.total) * 100);
}
</script>

<template>
  <div class="relative">
    <div class="flex items-center gap-3 p-4" :class="closable && 'pr-12'">
      <PlayerDisplay
        class="min-w-0 flex-1"
        :player="player"
        :show-elo="false"
        :show-online="false"
        :show-role="false"
        linkable
        truncate-name
      >
        <template #name-postfix>
          <LeaderboardYouTag v-if="isMe" />
        </template>
        <template #elo-postfix>
          <span
            v-if="eloTier || matchesPlayed != null"
            class="truncate text-xs text-muted-foreground"
          >
            <span v-if="eloTier" :style="{ color: `rgb(${eloTier.rgb})` }">{{
              eloTier.label
            }}</span>
            <template v-if="eloTier && matchesPlayed != null"> · </template>
            <template v-if="matchesPlayed != null">{{
              $t("pages.leaderboard.matches_count", matchesPlayed)
            }}</template>
          </span>
        </template>
      </PlayerDisplay>
      <button
        v-if="closable"
        type="button"
        class="absolute right-3 top-3 grid size-8 place-items-center rounded-md text-muted-foreground transition-colors duration-150 [@media(hover:hover)]:hover:bg-muted/60 [@media(hover:hover)]:hover:text-foreground"
        :aria-label="$t('pages.leaderboard.panel.close')"
        @click="emit('close')"
      >
        <X class="size-4" />
      </button>
    </div>

    <div
      v-if="standing && headline"
      class="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-4 gap-y-1 px-4 pb-3.5"
    >
      <span
        class="text-[2.125rem] font-bold leading-none tabular-nums tracking-tight"
        :style="{ color: PLACE_COLORS[standing.rank - 1] }"
        >#{{ standing.rank.toLocaleString() }}</span
      >
      <span
        class="justify-self-end font-mono text-[1.375rem] font-bold leading-none tabular-nums"
        :style="headline.color ? { color: headline.color } : {}"
        >{{ headline.text }}</span
      >
      <span class="text-[0.72rem] text-muted-foreground/80">{{
        $t("pages.leaderboard.panel.of_total", {
          total: standing.total.toLocaleString(),
          board: categoryLabel,
        })
      }}</span>
      <span class="justify-self-end text-[0.72rem] text-muted-foreground/80">{{
        headline.label
      }}</span>
    </div>
    <div v-else class="flex items-end gap-4 px-4 pb-3.5">
      <span
        class="text-[2.125rem] font-bold leading-none text-muted-foreground/50"
        >—</span
      >
      <span class="text-[0.72rem] text-muted-foreground/80">{{
        boardRanksLoading
          ? ""
          : $t("pages.leaderboard.panel.not_ranked", { board: categoryLabel })
      }}</span>
    </div>

    <div
      v-if="gap"
      class="mx-4 mb-3.5 flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-[0.8rem] text-muted-foreground"
    >
      <component :is="gap.icon" class="size-3.5 shrink-0" />
      <span class="min-w-0">{{ gap.text }}</span>
    </div>

    <div
      v-if="entry && extraFields.length"
      class="mx-4 mb-3.5 grid grid-cols-[repeat(auto-fit,minmax(5.25rem,1fr))] gap-px overflow-hidden rounded-md border border-border bg-border"
    >
      <div
        v-for="field in extraFields"
        :key="field"
        class="grid gap-0.5 bg-card px-2.5 py-2"
      >
        <span class="truncate text-[0.7rem] text-muted-foreground/80">{{
          columnLabel(field)
        }}</span>
        <span
          class="inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums"
          :style="
            leaderboardFieldColor(category, field, entry[field])
              ? { color: leaderboardFieldColor(category, field, entry[field]) }
              : {}
          "
        >
          {{ formatLeaderboardField(category, field, entry[field]) }}
          <StatChevron
            v-if="leaderboardFieldTier(category, field)"
            :cfg="leaderboardFieldTier(category, field)"
            :value="entry[field]"
          />
        </span>
      </div>
    </div>

    <div class="border-t border-border px-2 pb-2 pt-3">
      <h3
        class="mx-2 mb-1.5 flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        <span
          aria-hidden="true"
          class="h-[2px] w-2.5 bg-[hsl(var(--tac-amber))]"
        ></span>
        {{ $t("pages.leaderboard.panel.every_board") }}
      </h3>
      <button
        v-for="cat in categories"
        :key="cat"
        type="button"
        class="grid h-[1.875rem] w-full grid-cols-[minmax(0,1fr)_3rem_4rem] items-center gap-2.5 rounded-[5px] px-2 text-left text-[0.8rem] transition-colors duration-150"
        :class="
          cat === category
            ? 'bg-muted/60 text-foreground'
            : 'text-muted-foreground [@media(hover:hover)]:hover:bg-muted/40 [@media(hover:hover)]:hover:text-foreground'
        "
        :aria-current="cat === category ? 'true' : undefined"
        :title="
          boardRanks[cat]
            ? $t('pages.players.detail.top_percent', {
                percent: topPercent(boardRanks[cat]!),
              })
            : undefined
        "
        @click="emit('board', cat, boardRanks[cat]?.rank ?? null)"
      >
        <span class="truncate">{{
          $t(`pages.leaderboard.categories.${cat}`)
        }}</span>
        <span
          class="text-right font-mono text-[0.8rem] tabular-nums"
          :class="
            boardRanks[cat]
              ? 'font-semibold text-foreground'
              : 'text-muted-foreground/40'
          "
          >{{
            boardRanks[cat] ? `#${boardRanks[cat]!.rank.toLocaleString()}` : "—"
          }}</span
        >
        <span
          aria-hidden="true"
          class="relative h-1 overflow-hidden rounded-full bg-muted"
        >
          <span
            class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out"
            :class="
              cat === category
                ? 'bg-[hsl(var(--tac-amber))]'
                : 'bg-foreground/40'
            "
            :style="{
              width: boardRanks[cat]
                ? `${percentile(boardRanks[cat]!)}%`
                : '0%',
            }"
          ></span>
        </span>
      </button>
    </div>

    <div class="px-4 pb-4 pt-2.5">
      <Button variant="outline" class="h-9 w-full gap-2" as-child>
        <NuxtLink :to="{ name: 'players-id', params: { id: player.steam_id } }">
          <UserRound class="size-4" />
          {{ $t("pages.leaderboard.panel.view_profile") }}
        </NuxtLink>
      </Button>
    </div>
  </div>
</template>
