<script lang="ts" setup>
import TeamSearch from "~/components/teams/TeamSearch.vue";
import MatchOptions from "~/components/MatchOptions.vue";
import { Info } from "lucide-vue-next";
</script>

<template>
  <form @submit.prevent="updateMatch">
    <MatchOptions :form="form" :match="match">
      <template #left>
        <FormField v-if="!match" v-slot="{ value, handleChange }" name="pug">
          <FormItem
            class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
            @click="handleChange(!value)"
          >
            <div class="flex justify-between items-center">
              <FormLabel class="text-lg font-semibold">{{
                $t("pages.matches.create_page.pick_up_game")
              }}</FormLabel>
              <FormControl>
                <Switch
                  class="pointer-events-none"
                  :model-value="value"
                  @update:model-value="handleChange"
                />
              </FormControl>
            </div>
            <FormDescription>
              {{ $t("pages.matches.create_page.pick_up_game_description") }}
            </FormDescription>
          </FormItem>
        </FormField>

        <div
          class="flex flex-col gap-4 rounded-lg border p-4"
          v-if="!form.values.pug"
        >
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FormField v-slot="{ handleChange, componentField }" name="team_1">
              <FormItem>
                <FormLabel>{{
                  $t("pages.matches.create_page.team_1")
                }}</FormLabel>
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

            <FormField v-slot="{ handleChange, componentField }" name="team_2">
              <FormItem>
                <FormLabel>{{
                  $t("pages.matches.create_page.team_2")
                }}</FormLabel>
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
            class="flex items-center gap-2 text-sm text-muted-foreground italic"
          >
            <Info class="inline-block w-4 h-4" />
            <span>
              {{ $t("pages.matches.create_page.intra_team_scrimmage") }}
            </span>
          </div>
        </div>
      </template>
    </MatchOptions>

    <div class="grid grid-cols-1 md:grid-cols-2">
      <Button type="submit" size="lg" class="mt-6 w-full">
        <template v-if="match">
          {{ $t("pages.matches.create_page.update_button") }}
        </template>
        <template v-else>
          {{ $t("pages.matches.create_page.create_button") }}
        </template>
      </Button>
    </div>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { generateMutation } from "~/graphql/graphqlGen";
import {
  $,
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
            },
            useApplicationSettingsStore().settings,
          ),
        ),
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
  },
  methods: {
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
