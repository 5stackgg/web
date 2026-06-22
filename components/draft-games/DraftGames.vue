<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue";
import {
  Plus,
  Swords,
  Search,
  ArrowUpDown,
  RotateCcw,
  Lock,
  Check,
  X,
} from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionDescriptionClasses,
} from "~/utilities/tacticalClasses";
import DraftGameCard from "~/components/draft-games/DraftGameCard.vue";
import { setupOptionsVariables } from "~/utilities/setupOptions";

const { t } = useI18n();

const draftGames = computed(() => {
  return useDraftGamesStore().openDraftGames;
});

const loaded = ref(false);

watch(
  draftGames,
  () => {
    loaded.value = true;
  },
  { deep: false },
);

const RANK_MIN = 0;
const RANK_MAX = 30000;
const RANK_STEP = 500;

const search = ref("");
const typeFilter = ref("all");
const modeFilter = ref("all");
const hasSpace = ref(false);
const rankRange = ref<number[]>([RANK_MIN, RANK_MAX]);
const rankFiltered = computed(
  () => rankRange.value[0] > RANK_MIN || rankRange.value[1] < RANK_MAX,
);
const sort = ref("filling");

const avgRankOf = (game: any) => {
  const list = (game.players || []).filter(
    (p: any) => p.status === "Accepted" && p.elo_snapshot,
  );
  if (list.length === 0) {
    return 0;
  }
  return Math.round(
    list.reduce((sum: number, p: any) => sum + p.elo_snapshot, 0) / list.length,
  );
};

const acceptedOf = (game: any) =>
  (game.players || []).filter((p: any) => p.status === "Accepted").length;

const typeOptions = computed(() => {
  const types = Array.from(
    new Set(draftGames.value.map((game: any) => game.type)),
  );
  return [
    { key: "all", label: t("common.all") },
    ...types.map((type) => ({ key: type, label: type })),
  ];
});

const MODE_LABELS: Record<string, string> = {
  Captains: "draft_games.mode.captains",
  Host: "draft_games.mode.host",
  Pug: "draft_games.mode.pug",
  Teams: "draft_games.mode.teams",
};
const modeOptions = computed(() => {
  const modes = Array.from(
    new Set(draftGames.value.map((game: any) => game.mode)),
  );
  return [
    { key: "all", label: t("common.all") },
    ...modes.map((mode) => ({
      key: mode,
      label: t(MODE_LABELS[mode] || mode),
    })),
  ];
});

const sortOptions = [
  { key: "filling", label: "draft_games.sort.filling" },
  { key: "newest", label: "draft_games.sort.newest" },
  { key: "rank_high", label: "draft_games.sort.rank_high" },
  { key: "rank_low", label: "draft_games.sort.rank_low" },
];

const filtered = computed(() => {
  let list = [...draftGames.value];

  if (typeFilter.value !== "all") {
    list = list.filter((game: any) => game.type === typeFilter.value);
  }
  if (modeFilter.value !== "all") {
    list = list.filter((game: any) => game.mode === modeFilter.value);
  }
  if (hasSpace.value) {
    list = list.filter((game: any) => acceptedOf(game) < game.capacity);
  }

  if (rankFiltered.value) {
    const [min, max] = rankRange.value;
    list = list.filter((game: any) => {
      const avg = avgRankOf(game);
      return avg > 0 && avg >= min && avg <= max;
    });
  }

  const query = search.value.trim().toLowerCase();
  if (query) {
    list = list.filter((game: any) => {
      const names = [
        game.host?.name || "",
        ...(game.players || []).map((p: any) => p.player?.name || ""),
      ];
      return names.some((name) => name.toLowerCase().includes(query));
    });
  }

  list.sort((a: any, b: any) => {
    switch (sort.value) {
      case "newest":
        return String(b.created_at).localeCompare(String(a.created_at));
      case "rank_high":
        return avgRankOf(b) - avgRankOf(a);
      case "rank_low":
        return avgRankOf(a) - avgRankOf(b);
      case "filling":
      default:
        return (
          acceptedOf(b) / b.capacity - acceptedOf(a) / a.capacity ||
          acceptedOf(b) - acceptedOf(a)
        );
    }
  });

  return list;
});

const activeFilterCount = computed(() => {
  let count = 0;
  if (typeFilter.value !== "all") {
    count++;
  }
  if (modeFilter.value !== "all") {
    count++;
  }
  if (hasSpace.value) {
    count++;
  }
  if (rankFiltered.value) {
    count++;
  }
  if (search.value.trim()) {
    count++;
  }
  return count;
});

const resetFilters = () => {
  search.value = "";
  typeFilter.value = "all";
  modeFilter.value = "all";
  hasSpace.value = false;
  rankRange.value = [RANK_MIN, RANK_MAX];
};

const isPartyLeader = computed(() => {
  const lobby = useMatchmakingStore().currentLobby as any;
  if (!lobby) {
    return true;
  }
  const me = lobby.players?.find(
    (p: any) => p.player?.steam_id === useAuthStore().me?.steam_id,
  );
  return !!me?.captain;
});
const inLobbyNotLeader = computed(
  () => !!useMatchmakingStore().currentLobby && !isPartyLeader.value,
);

const hasRehostPreset = ref(false);

onMounted(() => {
  useDraftGamesStore().subscribeToOpenDraftGames();
  try {
    hasRehostPreset.value = !!localStorage.getItem("draft-games:rehost");
  } catch {
    hasRehostPreset.value = false;
  }
});

onUnmounted(() => {
  useDraftGamesStore().unsubscribeFromOpenDraftGames();
});

const create = () => {
  if (!useAuthStore().me) {
    navigateTo("/login?next=/draft-room/create");
    return;
  }
  navigateTo("/draft-room/create");
};

const rehost = async () => {
  if (!useAuthStore().me) {
    navigateTo("/login?next=/draft-room/create");
    return;
  }

  let preset: any = null;
  try {
    preset = JSON.parse(localStorage.getItem("draft-games:rehost") || "null");
  } catch {
    preset = null;
  }

  let payload = preset?.payload;

  if (!payload && preset?.values) {
    const values = preset.values;
    payload = {
      type: values.type,
      mode: preset.mode,
      access: preset.access,
      regions: values.regions,
      map_pool_id: values.map_pool_id,
      captain_selection: preset.captain_selection,
      draft_order: preset.draft_order,
      require_approval: preset.require_approval,
      min_elo: preset.min_elo ?? undefined,
      max_elo: preset.max_elo ?? undefined,
      team_1_id: preset.mode === "Teams" ? preset.team_1_id : undefined,
      team_2_id: preset.mode === "Teams" ? preset.team_2_id : undefined,
      keep_lobby_together: false,
      options: setupOptionsVariables(values, {
        mapPoolId: values.map_pool_id,
      }),
    };
  }

  if (!payload) {
    navigateTo("/draft-room/create");
    return;
  }

  const draftGameId = await useDraftGamesStore().create(payload);
  if (draftGameId) {
    navigateTo(`/draft-room/${draftGameId}`);
  }
};
</script>

<template>
  <div>
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4"
    >
      <div class="min-w-0">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses"></span>
          OPEN.MATCHES
        </div>
        <div :class="tacticalSectionDescriptionClasses">
          {{ $t("pages.play.draft_games.description") }}
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:flex-wrap">
        <Button
          v-if="activeFilterCount > 0"
          variant="ghost"
          size="sm"
          class="gap-1.5 text-muted-foreground"
          @click="resetFilters"
        >
          <X class="h-3.5 w-3.5" />
          {{ $t("draft_games.filters.clear", { count: activeFilterCount }) }}
        </Button>
        <div
          v-if="inLobbyNotLeader"
          class="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2"
        >
          <Lock class="h-3.5 w-3.5 text-muted-foreground" />
          <span class="text-xs text-muted-foreground">
            {{ $t("draft_games.leader_required") }}
          </span>
        </div>
        <template v-else>
          <Button
            v-if="hasRehostPreset"
            variant="outline"
            class="gap-2 max-sm:flex-1"
            :title="$t('draft_games.rehost_hint')"
            @click="rehost"
          >
            <RotateCcw class="w-4 h-4" />
            {{ $t("draft_games.rehost") }}
          </Button>
          <Button variant="outline" class="gap-2 max-sm:flex-1" @click="create">
            <Plus class="w-4 h-4" />
            {{ $t("draft_games.create_custom_match") }}
          </Button>
        </template>
      </div>
    </div>

    <div
      class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border bg-card/30 px-4 py-3"
    >
      <AnimatedFilters
        v-if="typeOptions.length > 2"
        v-model="typeFilter"
        :options="typeOptions"
        square
      />
      <AnimatedFilters
        v-if="modeOptions.length > 2"
        v-model="modeFilter"
        :options="modeOptions"
        square
      />

      <div
        class="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5 sm:w-auto sm:min-w-[16rem] sm:max-w-[34rem] sm:flex-1"
      >
        <div
          class="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-2 sm:w-auto sm:min-w-[12rem] sm:flex-1 sm:flex-nowrap sm:gap-2.5"
        >
          <span
            class="order-1 shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("draft_games.filters.avg_rank") }}
          </span>
          <span
            class="order-2 ml-auto w-auto shrink-0 whitespace-nowrap text-right font-mono text-[0.62rem] tabular-nums text-foreground/70 sm:order-3 sm:ml-0 sm:w-[6.5rem]"
          >
            <template v-if="rankFiltered">
              {{ rankRange[0] }}–{{
                rankRange[1] === RANK_MAX ? "∞" : rankRange[1]
              }}
            </template>
            <template v-else>{{ $t("draft_games.filters.any") }}</template>
          </span>
          <Slider
            v-model="rankRange"
            :min="RANK_MIN"
            :max="RANK_MAX"
            :step="RANK_STEP"
            :min-steps-between-thumbs="1"
            class="order-3 w-full min-w-0 sm:order-2 sm:w-auto sm:flex-1"
          />
        </div>

        <span class="hidden h-5 w-px bg-border sm:block"></span>

        <button
          type="button"
          class="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 font-mono text-[0.6rem] uppercase tracking-[0.16em] transition-colors duration-150"
          :class="
            hasSpace
              ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="hasSpace = !hasSpace"
        >
          <Check v-if="hasSpace" class="h-3 w-3" />
          {{ $t("draft_games.filters.has_space") }}
        </button>
      </div>

      <div class="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
        <div class="relative flex-1 sm:w-52 sm:flex-none">
          <Search
            class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="search"
            :placeholder="$t('draft_games.search_placeholder')"
            class="h-8 pl-8"
          />
        </div>

        <div class="flex items-center gap-2">
          <ArrowUpDown class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Select v-model="sort">
            <SelectTrigger class="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in sortOptions"
                :key="option.key"
                :value="option.key"
              >
                {{ $t(option.label) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>

    <div class="space-y-3 mt-4">
      <div
        v-if="!loaded"
        class="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 px-6 py-10 text-center text-sm text-muted-foreground"
      >
        <div
          class="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
        ></div>
        <span>{{ $t("common.loading") }}</span>
      </div>
      <template v-else>
        <DraftGameCard
          v-for="draftGame in filtered"
          :key="draftGame.id"
          :draft-game="draftGame"
        />
        <div
          v-if="filtered.length === 0"
          class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card/30 px-6 py-10 text-center"
        >
          <Swords class="h-7 w-7 text-muted-foreground/50" />
          <p class="text-sm text-muted-foreground">
            {{
              draftGames.length === 0
                ? $t("draft_games.empty")
                : $t("draft_games.no_results")
            }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
