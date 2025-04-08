<script setup lang="ts">
import { CaretSortIcon } from "@radix-icons/vue";
import { Switch } from "~/components/ui/switch";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        @click="searchPlayers()"
        variant="outline"
        :aria-expanded="open"
        class="justify-between"
      >
        {{ label }}
        <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="p-0">
      <Command @update:searchTerm="(term) => searchPlayers(term)">
        <div class="flex items-center justify-between px-3 py-2">
          <CommandInput
            :placeholder="$t('player.search.placeholder')"
            class="flex-1"
          />
          <div class="flex items-center gap-2 ml-4">
            <Switch
              class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
              :checked="onlineOnly"
              @click="onlineOnly = !onlineOnly"
            >
            </Switch>
            {{ $t("player.search.online_only") }}
          </div>
        </div>
        <CommandEmpty>{{ $t("player.search.no_players_found") }}</CommandEmpty>
        <CommandList>
          <CommandGroup
            :heading="
              $t('player.search.found_players', { count: players?.length || 0 })
            "
          >
            <CommandItem
              :value="me"
              :key="me.steam_id"
              @select="select(me)"
              v-if="canSelectSelf"
            >
              <PlayerDisplay class="mx-3" :player="me" />
            </CommandItem>
            <CommandItem
              v-for="player in players"
              :key="`player-${player.steam_id}-${Date.now()}`"
              :value="player"
              @select="select(player)"
            >
              <PlayerDisplay class="mx-3" :player="player" />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
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
  },
  data() {
    return {
      open: false,
      query: undefined,
      players: undefined,
    };
  },
  watch: {
    onlineOnly() {
      this.searchPlayers(this.query);
    },
  },
  methods: {
    select(player) {
      if (!player) {
        return;
      }
      this.open = false;
      this.$emit("selected", player);
    },
    async searchPlayers(query?: string) {
      this.query = query || undefined;

      const exclude = !this.canSelectSelf
        ? this.exclude.concat(this.me.steam_id)
        : this.exclude;

      if (this.onlineOnly) {
        this.players = useSearchStore().search(query, exclude);
        return;
      }

      const response = await $fetch("/api/players-search", {
        method: "post",
        body: {
          query,
          teamId: this.teamId,
          exclude: exclude,
        },
      });

      this.players = response.hits.map(({ document }) => {
        return document;
      });
    },
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
};
</script>
