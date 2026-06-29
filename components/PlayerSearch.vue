<script setup lang="ts">
import { CaretSortIcon } from "@radix-icons/vue";
import { Switch } from "~/components/ui/switch";
import { Drawer, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
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
        <div class="flex-1 overflow-y-auto min-h-0 p-4 flex flex-col">
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
                  <div
                    v-for="player in group.players"
                    :key="`g-${group.key}-${player.steam_id}`"
                    class="px-3 py-2 hover:bg-accent cursor-pointer"
                    @click="select(player)"
                  >
                    <PlayerDisplay :player="player" />
                  </div>
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
              <div
                v-for="player in displayPlayers"
                :key="`player-${player.steam_id}}`"
                class="px-3 py-2 hover:bg-accent cursor-pointer"
                @click="select(player)"
              >
                <PlayerDisplay :player="player" />
              </div>
            </div>
          </template>
        </div>

        <div
          v-if="groupByFriends ? hasGroupResults : displayPlayers.length"
          class="px-4 py-2 text-xs text-muted-foreground border-t"
        >
          <template v-if="groupByFriends">
            {{ playerGroups[0].players.length + playerGroups[1].players.length }}
            {{ $t("player.search.found_players") }}
          </template>
          <template v-else>
            {{ displayPlayers.length }} {{ $t("player.search.found_players") }}
          </template>
        </div>

        <div class="flex items-center justify-between p-4 border-t">
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
            class="flex-1 bg-transparent outline-none text-base"
            @input="
              (e: Event) =>
                debouncedSearch((e.target as HTMLInputElement).value)
            "
          />
          <div class="flex items-center gap-2 ml-4">
            <Switch
              class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
              :model-value="onlineOnly"
              @click="toggleOnlineOnly"
            />
            {{ $t("common.online") }}
          </div>
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
        <div class="flex items-center justify-between px-3 py-2 border-b">
          <input
            v-model="query"
            :placeholder="$t('player.search.placeholder')"
            type="search"
            inputmode="search"
            enterkeyhint="search"
            class="flex-1 bg-transparent outline-none"
            @input="
              (e: Event) =>
                debouncedSearch((e.target as HTMLInputElement).value)
            "
          />
          <div class="flex items-center gap-2 ml-4">
            <Switch
              class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
              :model-value="onlineOnly"
              @click="toggleOnlineOnly"
            />
            {{ $t("common.online") }}
          </div>
        </div>

        <div class="max-h-[300px] overflow-y-auto">
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
                  <div
                    v-for="player in group.players"
                    :key="`g-${group.key}-${player.steam_id}`"
                    class="px-3 py-2 hover:bg-accent cursor-pointer"
                    @click="select(player)"
                  >
                    <PlayerDisplay :player="player" />
                  </div>
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
                <div
                  v-for="player in displayPlayers"
                  :key="`player-${player.steam_id}}`"
                  class="px-3 py-2 hover:bg-accent cursor-pointer"
                  @click="select(player)"
                >
                  <PlayerDisplay :player="player" />
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
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
  hits: Array<{
    document: Player;
  }>;
}

export default {
  emits: ["selected"],
  props: {
    label: {
      type: String,
      required: true,
    },
    exclude: {
      type: Array,
      required: false,
      default: [],
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
      debouncedSearch: debounce((query: string) => {
        this.searchPlayers(query);
      }, 300),
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    canSelectSelf() {
      return this.self && this.me && !this.exclude.includes(this.me.steam_id);
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
    // Non-grouped results with `me` pinned to the top when selectable.
    displayPlayers(): Player[] {
      const base = this.players ?? [];
      if (!this.selfPlayer) return base as Player[];
      const meId = String(this.me?.steam_id);
      return [
        this.selfPlayer,
        ...base.filter((p: Player) => String(p.steam_id) !== meId),
      ];
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
      const excluded = new Set((this.exclude as string[]).map(String));
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
        .sort((a: any, b: any) =>
          (a.name || "").localeCompare(b.name || ""),
        );
    },
    // Normal search results, minus anyone already shown in the Friends section.
    otherPlayers(): Player[] {
      const meId = this.selfPlayer ? String(this.me?.steam_id) : null;
      return (this.players ?? []).filter(
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
  },
  methods: {
    toggleOnlineOnly() {
      this.onlineOnly = !this.onlineOnly;
      this.searchPlayers();
      this.$nextTick(() => {
        (this.$refs.mobileSearchInput as HTMLInputElement)?.focus();
      });
    },
    select(player: Player) {
      if (!player) {
        return;
      }
      this.open = false;
      this.$emit("selected", player);
    },
    async searchPlayers(query?: string) {
      if (query !== undefined) {
        this.query = query;
      }

      const exclude =
        !this.canSelectSelf && this.me?.steam_id
          ? (this.exclude as string[]).concat(this.me.steam_id)
          : (this.exclude as string[]);

      if (this.onlineOnly) {
        this.players = useSearchStore().search(this.query, exclude);
        return;
      }

      const response = await $fetch("/api/players-search", {
        method: "post",
        body: {
          query: this.query,
          teamId: this.teamId,
          exclude: exclude,
          registeredOnly: this.registeredOnly,
        },
      });

      const fetchedPlayers = (response as SearchResponse).hits.map(
        ({ document }) => {
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
        },
      );

      this.players = fetchedPlayers;
    },
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
          });
        }
      },
    },
    exclude(newExclude: string[], oldExclude: string[]) {
      if (newExclude.length !== oldExclude.length) {
        console.log("exclude changed");
        this.searchPlayers();
      }
    },
  },
};
</script>
