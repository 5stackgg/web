<script setup lang="ts">
import { CaretSortIcon } from "@radix-icons/vue";
import { Switch } from "~/components/ui/switch";
import { Drawer, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { useMediaQuery } from "@vueuse/core";
import debounce from "~/utilities/debounce";

const isMobile = useMediaQuery("(max-width: 768px)");
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
            {
              'justify-between w-full py-8': selected,
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
      <div class="flex flex-col h-[80dvh] p-4">
        <div class="flex-1 overflow-y-auto min-h-0">
          <div
            v-if="!players?.length"
            class="p-4 text-center text-muted-foreground"
          >
            {{ $t("player.search.no_players_found") }}
          </div>

          <div v-else>
            <div class="px-3 py-2 text-sm text-muted-foreground">
              {{ players.length }} {{ $t("player.search.found_players") }}
            </div>

            <div class="divide-y">
              <div
                v-for="player in players"
                :key="`player-${player.steam_id}}`"
                class="px-3 py-2 hover:bg-accent cursor-pointer"
                @click="select(player)"
              >
                <PlayerDisplay :player="player" />
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between pt-3 border-t">
          <input
            ref="mobileSearchInput"
            v-model="query"
            :placeholder="$t('player.search.placeholder')"
            type="search"
            inputmode="search"
            enterkeyhint="search"
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
            {{ $t("player.search.online_only") }}
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
              {
                'justify-between w-full py-8': selected,
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
            {{ $t("player.search.online_only") }}
          </div>
        </div>

        <div class="max-h-[300px] overflow-y-auto">
          <div
            v-if="!players?.length"
            class="p-4 text-center text-muted-foreground"
          >
            {{ $t("player.search.no_players_found") }}
          </div>

          <div v-else>
            <div class="px-3 py-2 text-sm text-muted-foreground">
              {{ players.length }} {{ $t("player.search.found_players") }}
            </div>

            <div class="divide-y">
              <div
                v-for="player in players"
                :key="`player-${player.steam_id}}`"
                class="px-3 py-2 hover:bg-accent cursor-pointer"
                @click="select(player)"
              >
                <PlayerDisplay :player="player" />
              </div>
            </div>
          </div>
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
      return this.self && !this.exclude.includes(this.me.steam_id);
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
  },
  methods: {
    toggleOnlineOnly() {
      this.onlineOnly = !this.onlineOnly;
      this.searchPlayers();
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

      const exclude = !this.canSelectSelf
        ? (this.exclude as string[]).concat(this.me.steam_id)
        : (this.exclude as string[]);

      if (this.onlineOnly) {
        if (!this.query.trim()) {
          this.players = [];
          return;
        }

        const onlinePlayers = useSearchStore().search(this.query, exclude);
        this.players = onlinePlayers;
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
