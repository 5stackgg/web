<script lang="ts" setup>
import TeamSearch from "~/components/teams/TeamSearch.vue";
import MatchOptions from "~/components/MatchOptions.vue";
import {
  Info,
  Swords,
  PlayIcon,
  Lock,
  Unlock,
  Send,
  Handshake,
} from "lucide-vue-next";
import { e_lobby_access_enum } from "~/generated/zeus";
import { useI18n } from "vue-i18n";
import { computed } from "vue";

const { t } = useI18n();

const lobbyAccessOptions = computed(() => [
  {
    value: e_lobby_access_enum.Private,
    label: t("match_access.private"),
    description: t("match_access.invite_only_description"),
    icon: Lock,
  },
  {
    value: e_lobby_access_enum.Invite,
    label: t("match_access.invite"),
    description: t("match_access.invite_code_description"),
    icon: Send,
  },
  {
    value: e_lobby_access_enum.Friends,
    label: t("match_access.friends"),
    description: t("match_access.friends_only_description"),
    icon: Handshake,
  },
  {
    value: e_lobby_access_enum.Open,
    label: t("match_access.open"),
    description: t("match_access.open_description"),
    icon: Unlock,
  },
]);

const tickClasses = "w-[10px] h-[2px] bg-[hsl(var(--tac-amber))]";
const accessBtnClasses =
  "inline-flex items-center justify-center gap-[0.45rem] px-[0.65rem] py-[0.6rem] text-[0.8rem] font-semibold tracking-[0.12em] uppercase bg-[hsl(var(--muted)/0.3)] border border-border text-muted-foreground [transition:color_140ms_ease,background_140ms_ease,border-color_140ms_ease] cursor-pointer [clip-path:polygon(6px_0,100%_0,100%_calc(100%-6px),calc(100%-6px)_100%,0_100%,0_6px)] hover:text-foreground hover:bg-[hsl(var(--muted)/0.5)]";
const accessBtnActiveClasses =
  "!text-[hsl(0_0%_8%)] [background:linear-gradient(135deg,hsl(36_100%_65%)_0%,hsl(var(--tac-amber))_100%)] !border-[hsl(var(--tac-amber))] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.4),0_6px_16px_-6px_hsl(var(--tac-amber)/0.5)] hover:[background:linear-gradient(135deg,hsl(36_100%_68%)_0%,hsl(var(--tac-amber))_100%)]";
const tacLabelClasses =
  "font-mono text-[0.7rem] tracking-[0.22em] uppercase text-muted-foreground";
</script>

<template>
  <form @submit.prevent="updateMatch" class="mx-auto w-full max-w-4xl">
    <MatchOptions :form="form" :match="match">
      <template #left>
        <!-- Match Lobby Access -->
        <FormField
          v-if="!isTournamentMatch"
          v-slot="{ value, handleChange }"
          name="lobby_access"
        >
          <FormItem
            class="px-5 py-4 border border-border rounded-lg bg-[hsl(var(--card)/0.55)] backdrop-blur-[6px] flex flex-col gap-3"
          >
            <div class="flex items-center gap-[0.65rem] flex-wrap">
              <span :class="tickClasses"></span>
              <FormLabel :class="tacLabelClasses"> Lobby Access </FormLabel>
              <span class="ml-auto text-[0.78rem] text-muted-foreground">
                {{ activeLobbyAccessDescription(value) }}
              </span>
            </div>
            <div class="grid grid-cols-4 gap-[0.4rem] max-sm:grid-cols-2">
              <button
                v-for="opt in lobbyAccessOptions"
                :key="opt.value"
                type="button"
                :class="[
                  accessBtnClasses,
                  value === opt.value && accessBtnActiveClasses,
                ]"
                @click="handleChange(opt.value)"
              >
                <component :is="opt.icon" class="w-4 h-4" />
                <span>{{ opt.label }}</span>
              </button>
            </div>
          </FormItem>
        </FormField>

        <!-- Pick Up Game toggle -->
        <FormField v-if="!match" v-slot="{ value, handleChange }" name="pug">
          <FormItem>
            <div
              class="relative flex items-center gap-4 px-5 py-4 border border-border rounded-lg bg-[hsl(var(--card)/0.6)] backdrop-blur-[6px] cursor-pointer [transition:border-color_160ms_ease,background_160ms_ease] hover:border-[hsl(var(--tac-amber)/0.4)] hover:bg-[hsl(var(--card)/0.8)]"
              :class="[
                value &&
                  '!border-[hsl(var(--tac-amber)/0.55)] !bg-[hsl(var(--tac-amber)/0.06)]',
              ]"
              @click="handleChange(!value)"
            >
              <div class="flex-1 space-y-1.5">
                <div class="flex items-center gap-2">
                  <span class="text-[hsl(var(--tac-amber))] text-[0.7rem]"
                    >◢</span
                  >
                  <FormLabel
                    class="text-base font-semibold tracking-[0.08em] uppercase cursor-pointer"
                  >
                    {{ $t("pages.matches.create_page.pick_up_game") }}
                  </FormLabel>
                </div>
                <FormDescription class="text-[0.82rem] text-muted-foreground">
                  {{ $t("pages.matches.create_page.pick_up_game_description") }}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  class="pointer-events-none flex-shrink-0"
                  :model-value="value"
                  @update:model-value="handleChange"
                />
              </FormControl>
            </div>
          </FormItem>
        </FormField>

        <!-- Team vs Team picker -->
        <div
          v-if="!form.values.pug"
          class="relative p-5 border border-border rounded-lg [background:linear-gradient(180deg,hsl(var(--card)/0.55)_0%,hsl(var(--card)/0.25)_100%)] backdrop-blur-[6px]"
        >
          <div
            class="inline-flex items-center gap-2 font-mono text-[0.68rem] tracking-[0.24em] uppercase text-muted-foreground mb-[0.85rem]"
          >
            <span :class="tickClasses"></span>
            Lineups
          </div>

          <div
            class="grid grid-cols-[1fr_auto_1fr] gap-4 items-end max-sm:grid-cols-1 max-sm:gap-3"
          >
            <FormField v-slot="{ handleChange, componentField }" name="team_1">
              <FormItem class="min-w-0">
                <FormLabel
                  class="font-mono text-[0.65rem] tracking-[0.22em] uppercase text-muted-foreground"
                >
                  {{ $t("pages.matches.create_page.team_1") }}
                </FormLabel>
                <TeamSearch
                  :label="$t('pages.matches.create_page.search_team')"
                  @selected="
                    (team) => {
                      if (team.id == form.values.team_1) {
                        handleChange(undefined);
                        return;
                      }
                      handleChange(team.id);
                    }
                  "
                  v-model="componentField.modelValue"
                  class="w-full"
                ></TeamSearch>
                <FormMessage />
              </FormItem>
            </FormField>

            <div
              class="inline-flex items-center gap-[0.4rem] px-[0.85rem] py-[0.55rem] mb-0.5 font-bold text-[0.85rem] tracking-[0.22em] text-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.12)] border border-[hsl(var(--tac-amber)/0.4)] [clip-path:polygon(0_0,calc(100%-8px)_0,100%_8px,100%_100%,8px_100%,0_calc(100%-8px))] max-sm:justify-self-center"
              aria-hidden="true"
            >
              <Swords class="w-4 h-4" />
              <span>VS</span>
            </div>

            <FormField v-slot="{ handleChange, componentField }" name="team_2">
              <FormItem class="min-w-0">
                <FormLabel
                  class="font-mono text-[0.65rem] tracking-[0.22em] uppercase text-muted-foreground"
                >
                  {{ $t("pages.matches.create_page.team_2") }}
                </FormLabel>
                <TeamSearch
                  :label="$t('pages.matches.create_page.search_team')"
                  @selected="
                    (team) => {
                      if (team.id == form.values.team_2) {
                        handleChange(undefined);
                        return;
                      }
                      handleChange(team.id);
                    }
                  "
                  v-model="componentField.modelValue"
                  class="w-full"
                ></TeamSearch>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <div
            class="flex items-center gap-2 mt-4 pt-[0.85rem] border-t border-border text-[0.78rem] italic text-muted-foreground"
          >
            <Info class="w-4 h-4 flex-shrink-0" />
            <span>
              {{ $t("pages.matches.create_page.intra_team_scrimmage") }}
            </span>
          </div>
        </div>
      </template>
    </MatchOptions>

    <div class="mt-8 flex justify-center">
      <button
        type="submit"
        class="group/submit relative isolate inline-flex items-center px-12 py-4 font-bold text-base tracking-[0.22em] uppercase text-[hsl(0_0%_8%)] [background:linear-gradient(135deg,hsl(36_100%_65%)_0%,hsl(var(--tac-amber))_50%,hsl(28_90%_52%)_100%)] border border-[hsl(var(--tac-amber))] [clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.4),0_8px_24px_-6px_hsl(var(--tac-amber)/0.6)] [transition:transform_200ms_cubic-bezier(0.4,0,0.2,1),box-shadow_200ms_ease] cursor-pointer overflow-hidden hover:-translate-y-px hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.6),0_14px_36px_-6px_hsl(var(--tac-amber)/0.8),0_0_28px_hsl(var(--tac-amber)/0.35)] active:translate-y-0"
      >
        <span class="relative z-[1] inline-flex items-center gap-3">
          <PlayIcon
            class="w-5 h-5 fill-current [transition:transform_300ms_cubic-bezier(0.4,0,0.2,1)] group-hover/submit:translate-x-0.5 group-hover/submit:scale-[1.08]"
          />
          <span>
            <template v-if="match">
              {{ $t("pages.matches.create_page.update_button") }}
            </template>
            <template v-else>
              {{ $t("pages.matches.create_page.create_button") }}
            </template>
          </span>
        </span>
        <span
          class="absolute inset-0 [background:linear-gradient(90deg,transparent_0%,hsl(0_0%_100%/0.35)_50%,transparent_100%)] -translate-x-full [transition:transform_700ms_cubic-bezier(0.4,0,0.2,1)] pointer-events-none z-0 group-hover/submit:translate-x-full"
          aria-hidden="true"
        ></span>
      </button>
    </div>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  $,
  e_lobby_access_enum,
  e_map_pool_types_enum,
  e_player_roles_enum,
} from "~/generated/zeus";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { toast } from "@/components/ui/toast";
import { toTypedSchema } from "@vee-validate/zod";
import {
  setupOptions,
  setupOptionsVariables,
  setupOptionsSetMutation,
} from "~/utilities/setupOptions";

export default {
  props: {
    match: {
      type: Object,
      required: false,
    },
  },
  data() {
    return {
      form: useForm({
        keepValuesOnUnmount: true,
        validationSchema: toTypedSchema(
          matchOptionsValidator(
            this,
            {
              pug: z.boolean().default(true),
              team_1: z.string().optional(),
              team_2: z.string().optional(),
              lobby_access: z
                .nativeEnum(e_lobby_access_enum)
                .default(e_lobby_access_enum.Private),
            },
            useApplicationSettingsStore().settings,
          ),
        ),
        initialValues: {
          lobby_access: e_lobby_access_enum.Private,
        },
      }),
    };
  },
  watch: {
    match: {
      immediate: true,
      deep: true,
      handler(match) {
        if (!match) {
          return;
        }
        const matchOptions = match.options;

        setupOptions(this.form, matchOptions);

        for (const key in this.form.values) {
          switch (key) {
            case "pug":
              if (match.lineup_1.team_id || match.lineup_2.team_id) {
                this.form.setFieldValue(key, false);
              }
              break;
            case "team_1":
              if (match.lineup_1.team_id) {
                this.form.setFieldValue(key, match.lineup_1.team_id);
              }
              break;
            case "team_2":
              if (match.lineup_2.team_id) {
                this.form.setFieldValue(key, match.lineup_2.team_id);
              }
              break;
            case "map_pool":
              // do nothing, custom map pool will handle this.
              break;
            case "custom_map_pool":
              if (matchOptions.map_pool.type === e_map_pool_types_enum.Custom) {
                this.form.setFieldValue(key, true);
                this.form.setFieldValue(
                  "map_pool",
                  matchOptions.map_pool.maps.map((map) => map.id),
                );
              }
              break;
          }
        }
      },
    },
  },
  computed: {
    canSetVetoSettings() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.match_organizer);
    },
    isTournamentMatch() {
      return !!this.match?.is_tournament_match;
    },
  },
  methods: {
    activeLobbyAccessDescription(value: e_lobby_access_enum | undefined) {
      switch (value) {
        case e_lobby_access_enum.Invite:
          return this.$t("match_access.invite_code_description");
        case e_lobby_access_enum.Friends:
          return this.$t("match_access.friends_only_description");
        case e_lobby_access_enum.Open:
          return this.$t("match_access.open_description");
        case e_lobby_access_enum.Private:
        default:
          return this.$t("match_access.invite_only_description");
      }
    },
    async updateMatch() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      if (!this.match) {
        this.createMatch();
        return;
      }

      const form = this.form.values;

      const matchLineup1 = this.match.lineup_1;
      const matchLineup2 = this.match.lineup_2;

      if (
        (form.team_1 === null && matchLineup1.team_1 !== undefined) ||
        form.team_1 != matchLineup1.team_id
      ) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_match_lineups_by_pk: [
              {
                pk_columns: {
                  id: matchLineup1.id,
                },
                _set: {
                  team_id: form.team_1,
                },
              },
              {
                id: true,
              },
            ],
          }),
        });
      }

      if (
        (form.team_2 === null && matchLineup2.team_2 !== undefined) ||
        form.team_2 != matchLineup2.team_id
      ) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_match_lineups_by_pk: [
              {
                pk_columns: {
                  id: matchLineup2.id,
                },
                _set: {
                  team_id: form.team_2,
                },
              },
              {
                id: true,
              },
            ],
          }),
        });
      }

      let mapPoolId = form.map_pool_id;

      if (
        this.match.options.map_pool.type === e_map_pool_types_enum.Custom &&
        !form.custom_map_pool
      ) {
        mapPoolId = form.map_pool_id;
      }

      if (form.custom_map_pool) {
        if (!mapPoolId) {
          const { data } = await this.$apollo.mutate({
            mutation: generateMutation({
              insert_map_pools_one: [
                {
                  object: {
                    type: e_map_pool_types_enum.Custom,
                    maps: {
                      data: form?.map_pool?.map((map_id) => {
                        return {
                          id: map_id,
                        };
                      }),
                    },
                  },
                },
                {
                  id: true,
                },
              ],
            }),
          });
          mapPoolId = data.insert_map_pools_one.id;
        } else {
          await this.$apollo.mutate({
            mutation: generateMutation({
              delete__map_pool: [
                {
                  where: {
                    map_pool_id: {
                      _eq: mapPoolId,
                    },
                  },
                },
                {
                  affected_rows: true,
                },
              ],
            }),
          });

          await this.$apollo.mutate({
            mutation: generateMutation({
              insert__map_pool: [
                {
                  objects: form?.map_pool?.map((map_id) => {
                    return {
                      map_id: map_id,
                      map_pool_id: mapPoolId,
                    };
                  }),
                },
                {
                  affected_rows: true,
                },
              ],
            }),
          });
        }
      }

      await this.$apollo.mutate({
        variables: setupOptionsVariables(form, {
          mapPoolId: mapPoolId,
          matchOptionsId: this.match.options.id,
        }),
        mutation: generateMutation({
          update_match_options_by_pk: [
            {
              pk_columns: {
                id: $("id", "uuid!"),
              },
              _set: setupOptionsSetMutation(!!mapPoolId),
            },
            {
              id: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("pages.matches.match_updated"),
      });
    },
    async createMatch() {
      const form = this.form.values;

      const { data } = await this.$apollo.mutate({
        variables: setupOptionsVariables(form, {
          mapPoolId: form.map_pool_id,
        }),
        mutation: generateMutation({
          insert_matches_one: [
            {
              object: {
                lineup_1: {
                  data: {
                    ...(this.form.values.team_1
                      ? { team_id: this.form.values.team_1 }
                      : {}),
                  },
                },
                ...(this.form.values.team_2
                  ? {
                      lineup_2: {
                        data: {
                          team_id: this.form.values.team_2,
                        },
                      },
                    }
                  : {}),
                options: {
                  data: setupOptionsSetMutation(!!form.map_pool_id),
                },
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.$router.push(`/matches/${data.insert_matches_one.id}`);
    },
  },
};
</script>
