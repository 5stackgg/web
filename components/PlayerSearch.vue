<script setup lang="ts">
import { CaretSortIcon } from "@radix-icons/vue";
import { Search } from "lucide-vue-next";
import { Drawer, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import FilterRail from "~/components/common/FilterRail.vue";
import FilterChip from "~/components/common/FilterChip.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerSearchRow from "~/components/PlayerSearchRow.vue";
import { useMediaQuery } from "@vueuse/core";
import debounce from "~/utilities/debounce";

const isMobile = useMediaQuery("(max-width: 768px)");
const { height: viewportHeight } = useVisualViewport();
</script>

<template>
  <!-- Mobile: Drawer -->
  <Drawer v-if="isMobile" v-model:open="open">
    <div
      @click="
        open = true;
        searchPlayers();
      "
    >
      <slot>
        <Button
          variant="outline"
          :class="[
            'w-full [&>span:last-child]:w-full [&>span:last-child]:justify-between',
            {
              'justify-between py-8': selected,
              'justify-between': !selected,
            },
            $props.class,
          ]"
        >
          <template v-if="selected">
            <PlayerDisplay :player="selected" />
          </template>
          <template v-else>
            {{ label }}
          </template>
          <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </slot>
    </div>
    <DrawerContent>
      <DrawerTitle class="sr-only">{{ label }}</DrawerTitle>
      <div
        class="flex flex-col"
        :style="{ height: `${viewportHeight * 0.9}px` }"
      >
        <div
          ref="scrollEl"
          class="flex-1 overflow-y-auto min-h-0 p-4 flex flex-col"
        >
          <div class="flex-1" />

          <!-- Grouped: Friends / Others -->
          <template v-if="groupByFriends">
            <div
              v-if="!hasGroupResults"
              class="p-4 text-center text-muted-foreground"
            >
              {{ $t("player.search.no_players_found") }}
            </div>
            <template v-for="group in playerGroups" :key="group.key">
              <div v-if="group.players.length">
                <div
                  class="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background px-3 py-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]" />
                  {{ group.label }}
                  <span
                    class="ml-auto tabular-nums text-[hsl(var(--tac-amber))]"
                  >
                    {{ group.players.length }}
                  </span>
                </div>
                <div class="divide-y">
                  <PlayerSearchRow
                    v-for="player in group.players"
                    :key="`g-${group.key}-${player.steam_id}`"
                    :ref="
                      indexOfPlayer(player) === selectedIndex
                        ? setActiveRow
                        : undefined
                    "
                    :player="player"
                    :active="indexOfPlayer(player) === selectedIndex"
                    :reason="reasonFor(player)"
                    @select="select(player)"
                    @hover="onHover(indexOfPlayer(player))"
                  />
                </div>
              </div>
            </template>
          </template>

          <template v-else>
            <div
              v-if="!displayPlayers.length"
              class="p-4 text-center text-muted-foreground"
            >
              {{ $t("player.search.no_players_found") }}
            </div>

            <div v-else class="divide-y">
              <PlayerSearchRow
                v-for="(player, index) in displayPlayers"
                :key="`player-${player.steam_id}`"
                :ref="index === selectedIndex ? setActiveRow : undefined"
                :player="player"
                :active="index === selectedIndex"
                :reason="reasonFor(player)"
                @select="select(player)"
                @hover="onHover(index)"
              />
            </div>
          </template>

          <div v-if="hasMore" ref="sentinelEl" class="h-px w-full shrink-0" />
          <div
            v-if="loadingMore"
            class="py-2 text-center text-xs text-muted-foreground"
          >
            {{ $t("player.search.loading_more") }}
          </div>
        </div>

        <div
          v-if="groupByFriends ? hasGroupResults : displayPlayers.length"
          class="px-4 py-2 text-xs text-muted-foreground border-t"
        >
          <template v-if="groupByFriends">
            {{
              playerGroups[0].players.length + playerGroups[1].players.length
            }}
            {{ $t("player.search.found_players") }}
          </template>
          <template v-else>
            {{ displayPlayers.length }} {{ $t("player.search.found_players") }}
          </template>
        </div>

        <div class="flex flex-col gap-2.5 p-4 border-t">
          <div class="relative">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref="mobileSearchInput"
              v-model="query"
              :placeholder="$t('player.search.placeholder')"
              type="search"
              inputmode="search"
              enterkeyhint="search"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              class="h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[hsl(var(--tac-amber)/0.6)] focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber)/0.4)] [&::-webkit-search-cancel-button]:appearance-none"
              @input="
                (e: Event) =>
                  debouncedSearch((e.target as HTMLInputElement).value)
              "
              @keydown="onKeydown"
            />
          </div>
          <FilterRail>
            <FilterChip
              :active="onlineOnly"
              :label="$t('common.online')"
              @toggle="toggleOnlineOnly"
            />
            <FilterChip
              v-if="canFilterRegistered"
              :active="registeredOnlyFilter"
              :label="$t('search.registered')"
              @toggle="toggleRegisteredOnly"
            />
          </FilterRail>
        </div>
      </div>
    </DrawerContent>
  </Drawer>

  <!-- Desktop: Popover -->
  <Popover v-else v-model:open="open">
    <PopoverTrigger as-child>
      <div class="relative">
        <slot>
          <Button
            @click="searchPlayers()"
            variant="outline"
            :aria-expanded="open"
            :class="[
              'justify-between w-full [&>span:last-child]:w-full [&>span:last-child]:justify-between',
              { 'py-8': selected },
              $props.class,
            ]"
          >
            <template v-if="selected">
              <PlayerDisplay :player="selected" />
            </template>
            <template v-else>
              {{ label }}
            </template>
            <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </slot>
      </div>
    </PopoverTrigger>
    <PopoverContent class="p-0 w-[400px]">
      <div class="flex flex-col">
        <div class="flex flex-col gap-2.5 p-3 border-b">
          <div class="relative">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              v-model="query"
              :placeholder="$t('player.search.placeholder')"
              type="search"
              inputmode="search"
              enterkeyhint="search"
              class="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[hsl(var(--tac-amber)/0.6)] focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber)/0.4)] [&::-webkit-search-cancel-button]:appearance-none"
              @input="
                (e: Event) =>
                  debouncedSearch((e.target as HTMLInputElement).value)
              "
              @keydown="onKeydown"
            />
          </div>
          <FilterRail>
            <FilterChip
              :active="onlineOnly"
              :label="$t('common.online')"
              @toggle="toggleOnlineOnly"
            />
            <FilterChip
              v-if="canFilterRegistered"
              :active="registeredOnlyFilter"
              :label="$t('search.registered')"
              @toggle="toggleRegisteredOnly"
            />
          </FilterRail>
        </div>

        <div ref="scrollEl" class="max-h-[300px] overflow-y-auto">
          <!-- Grouped: Friends / Others -->
          <template v-if="groupByFriends">
            <div
              v-if="!hasGroupResults"
              class="p-4 text-center text-muted-foreground"
            >
              {{ $t("player.search.no_players_found") }}
            </div>
            <template v-for="group in playerGroups" :key="group.key">
              <div v-if="group.players.length">
                <div
                  class="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-popover px-3 py-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]" />
                  {{ group.label }}
                  <span
                    class="ml-auto tabular-nums text-[hsl(var(--tac-amber))]"
                  >
                    {{ group.players.length }}
                  </span>
                </div>
                <div class="divide-y">
                  <PlayerSearchRow
                    v-for="player in group.players"
                    :key="`g-${group.key}-${player.steam_id}`"
                    :ref="
                      indexOfPlayer(player) === selectedIndex
                        ? setActiveRow
                        : undefined
                    "
                    :player="player"
                    :active="indexOfPlayer(player) === selectedIndex"
                    :reason="reasonFor(player)"
                    @select="select(player)"
                    @hover="onHover(indexOfPlayer(player))"
                  />
                </div>
              </div>
            </template>
          </template>

          <template v-else>
            <div
              v-if="!displayPlayers.length"
              class="p-4 text-center text-muted-foreground"
            >
              {{ $t("player.search.no_players_found") }}
            </div>

            <div v-else>
              <div class="px-3 py-2 text-sm text-muted-foreground">
                {{ displayPlayers.length }}
                {{ $t("player.search.found_players") }}
              </div>

              <div class="divide-y">
                <PlayerSearchRow
                  v-for="(player, index) in displayPlayers"
                  :key="`player-${player.steam_id}`"
                  :ref="index === selectedIndex ? setActiveRow : undefined"
                  :player="player"
                  :active="index === selectedIndex"
                  :reason="reasonFor(player)"
                  @select="select(player)"
                  @hover="onHover(index)"
                />
              </div>
            </div>
          </template>

          <div v-if="hasMore" ref="sentinelEl" class="h-px w-full" />
          <div
            v-if="loadingMore"
            class="py-2 text-center text-xs text-muted-foreground"
          >
            {{ $t("player.search.loading_more") }}
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
import { markRaw } from "vue";

interface Player {
  steam_id: string;
  role?: string;
  name: string;
  avatar_url?: string;
  country?: string;
  is_banned?: boolean;
  is_muted?: boolean;
  is_gagged?: boolean;
  elo?: {
    competitive?: number;
    wingman?: number;
    duel?: number;
  };
}

interface SearchResponse {
  found?: number;
  hits: Array<{
    document: Player & {
      elo_competitive?: number;
      elo_wingman?: number;
      elo_duel?: number;
    };
  }>;
}

const PAGE_SIZE = 25;

export default {
  emits: ["selected"],
  props: {
    label: {
      type: String,
      required: true,
    },
    // Steam ids that must never be rendered at all. Reserve this for cases
    // with nothing useful to say ("you", already-picked filter chips) — for
    // "they exist but you can't pick them", use `ineligible` so the row shows
    // up dimmed with a reason instead of silently vanishing.
    exclude: {
      type: Array as () => string[],
      required: false,
      default: () => [],
    },
    // steam_id -> sentence explaining why that player can't be selected. These
    // are deliberately NOT filtered out of the query: they render dimmed and
    // non-selectable so the user can tell "already on a roster" from
    // "no such player".
    ineligible: {
      type: Object as () => Record<string, string>,
      required: false,
      default: () => ({}),
    },
    teamId: {
      type: String,
      required: false,
    },
    self: {
      type: Boolean,
      default: false,
    },
    selected: {
      type: Object,
      required: false,
      default: null,
    },
    class: {
      type: String,
      required: false,
      default: "",
    },
    registeredOnly: {
      type: Boolean,
      required: false,
      default: false,
    },
    groupByFriends: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      open: false,
      query: "",
      players: undefined as Player[] | undefined,
      selectedIndex: 0,
      activeRow: null as HTMLElement | null,
      page: 1,
      totalFound: 0,
      loadingMore: false,
      searching: false,
      // The online path searches a local store that returns everything at
      // once, so it pages client-side instead of re-querying.
      visibleCount: PAGE_SIZE,
      // Guards against a slow early request overwriting a newer one.
      searchToken: 0,
      observer: null as IntersectionObserver | null,
      debouncedSearch: debounce((query: string) => {
        this.searchPlayers(query);
      }, 300),
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    // Only hard-hidden ids reach the query. `ineligible` never does.
    hardExcluded(): string[] {
      const ids = (this.exclude as string[]).map(String);
      if (!this.canSelectSelf && this.me?.steam_id) {
        ids.push(String(this.me.steam_id));
      }
      return ids;
    },
    canSelectSelf() {
      return (
        this.self &&
        this.me &&
        !(this.exclude as string[])
          .map(String)
          .includes(String(this.me.steam_id))
      );
    },
    // The current user, surfaced as a selectable entry (the online presence
    // list never contains yourself). Hidden once you're in `exclude`, i.e.
    // already in a lineup, and filtered by the active query.
    selfPlayer(): Player | null {
      if (!this.canSelectSelf || !this.me) return null;
      const me = this.me as any;
      const q = this.query.toLowerCase();
      if (
        q &&
        !(
          me.name?.toLowerCase().includes(q) ||
          String(me.steam_id).includes(this.query)
        )
      ) {
        return null;
      }
      return {
        steam_id: me.steam_id,
        name: me.name,
        avatar_url: me.avatar_url,
        country: me.country,
        role: me.role,
        is_banned: me.is_banned,
        is_muted: me.is_muted,
        is_gagged: me.is_gagged,
        elo: me.elo,
      } as Player;
    },
    // The slice of `players` currently on screen. The API path grows by
    // fetching more pages, the online path by widening this window.
    loadedPlayers(): Player[] {
      const base = this.players ?? [];
      return this.onlineOnly ? base.slice(0, this.visibleCount) : base;
    },
    hasMore(): boolean {
      if (this.players === undefined) return false;
      if (this.onlineOnly) {
        return this.visibleCount < this.players.length;
      }
      return this.players.length < this.totalFound;
    },
    // Non-grouped results with `me` pinned to the top when selectable.
    displayPlayers(): Player[] {
      const base = this.loadedPlayers;
      if (!this.selfPlayer) return base;
      const meId = String(this.me?.steam_id);
      return [
        this.selfPlayer,
        ...base.filter((p: Player) => String(p.steam_id) !== meId),
      ];
    },
    // A context that requires registered players (lobbies, drafts) passes the
    // prop and owns the filter outright, so there is nothing to offer.
    canFilterRegistered(): boolean {
      return !this.registeredOnly;
    },
    registeredOnlyFilter: {
      get(): boolean {
        return this.registeredOnly || useSearchStore().registeredOnly;
      },
      set(value: boolean) {
        localStorage.setItem("playerSearchRegisteredOnly", value.toString());
        useSearchStore().registeredOnly = value;
      },
    },
    onlineOnly: {
      get() {
        return useSearchStore().onlineOnly;
      },
      set(value: boolean) {
        localStorage.setItem("playerSearchOnlineOnly", value.toString());
        useSearchStore().onlineOnly = value;
      },
    },
    friendIds(): Set<string> {
      return new Set(
        (useMatchmakingStore().friends as any[])
          .filter((f: any) => f.status !== "Pending")
          .map((f: any) => String(f.steam_id)),
      );
    },
    // Friends list, filtered by query/exclude/self and sorted online-first.
    // The online toggle applies here too: when on, only online friends show;
    // when off, all friends (online + offline). Built from the full friends
    // list so offline friends reliably appear when the toggle is off.
    friendsForSearch(): Player[] {
      if (!this.groupByFriends) return [];
      const store = useMatchmakingStore();
      const onlineIds = new Set(
        (store.onlinePlayerSteamIds as string[]).map(String),
      );
      const q = this.query.toLowerCase();
      const excluded = new Set(this.hardExcluded);
      const meId = String(this.me?.steam_id ?? "");

      return (store.friends as any[])
        .filter((f: any) => {
          if (f.status === "Pending") return false;
          const id = String(f.steam_id);
          if (excluded.has(id)) return false;
          if (!this.canSelectSelf && id === meId) return false;
          // Strictly respect the toggle: online-only -> only online friends,
          // otherwise -> only offline friends.
          const online = onlineIds.has(id);
          if (this.onlineOnly !== online) return false;
          if (!q) return true;
          return f.name?.toLowerCase().includes(q) || id.includes(this.query);
        })
        .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
    },
    // Normal search results, minus anyone already shown in the Friends section.
    otherPlayers(): Player[] {
      const meId = this.selfPlayer ? String(this.me?.steam_id) : null;
      return this.loadedPlayers.filter(
        (p: Player) =>
          !this.friendIds.has(String(p.steam_id)) &&
          (meId === null || String(p.steam_id) !== meId),
      );
    },
    playerGroups(): Array<{ key: string; label: string; players: Player[] }> {
      return [
        {
          key: "friends",
          label: this.$t("matchmaking.friends.title"),
          players: this.selfPlayer
            ? [this.selfPlayer, ...this.friendsForSearch]
            : this.friendsForSearch,
        },
        {
          key: "others",
          label: this.$t("matchmaking.others.title"),
          players: this.otherPlayers,
        },
      ];
    },
    hasGroupResults(): boolean {
      return this.playerGroups.some((g) => g.players.length > 0);
    },
    // Single ordered list to drive arrow-key navigation across whichever
    // rendering mode is active (grouped Friends/Others or a flat list).
    flatResults(): Player[] {
      if (this.groupByFriends) {
        return [
          ...this.playerGroups[0].players,
          ...this.playerGroups[1].players,
        ];
      }
      return this.displayPlayers;
    },
    flatIndexBySteamId(): Map<string, number> {
      return new Map(
        this.flatResults.map((p, i) => [String(p.steam_id), i] as const),
      );
    },
    selectableIndexes(): number[] {
      const indexes: number[] = [];
      this.flatResults.forEach((player, index) => {
        if (!this.isIneligible(player)) indexes.push(index);
      });
      return indexes;
    },
  },
  methods: {
    indexOfPlayer(player: Player): number {
      return this.flatIndexBySteamId.get(String(player.steam_id)) ?? -1;
    },
    reasonFor(player: Player): string | undefined {
      if (!player) return undefined;
      return this.ineligible[String(player.steam_id)];
    },
    isIneligible(player: Player): boolean {
      return !!this.reasonFor(player);
    },
    firstSelectableIndex(): number {
      return this.selectableIndexes[0] ?? 0;
    },
    // The row component's root is a plain div, but a ref on a component hands
    // back the instance — unwrap it or scrollIntoView silently no-ops.
    setActiveRow(el: any) {
      this.activeRow = (el && el.$el) || el;
    },
    scrollActiveIntoView() {
      this.$nextTick(() => {
        this.activeRow?.scrollIntoView({ block: "nearest" });
      });
    },
    moveSelection(delta: number) {
      const indexes = this.selectableIndexes;
      if (!indexes.length) return;
      const position = indexes.indexOf(this.selectedIndex);
      if (position === -1) {
        this.selectedIndex =
          delta > 0 ? indexes[0] : indexes[indexes.length - 1];
        return;
      }
      const next = Math.min(Math.max(position + delta, 0), indexes.length - 1);
      this.selectedIndex = indexes[next];
    },
    onHover(index: number) {
      // Never park the keyboard cursor on a row Enter can't act on.
      if (index < 0) return;
      if (!this.isIneligible(this.flatResults[index])) {
        this.selectedIndex = index;
      }
    },
    onKeydown(event: KeyboardEvent) {
      const list = this.flatResults;
      if (!list.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.moveSelection(1);
        this.scrollActiveIntoView();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        this.moveSelection(-1);
        this.scrollActiveIntoView();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (list[this.selectedIndex]) this.select(list[this.selectedIndex]);
      }
    },
    toggleOnlineOnly() {
      this.onlineOnly = !this.onlineOnly;
      this.searchPlayers();
      this.$nextTick(() => {
        (this.$refs.mobileSearchInput as HTMLInputElement)?.focus();
      });
    },
    toggleRegisteredOnly() {
      this.registeredOnlyFilter = !this.registeredOnlyFilter;
      this.searchPlayers();
      this.$nextTick(() => {
        (this.$refs.mobileSearchInput as HTMLInputElement)?.focus();
      });
    },
    select(player: Player) {
      if (!player || this.isIneligible(player)) {
        return;
      }
      this.open = false;
      this.$emit("selected", player);
    },
    async fetchPage(
      page: number,
    ): Promise<{ players: Player[]; found: number }> {
      const response = (await $fetch("/api/players-search", {
        method: "post",
        body: {
          query: this.query,
          teamId: this.teamId,
          exclude: this.hardExcluded,
          registeredOnly: this.registeredOnlyFilter,
          page,
          per_page: PAGE_SIZE,
        },
      })) as SearchResponse;

      return {
        players: response.hits.map(({ document }) => {
          return {
            role: document.role,
            steam_id: document.steam_id,
            name: document.name,
            avatar_url: document.avatar_url,
            country: document.country,
            is_banned: document.is_banned,
            is_muted: document.is_muted,
            is_gagged: document.is_gagged,
            elo: {
              competitive: document.elo_competitive,
              wingman: document.elo_wingman,
              duel: document.elo_duel,
            },
          } as Player;
        }),
        found: response.found ?? response.hits.length,
      };
    },
    async searchPlayers(query?: string) {
      if (query !== undefined) {
        this.query = query;
      }

      this.page = 1;
      this.visibleCount = PAGE_SIZE;
      this.searchToken += 1;
      const token = this.searchToken;

      if (this.onlineOnly) {
        this.players = useSearchStore().search(this.query, this.hardExcluded);
        this.totalFound = this.players.length;
        this.selectedIndex = this.firstSelectableIndex();
        return;
      }

      this.searching = true;
      try {
        const { players, found } = await this.fetchPage(1);
        // A slower earlier keystroke must not clobber a newer result set.
        if (token !== this.searchToken) return;

        this.players = players;
        this.totalFound = found;
        this.selectedIndex = this.firstSelectableIndex();
      } finally {
        if (token === this.searchToken) {
          this.searching = false;
        }
      }
    },
    async loadMore() {
      // While page 1 is still in flight `players`/`totalFound` describe the
      // previous query — appending to them would mix two result sets.
      if (this.searching || this.loadingMore || !this.hasMore) {
        return;
      }

      if (this.onlineOnly) {
        this.visibleCount += PAGE_SIZE;
        return;
      }

      this.loadingMore = true;
      const token = this.searchToken;
      try {
        const nextPage = this.page + 1;
        const { players, found } = await this.fetchPage(nextPage);
        if (token !== this.searchToken) return;

        this.page = nextPage;
        this.totalFound = found;

        // Typesense can repeat a document across pages when the underlying
        // collection shifts mid-scroll; keys must stay unique.
        const seen = new Set(
          (this.players ?? []).map((p) => String(p.steam_id)),
        );
        this.players = (this.players ?? []).concat(
          players.filter((p) => !seen.has(String(p.steam_id))),
        );
      } finally {
        this.loadingMore = false;
        // If the freshly appended page didn't push the sentinel out of the
        // root, no new intersection event fires and paging stalls. Re-binding
        // re-reports an already-intersecting target.
        this.$nextTick(() => this.ensureObserver());
      }
    },
    ensureObserver() {
      this.observer?.disconnect();
      this.observer = null;

      const root = this.$refs.scrollEl as HTMLElement | undefined;
      const sentinel = this.$refs.sentinelEl as HTMLElement | undefined;
      if (!root || !sentinel || typeof IntersectionObserver === "undefined") {
        return;
      }

      this.observer = markRaw(
        new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) this.loadMore();
            }
          },
          { root, rootMargin: "0px 0px 200px 0px" },
        ),
      );
      this.observer.observe(sentinel);
    },
  },
  beforeUnmount() {
    this.observer?.disconnect();
    this.observer = null;
  },
  watch: {
    query(newQuery: string) {
      this.debouncedSearch(newQuery);
    },
    open: {
      handler(newOpen: boolean) {
        if (newOpen) {
          this.searchPlayers();
          this.$nextTick(() => {
            (this.$refs.mobileSearchInput as HTMLInputElement)?.focus();
            this.ensureObserver();
          });
        } else {
          this.observer?.disconnect();
          this.observer = null;
        }
      },
    },
    // The sentinel only exists while there's another page to fetch, and the
    // whole panel remounts on open, so re-bind whenever either flips.
    hasMore() {
      this.$nextTick(() => this.ensureObserver());
    },
    exclude(newExclude: string[], oldExclude: string[]) {
      if (newExclude.length !== oldExclude.length) {
        this.searchPlayers();
      }
    },
  },
};
</script>
