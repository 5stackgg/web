<script setup lang="ts">
import { CaretSortIcon } from "@radix-icons/vue";
import { Switch } from "~/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import { useMediaQuery } from "@vueuse/core";
import debounce from "~/utilities/debounce";
import { e_team_roles_enum } from "~/generated/zeus";

const isMobile = useMediaQuery("(max-width: 768px)");
const { height: viewportHeight } = useVisualViewport();
</script>

<template>
  <!-- Mobile: Drawer -->
  <Drawer v-if="isMobile" v-model:open="open">
    <div
      @click="
        open = true;
        searchTeams();
      "
    >
      <Button variant="outline" class="justify-between w-full">
        <div class="flex items-center gap-2 min-w-0">
          <Avatar
            v-if="selectedTeam"
            class="h-5 w-5 rounded shrink-0"
          >
            <AvatarImage
              v-if="teamAvatarSrc(selectedTeam)"
              :src="teamAvatarSrc(selectedTeam)!"
              :alt="selectedTeam.name"
            />
            <AvatarFallback class="rounded text-[10px]">
              {{ (selectedTeam.short_name || selectedTeam.name).slice(0, 2) }}
            </AvatarFallback>
          </Avatar>
          <span class="truncate">
            {{ selectedTeam?.name || label }}
          </span>
        </div>
        <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </div>
    <DrawerContent>
      <DrawerTitle class="sr-only">{{ label }}</DrawerTitle>
      <div
        class="flex flex-col"
        :style="{ height: `${viewportHeight * 0.9}px` }"
      >
        <div class="flex-1 overflow-y-auto min-h-0 p-4 flex flex-col">
          <div class="flex-1" />
          <div
            v-if="!teams?.length"
            class="p-4 text-center text-muted-foreground"
          >
            {{ $t("team.search.no_teams_found") }}
          </div>

          <div v-else class="divide-y">
            <div
              v-for="team in teams"
              :key="team.id"
              class="px-3 py-2 hover:bg-accent cursor-pointer"
              @click="select(team)"
            >
              <div class="flex items-center gap-2 min-w-0">
                <Avatar class="h-6 w-6 rounded shrink-0">
                  <AvatarImage
                    v-if="teamAvatarSrc(team)"
                    :src="teamAvatarSrc(team)!"
                    :alt="team.name"
                  />
                  <AvatarFallback class="rounded text-[10px]">
                    {{ (team.short_name || team.name).slice(0, 2) }}
                  </AvatarFallback>
                </Avatar>
                <span class="text-xs text-muted-foreground">
                  [{{ team.short_name }}]
                </span>
                <span class="truncate">{{ team.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="teams?.length"
          class="px-4 py-2 text-xs text-muted-foreground border-t"
        >
          {{ teams.length }} {{ $t("team.search.found_teams") }}
        </div>

        <div class="flex items-center justify-between p-4 border-t">
          <input
            ref="mobileSearchInput"
            v-model="query"
            :placeholder="$t('team.search.placeholder')"
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
          <div class="flex items-center gap-2 ml-4" v-if="!myTeams">
            <Switch
              class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
              :model-value="myTeamsOnly"
              @click="toggleMyTeamsOnly"
            />
            {{ $t("team.search.my_teams_only") }}
          </div>
        </div>
      </div>
    </DrawerContent>
  </Drawer>

  <!-- Desktop: Popover -->
  <Popover v-else v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        @click="searchTeams()"
        variant="outline"
        :aria-expanded="open"
        class="justify-between w-full"
      >
        <div class="flex items-center gap-2 min-w-0">
          <Avatar
            v-if="selectedTeam"
            class="h-5 w-5 rounded shrink-0"
          >
            <AvatarImage
              v-if="teamAvatarSrc(selectedTeam)"
              :src="teamAvatarSrc(selectedTeam)!"
              :alt="selectedTeam.name"
            />
            <AvatarFallback class="rounded text-[10px]">
              {{ (selectedTeam.short_name || selectedTeam.name).slice(0, 2) }}
            </AvatarFallback>
          </Avatar>
          <span class="truncate">
            {{ selectedTeam?.name || label }}
          </span>
        </div>
        <CaretSortIcon class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="p-0 w-[400px]">
      <div class="flex flex-col">
        <div class="flex items-center justify-between px-3 py-2 border-b">
          <input
            v-model="query"
            :placeholder="$t('team.search.placeholder')"
            type="search"
            inputmode="search"
            enterkeyhint="search"
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
                <div class="flex items-center gap-2 min-w-0">
                  <Avatar class="h-6 w-6 rounded shrink-0">
                    <AvatarImage
                      v-if="teamAvatarSrc(team)"
                      :src="teamAvatarSrc(team)!"
                      :alt="team.name"
                    />
                    <AvatarFallback class="rounded text-[10px]">
                      {{ (team.short_name || team.name).slice(0, 2) }}
                    </AvatarFallback>
                  </Avatar>
                  <span class="text-xs text-muted-foreground">
                    [{{ team.short_name }}]
                  </span>
                  <span class="truncate">{{ team.name }}</span>
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
  avatar_url?: string | null;
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
    open: {
      handler(newOpen: boolean) {
        if (newOpen) {
          this.searchTeams();
          this.$nextTick(() => {
            (this.$refs.mobileSearchInput as HTMLInputElement)?.focus();
          });
        }
      },
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
                avatar_url: true,
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
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    selectedTeam(): Team | undefined {
      return this.teams?.find((team) => team.id === this.modelValue);
    },
  },
  methods: {
    teamAvatarSrc(team: { avatar_url?: string | null }): string | null {
      if (!team.avatar_url) return null;
      return `https://${this.apiDomain}/${team.avatar_url}`;
    },
    toggleMyTeamsOnly() {
      this.myTeamsOnly = !this.myTeamsOnly;
      this.searchTeams();
      this.$nextTick(() => {
        (this.$refs.mobileSearchInput as HTMLInputElement)?.focus();
      });
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
      if (query !== undefined) {
        this.query = query;
      }

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
                    this.query
                      ? {
                          name: {
                            _ilike: `%${this.query}%`,
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
              avatar_url: true,
            },
          ],
        }),
      });
      this.teams = data.teams;
    },
  },
};
</script>
