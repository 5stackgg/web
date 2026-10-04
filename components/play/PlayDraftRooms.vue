<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Search, SlidersHorizontal, X } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import WatchSegmented from "~/components/watch/WatchSegmented.vue";
import PlayDraftRoomRow from "~/components/play/PlayDraftRoomRow.vue";
import PlayDraftHostBar from "~/components/play/PlayDraftHostBar.vue";
import PlayDraftIntro from "~/components/play/PlayDraftIntro.vue";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import {
  filterBadgeClasses,
  tacticalSectionDescriptionClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  DRAFT_RANK_MAX,
  DRAFT_RANK_MIN,
  DRAFT_RANK_STEP,
  defaultDraftFilters,
  draftFilterCount,
  draftFormats,
  filterDraftRooms,
  type DraftSort,
  type DraftViewer,
} from "~/components/play/draftRoomRow";
import { DRAFT_INTRO_DISMISSED_KEY } from "~/components/play/draftHost";

const { t } = useI18n();
const draftGames = useDraftGamesStore();
const matchmaking = useMatchmakingStore();
const auth = useAuthStore();

const rooms = computed<any[]>(() => draftGames.openDraftGames);
const loaded = ref(false);
watch(rooms, () => (loaded.value = true));

const filters = ref(defaultDraftFilters());
const visible = computed(() => filterDraftRooms(rooms.value, filters.value));
const filterCount = computed(() => draftFilterCount(filters.value));

const formats = computed(() => draftFormats(rooms.value));
const formatOptions = computed(() => [
  { key: "all", label: t("common.all") },
  ...formats.value.map((format) => ({ key: format, label: format })),
]);
// A format that drops out of the list can't stay selected.
watch(formats, (list) => {
  if (filters.value.format !== "all" && !list.includes(filters.value.format)) {
    filters.value.format = "all";
  }
});

const sortOptions = computed<Array<{ key: DraftSort; label: string }>>(() => [
  { key: "filling", label: t("pages.play.draft_rooms.sort.filling") },
  { key: "newest", label: t("pages.play.draft_rooms.sort.newest") },
  { key: "rank_high", label: t("pages.play.draft_rooms.sort.rank_high") },
  { key: "rank_low", label: t("pages.play.draft_rooms.sort.rank_low") },
]);

const rankFiltered = computed(
  () =>
    filters.value.rankRange[0] > DRAFT_RANK_MIN ||
    filters.value.rankRange[1] < DRAFT_RANK_MAX,
);

function clearFilters() {
  filters.value = defaultDraftFilters();
}

// Accepted party members, me included; invites still pending don't count.
const partyMembers = computed(() =>
  ((matchmaking.currentLobby as any)?.players ?? []).filter(
    (p: any) => p.status !== "Invited",
  ),
);
const isPartyLeader = computed(() => {
  const lobby = matchmaking.currentLobby as any;
  if (!lobby) return true;
  const me = lobby.players?.find(
    (p: any) => p.player?.steam_id === auth.me?.steam_id,
  );
  return !!me?.captain;
});
const inLobbyNotLeader = computed(
  () => !!matchmaking.currentLobby && !isPartyLeader.value,
);

const viewer = computed<DraftViewer>(() => ({
  meSteamId: auth.me?.steam_id ?? null,
  partySize: partyMembers.value.length,
  isPartyLeader: !!matchmaking.currentLobby && isPartyLeader.value,
}));

onMounted(() => {
  draftGames.subscribeToOpenDraftGames();
});

onUnmounted(() => {
  draftGames.unsubscribeFromOpenDraftGames();
});

// The intro explains draft rooms until the player hosts one, or closes it.
const introDismissed = ref(readIntroDismissed());
const hostedBefore = ref<boolean | null>(null);

function readIntroDismissed() {
  try {
    return localStorage.getItem(DRAFT_INTRO_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

watch(
  () => [auth.hasCheckedSession, auth.me?.steam_id] as const,
  async ([checked, steamId]) => {
    if (!checked) return;
    if (!steamId) {
      hostedBefore.value = false;
      return;
    }
    // Unknown stays hidden: the intro is a nicety, not worth an error.
    hostedBefore.value = await draftGames
      .hasHostedDraftGame(steamId)
      .catch(() => null);
  },
  { immediate: true },
);

const showIntro = computed(
  () => hostedBefore.value === false && !introDismissed.value,
);

function dismissIntro() {
  introDismissed.value = true;
  try {
    localStorage.setItem(DRAFT_INTRO_DISMISSED_KEY, "1");
  } catch {}
}

const listState = computed(() => {
  if (!loaded.value) return "loading";
  if (rooms.value.length === 0) return "empty";
  if (visible.value.length === 0) return "filtered";
  return "list";
});
</script>

<template>
  <section aria-labelledby="play-draft-rooms-label">
    <div
      class="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="min-w-0">
        <h2
          id="play-draft-rooms-label"
          :class="[tacticalSectionLabelClasses, 'mb-1']"
        >
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.play.draft_rooms.title") }}
        </h2>
        <p :class="[tacticalSectionDescriptionClasses, 'mb-0']">
          {{ $t("pages.play.draft_rooms.description") }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <template v-if="rooms.length">
          <WatchSegmented
            v-if="formats.length > 1"
            v-model="filters.format"
            :options="formatOptions"
            :label="$t('pages.play.draft_rooms.format_label')"
          />

          <!-- Search stays inline so typing starts straight away. -->
          <div class="relative w-full sm:w-48">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              v-model="filters.search"
              :placeholder="$t('pages.play.draft_rooms.search_placeholder')"
              :aria-label="$t('pages.play.draft_rooms.search_placeholder')"
              class="h-8 pl-8 pr-8 text-xs"
            />
            <button
              v-if="filters.search"
              type="button"
              class="absolute right-1 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
              :aria-label="$t('pages.play.draft_rooms.clear_search')"
              @click="filters.search = ''"
            >
              <X class="size-3.5" />
            </button>
          </div>

          <Popover>
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="hit h-8 gap-1.5"
                :class="{
                  'border-[hsl(var(--tac-amber)/0.55)] text-[hsl(var(--tac-amber))]':
                    filterCount > 0,
                }"
              >
                <SlidersHorizontal class="size-3.5" />
                {{ $t("pages.play.draft_rooms.filters") }}
                <span v-if="filterCount" :class="filterBadgeClasses">
                  {{ filterCount }}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              class="grid w-[min(20rem,calc(100vw-2rem))] gap-4 p-4"
            >
              <h3 class="m-0 text-[13px] font-bold">
                {{ $t("pages.play.draft_rooms.filters_title") }}
              </h3>

              <label
                class="flex cursor-pointer items-center justify-between gap-3 text-[13px]"
              >
                {{ $t("pages.play.draft_rooms.has_space") }}
                <Switch
                  v-model="filters.hasSpace"
                  class="data-[state=checked]:bg-[hsl(var(--tac-amber))] data-[state=unchecked]:bg-muted/70"
                />
              </label>

              <div class="grid gap-2 text-[13px]">
                <div class="flex items-center justify-between gap-3">
                  <span>{{ $t("pages.play.draft_rooms.avg_rank") }}</span>
                  <span class="tabular-nums text-muted-foreground">
                    <template v-if="rankFiltered">
                      {{ filters.rankRange[0] }}–{{
                        filters.rankRange[1] === DRAFT_RANK_MAX
                          ? "∞"
                          : filters.rankRange[1]
                      }}
                    </template>
                    <template v-else>{{
                      $t("pages.play.draft_rooms.any_rank")
                    }}</template>
                  </span>
                </div>
                <Slider
                  v-model="filters.rankRange"
                  :min="DRAFT_RANK_MIN"
                  :max="DRAFT_RANK_MAX"
                  :step="DRAFT_RANK_STEP"
                  :min-steps-between-thumbs="1"
                />
              </div>

              <div class="grid gap-1.5 text-[13px]">
                <span>{{ $t("pages.play.draft_rooms.sort_label") }}</span>
                <Select v-model="filters.sort">
                  <SelectTrigger
                    class="h-8 text-xs"
                    :aria-label="$t('pages.play.draft_rooms.sort_label')"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in sortOptions"
                      :key="option.key"
                      :value="option.key"
                    >
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </template>
      </div>
    </div>

    <Fold :open="showIntro">
      <PlayDraftIntro class="mb-3" @dismiss="dismissIntro" />
    </Fold>

    <PlayDraftHostBar class="mb-3" :locked="inLobbyNotLeader" />

    <FadeSwap>
      <div v-if="listState === 'loading'" key="loading" class="grid gap-2">
        <Skeleton v-for="i in 2" :key="i" class="h-[4.25rem] rounded-lg" />
      </div>

      <!-- Empty is a sentence, not a box: the host bar above is the call. -->
      <p
        v-else-if="listState === 'empty'"
        key="empty"
        class="m-0 text-[13.5px] text-muted-foreground"
      >
        {{ $t("pages.play.draft_rooms.empty") }}
      </p>

      <p
        v-else-if="listState === 'filtered'"
        key="filtered"
        class="m-0 text-[13.5px] text-muted-foreground"
      >
        {{ $t("pages.play.draft_rooms.no_results") }}
        <button
          type="button"
          class="hit ml-1.5 font-semibold text-foreground underline-offset-[3px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))]"
          @click="clearFilters"
        >
          {{ $t("pages.play.draft_rooms.clear_filters") }}
        </button>
      </p>

      <TransitionGroup
        v-else
        key="list"
        tag="div"
        class="grid gap-2"
        enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
        enter-from-class="translate-y-1 opacity-0"
        leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
        leave-to-class="opacity-0"
      >
        <PlayDraftRoomRow
          v-for="draftGame in visible"
          :key="draftGame.id"
          :draft-game="draftGame"
          :viewer="viewer"
        />
      </TransitionGroup>
    </FadeSwap>
  </section>
</template>

<style scoped>
.hit {
  position: relative;
}
@media (pointer: coarse) {
  .hit::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: max(100%, 2.75rem);
    transform: translateY(-50%);
  }
}
</style>
