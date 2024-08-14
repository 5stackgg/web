<script setup lang="ts">
import { CaretSortIcon } from "@radix-icons/vue";
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
        <CommandInput class="h-9" @keydown.enter.stop="select(players.at(0))" />
        <CommandEmpty>No Players Found.</CommandEmpty>
        <CommandList>
          <CommandGroup>
            <CommandItem
              v-for="player in players"
              :key="player.steam_id"
              :value="player"
              @select="select(player)"
            >
              <Avatar class="mx-3">
                <AvatarImage
                  :src="player.avatar_url"
                  :alt="player.name"
                  v-if="player.avatar_url"
                />
                <AvatarFallback>{{ player.name }}</AvatarFallback>
              </Avatar>

              <div>
                {{ player.name }}
                <p class="text-xs">
                  {{ player.steam_id }}
                </p>
              </div>
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
  },
  data() {
    return {
      open: false,
      query: undefined,
      players: undefined,
    };
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

      const response = await useFetch("/api/players-search", {
        method: "post",
        body: {
          query,
          teamId: this.teamId,
          exclude: this.exclude,
        },
      });

      this.players = response.data.value.hits
        .map(({ document }) => {
          return document;
        })
        .filter((player) => {
          return !this.exclude.includes(player.steam_id);
        });
    },
  },
};
</script>
