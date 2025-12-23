<script setup lang="ts">
import { CaretSortIcon } from "@radix-icons/vue";
import { Switch } from "~/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import debounce from "~/utilities/debounce";
import { e_team_roles_enum } from "~/generated/zeus";
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        @click="searchTeams()"
        variant="outline"
        :aria-expanded="open"
        class="justify-between w-full"
      >
        {{ teams?.find((team) => team.id === modelValue)?.name || label }}
        <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="p-0 w-[400px]">
      <div class="flex flex-col">
        <div class="flex items-center justify-between px-3 py-2 border-b">
          <input
            v-model="query"
            :placeholder="$t('team.search.placeholder')"
            class="flex-1 bg-transparent outline-none"
            @input="
              (e: Event) =>
                debouncedSearch((e.target as HTMLInputElement).value)
            "
          />
          <div class="flex items-center gap-2 ml-4" v-if="!myTeams">
            <Switch
              class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
              :model-value="myTeamsOnly"
              @click="toggleMyTeamsOnly"
            />
            {{ $t("team.search.my_teams_only") }}
          </div>
        </div>

        <div class="max-h-[300px] overflow-y-auto">
          <div
            v-if="!teams?.length"
            class="p-4 text-center text-muted-foreground"
          >
            {{ $t("team.search.no_teams_found") }}
          </div>

          <div v-else>
            <div class="px-3 py-2 text-sm text-muted-foreground">
              {{ teams.length }} {{ $t("team.search.found_teams") }}
            </div>

            <div class="divide-y">
              <div
                v-for="team in teams"
                :key="team.id"
                class="px-3 py-2 hover:bg-accent cursor-pointer"
                @click="select(team)"
              >
                <div class="flex items-center">
                  <span class="text-xs text-muted-foreground mr-2">
                    [{{ team.short_name }}]
                  </span>
                  <span>{{ team.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";

interface Team {
  id: string;
  name: string;
  short_name: string;
}

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
    isAdmin: {
      type: Boolean,
      required: false,
      default: false,
    },
    myTeams: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      open: false,
      query: "",
      teams: undefined as Team[] | undefined,
      myTeamsOnly: false,
      debouncedSearch: debounce((query: string) => {
        this.searchTeams(query);
      }, 300),
    };
  },
  watch: {
    query(newQuery: string) {
      this.debouncedSearch(newQuery);
    },
    modelValue: {
      once: true,
      immediate: true,
      async handler(teamId: string) {
        if (!teamId) {
          return;
        }

        const { data } = await this.$apollo.query({
          query: generateQuery({
            teams: [
              {
                where: {
                  id: {
                    _eq: teamId,
                  },
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

        this.teams = data.teams;
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
  methods: {
    toggleMyTeamsOnly() {
      this.myTeamsOnly = !this.myTeamsOnly;
      this.searchTeams();
    },
    select(team: Team) {
      if (!team) {
        return;
      }
      this.open = false;
      this.$emit("selected", team);
      this.$emit("update:modelValue", team);
    },
    async searchTeams(query?: string) {
      this.query = query || "";

      if (this.myTeamsOnly || this.myTeams) {
        this.teams = this.me.teams.filter((team: Team) => {
          if (this.isAdmin && team.role !== e_team_roles_enum.Admin) {
            return false;
          }

          return !this.exclude.includes(team.id);
        });
        return;
      }

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
      this.teams = data.teams;
    },
  },
};
</script>
