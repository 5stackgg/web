<script setup lang="ts">
import { CaretSortIcon } from "@radix-icons/vue";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
</script>

<template>
  <div>
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button
          @click="searchTeams()"
          variant="outline"
          :aria-expanded="open"
          class="w-full justify-between"
        >
          {{ teams?.find((team) => team.id === modelValue)?.name || label }}
          <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <Command @update:searchTerm="searchTeams">
          <CommandInput class="h-9" @keydown.enter="select(teams?.[0])" />
          <CommandEmpty>{{ $t("team.search.no_teams") }}</CommandEmpty>
          <CommandList>
            <CommandGroup>
              <CommandItem
                v-for="team in teams"
                :key="team.id"
                :value="team"
                @select="select(team)"
              >
                <div class="flex items-center">
                  <span class="text-xs text-muted-foreground mr-2">
                    [{{ team.short_name }}]
                  </span>
                  <span>{{ team.name }}</span>
                </div>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";

export default {
  emits: ["selected", "update:modelValue"],
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
    modelValue: {
      type: [String, Number, Array, Object],
      default: "",
      required: false,
    },
  },
  data() {
    return {
      open: false,
      query: undefined,
      teams: undefined,
    };
  },
  methods: {
    select(team) {
      if (!team) {
        return;
      }
      this.open = false;
      this.$emit("selected", team);
      this.$emit("update:modelValue", team);
    },
    async searchTeams(query?: string) {
      let teams = [];
      if (!query || query.trim().length === 0) {
        teams = this.me.teams.filter((team) => {
          return !this.exclude.includes(team.id);
        });
      }

      if (teams.length === 0) {
        const { data } = await this.$apollo.query({
          query: generateQuery({
            teams: [
              {
                where: {
                  _and: [
                    {
                      id: {
                        _nin: this.exclude,
                      },
                    },
                    ...[
                      query
                        ? {
                            name: {
                              _ilike: `%${query}%`,
                            },
                          }
                        : {},
                    ],
                  ],
                },
              },
              {
                id: true,
                name: true,
                short_name: true,
              },
            ],
          }),
        });
        teams = data.teams;
      }

      this.teams = teams;
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
