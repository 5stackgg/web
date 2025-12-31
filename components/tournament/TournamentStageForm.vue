<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import MatchOptions from "~/components/MatchOptions.vue";
import { $, e_map_pool_types_enum } from "~/generated/zeus";
</script>

<template>
  <form @submit.prevent="updateCreateStage" class="grid gap-4">
    <FormField v-slot="{ componentField }" name="groups">
      <FormItem>
        <FormLabel>{{ $t("tournament.stage.groups") }}</FormLabel>
        <FormControl>
          <Input
            v-bind="componentField"
            type="number"
            min="1"
            :placeholder="$t('tournament.stage.groups_placeholder')"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="stage_type">
      <FormItem>
        <FormLabel>{{ $t("tournament.stage.type") }}</FormLabel>
        <Select v-bind="componentField">
          <FormControl>
            <SelectTrigger>
              <SelectValue
                :placeholder="$t('tournament.stage.type_placeholder')"
              />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="type in e_tournament_stage_types"
                :key="type.value"
                :value="type.value"
              >
                {{ type.description }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="min_teams">
      <FormItem>
        <FormLabel>{{ $t("tournament.stage.min_teams") }}</FormLabel>
        <FormControl>
          <Select v-bind="componentField">
            <FormControl>
              <SelectTrigger>
                <SelectValue
                  :placeholder="$t('tournament.stage.min_teams_placeholder')"
                />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="option in minTeamOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.display }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="max_teams">
      <FormItem>
        <FormLabel>{{ $t("tournament.stage.max_teams") }}</FormLabel>
        <FormControl>
          <Select v-bind="componentField">
            <FormControl :disabled="!form.values.min_teams">
              <SelectTrigger>
                <SelectValue
                  :placeholder="$t('tournament.stage.max_teams_placeholder')"
                />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="option in maxTeamOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.display }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <Collapsible>
      <CollapsibleTrigger
        class="my-2 flex items-center underline text-base text-primary cursor-pointer"
      >
        {{ $t("tournament.stage.match_options_advanced") }}
      </CollapsibleTrigger>
      <CollapsibleContent class="mt-2">
        <match-options :form="form"></match-options>
      </CollapsibleContent>
    </Collapsible>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      <template v-if="stage">{{ $t("tournament.stage.update") }}</template>
      <template v-else>{{ $t("tournament.stage.create") }}</template>
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { e_tournament_stage_types_enum } from "~/generated/zeus";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { toTypedSchema } from "@vee-validate/zod";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { mapFields } from "~/graphql/mapGraphql";

export default {
  emits: ["updated"],
  props: {
    stage: {
      type: Object,
      required: false,
    },
    order: {
      type: Number,
      required: true,
    },
    tournament: {
      type: Object,
      required: false,
    },
  },
  apollo: {
    e_tournament_stage_types: {
      fetchPolicy: "cache-first",
      query: generateQuery({
        e_tournament_stage_types: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
      result({
        data,
      }: {
        data: {
          e_tournament_stage_types: Array<{
            value: string;
            description: string;
          }>;
        };
      }) {
        (this as any).e_tournament_stage_types = data.e_tournament_stage_types;
      },
    },
    map_pools: {
      query: generateQuery({
        map_pools: [
          {
            where: {
              enabled: {
                _eq: true,
              },
              seed: {
                _eq: true,
              },
            },
          },
          {
            id: true,
            type: true,
            maps: [{}, mapFields],
          },
        ],
      }),
    },
  },
  data() {
    return {
      e_tournament_stage_types: [] as Array<{
        value: string;
        description: string;
      }>,
      form: useForm({
        keepValuesOnUnmount: true,
        validationSchema: toTypedSchema(
          matchOptionsValidator(
            this,
            {
              groups: z.number().default(1),
              stage_type: z.string(),
              min_teams: z.string().refine((val) => !isNaN(parseInt(val)), {
                message: "min teams must be a number",
              }),
              max_teams: z.string().refine((val) => !isNaN(parseInt(val)), {
                message: "max teams must be a number",
              }),
            },
            (useApplicationSettingsStore() as any).settings,
          ).refine(
            (data) => parseInt(data.min_teams) <= parseInt(data.max_teams),
            {
              message: "max teams must be greater than min teams",
              path: ["min_teams"],
            },
          ),
        ),
      }),
    };
  },
  watch: {
    stage: {
      immediate: true,
      handler(stage) {
        if (stage) {
          // Set stage-specific fields (stage type, groups, teams)
          this.form.setValues({
            stage_type: stage.type, // Tournament stage type (SingleElimination, etc.)
            groups: stage.groups,
            min_teams: stage.min_teams.toString(),
            max_teams: stage.max_teams.toString(),
          });

          // Load match options from stage if they exist
          if (stage.options) {
            this.form.setValues({
              // Match type and other match options
              type: stage.options.type, // Match type (Competitive, Duel, Wingman)
              mr: stage.options.mr.toString(),
              coaches: stage.options.coaches,
              knife_round: stage.options.knife_round,
              default_models: stage.options.default_models,
              region_veto: stage.options.region_veto,
              overtime: stage.options.overtime,
              best_of: stage.options.best_of.toString(),
              number_of_substitutes: stage.options.number_of_substitutes,
              timeout_setting: stage.options.timeout_setting,
              tech_timeout_setting: stage.options.tech_timeout_setting,
              ready_setting: stage.options.ready_setting,
              map_pool_id: stage.options.map_pool?.id,
              regions: stage.options.regions || [],
            });

            // Check if it's a custom map pool
            if (
              stage.options.map_pool &&
              !this.isDefaultMapPoolForStage(stage.options.map_pool)
            ) {
              this.form.setValues({
                custom_map_pool: true,
                map_pool: stage.options.map_pool.maps.map(
                  ({ id }: { id: string }) => id,
                ),
              });
            }
          } else if (this.tournament) {
            // If no match options, use tournament defaults for all match options
            this.form.setValues({
              type: this.tournament.options.type,
              mr: this.tournament.options.mr.toString(),
              coaches: this.tournament.options.coaches,
              knife_round: this.tournament.options.knife_round,
              default_models: this.tournament.options.default_models,
              region_veto: this.tournament.options.region_veto,
              overtime: this.tournament.options.overtime,
              best_of: this.tournament.options.best_of.toString(),
              number_of_substitutes:
                this.tournament.options.number_of_substitutes,
              timeout_setting: this.tournament.options.timeout_setting,
              tech_timeout_setting:
                this.tournament.options.tech_timeout_setting,
              ready_setting: this.tournament.options.ready_setting,
              map_pool_id: this.tournament.options.map_pool.id,
              regions: this.tournament.options.regions || [],
              map_veto: true,
            });
          }
        } else {
          this.form.setValues({
            groups: 1,
          });
        }
      },
    },
    tournament: {
      immediate: true,
      handler(tournament) {
        if (tournament && !this.stage) {
          this.form.setValues({
            type: tournament.options.type,
            mr: tournament.options.mr.toString(),
            coaches: tournament.options.coaches,
            knife_round: tournament.options.knife_round,
            default_models: tournament.options.default_models,
            region_veto: tournament.options.region_veto,
            overtime: tournament.options.overtime,
            best_of: tournament.options.best_of.toString(),
            number_of_substitutes: tournament.options.number_of_substitutes,
            timeout_setting: tournament.options.timeout_setting,
            tech_timeout_setting: tournament.options.tech_timeout_setting,
            ready_setting: tournament.options.ready_setting,
            map_pool_id: tournament.options.map_pool.id,
            regions: tournament.options.regions || [],
            map_veto: true,
          });
        }
      },
    },
    isDefaultMapPool: {
      immediate: true,
      handler(isDefaultMapPool) {
        if (isDefaultMapPool || !this.stage?.options) {
          return;
        }

        this.form.setValues({
          custom_map_pool: true,
          map_pool_id: this.stage.options.map_pool?.id,
          map_pool: this.stage.options.map_pool?.maps.map(
            ({ id }: { id: string }) => {
              return id;
            },
          ),
        });
      },
    },
  },
  computed: {
    minTeamOptions() {
      return this.baseNumberOfTeamsOptions;
    },
    maxTeamOptions() {
      if (!this.form.values.min_teams) {
        return;
      }
      return this.baseNumberOfTeamsOptions.filter((option) => {
        return parseInt(option.value) >= parseInt(this.form.values.min_teams);
      });
    },
    baseNumberOfTeamsOptions() {
      let options = [];
      switch (this.form.values.stage_type) {
        case e_tournament_stage_types_enum.DoubleElimination:
        case e_tournament_stage_types_enum.SingleElimination:
          let max = 256;

          while (max > 2) {
            options.push({
              value: max.toString(),
              display: max,
            });

            max = max / 2;
          }

          if (this.order > 1) {
            options.push({
              value: "2",
              display: 2,
            });
          }

          break;
        case e_tournament_stage_types_enum.RoundRobin:
          for (let i = 16; i >= 4; i -= 2) {
            options.push({
              value: i.toString(),
              display: i,
            });
          }
          break;
        case e_tournament_stage_types_enum.Swiss:
          for (let i = 64; i >= 10; i -= 2) {
            options.push({
              value: i.toString(),
              display: i,
            });
          }
          break;
      }

      return options.reverse();
    },
    defaultMapPool() {
      return (this as any).map_pools?.find((pool: any) => {
        return pool.type === this.form.values.type;
      });
    },
    isDefaultMapPool() {
      if (!this.defaultMapPool || !this.stage?.options) {
        return true;
      }
      return this.defaultMapPool.id === this.stage.options.map_pool?.id;
    },
  },
  methods: {
    isDefaultMapPoolForStage(mapPool: any) {
      if (!this.defaultMapPool || !mapPool) {
        return false;
      }
      return this.defaultMapPool.id === mapPool.id;
    },
    async getMapPoolId(
      form: any,
      customMatchOptions: boolean,
    ): Promise<string | null> {
      if (!form.custom_map_pool || !customMatchOptions) {
        return form.map_pool_id;
      }

      // Check if we already have a custom map pool and if the maps have changed
      if (form.map_pool_id && this.stage?.options?.map_pool) {
        const existingMapPool = this.stage.options.map_pool;
        const existingMapIds =
          existingMapPool.maps?.map((map: any) => map.id).sort() || [];
        const newMapIds = [...form.map_pool].sort();

        // If maps haven't changed, reuse the existing map pool
        if (
          existingMapIds.length === newMapIds.length &&
          existingMapIds.every(
            (id: string, index: number) => id === newMapIds[index],
          )
        ) {
          return form.map_pool_id;
        }

        // Maps have changed - update the existing map pool
        // First delete all existing map relationships
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            delete__map_pool: [
              {
                where: {
                  map_pool_id: {
                    _eq: form.map_pool_id,
                  },
                },
              },
              {
                affected_rows: true,
              },
            ],
          }),
        });

        // Then insert the new map relationships
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert__map_pool: [
              {
                objects: form.map_pool.map((map_id: string) => ({
                  map_id: map_id,
                  map_pool_id: form.map_pool_id,
                })),
              },
              {
                affected_rows: true,
              },
            ],
          }),
        });

        return form.map_pool_id;
      }

      // No existing map pool or maps have changed - create new custom map pool
      const { data } = await (this as any).$apollo.mutate({
        variables: {
          map_pool: {
            type: e_map_pool_types_enum.Custom,
            maps: {
              data: form.map_pool.map((map_id: string) => {
                return {
                  id: map_id,
                };
              }),
            },
          },
        },
        mutation: generateMutation({
          insert_map_pools_one: [
            {
              object: $("map_pool", "map_pools_insert_input!"),
            },
            {
              id: true,
            },
          ],
        }),
      });
      return data.insert_map_pools_one.id;
    },
    async updateMatchOptions(
      matchOptionsId: string,
      form: any,
      mapPoolId: string | null,
    ): Promise<string> {
      await (this as any).$apollo.mutate({
        variables: {
          id: matchOptionsId,
          mr: parseInt(form.mr),
          type: form.type,
          best_of: parseInt(form.best_of),
          knife_round: form.knife_round,
          default_models: form.default_models,
          overtime: form.overtime,
          coaches: form.coaches,
          region_veto: form.region_veto,
          regions: form.regions,
          number_of_substitutes: form.number_of_substitutes,
          timeout_setting: form.timeout_setting,
          ready_setting: form.ready_setting,
          tech_timeout_setting: form.tech_timeout_setting,
          map_pool_id: mapPoolId,
        },
        mutation: generateMutation({
          update_match_options_by_pk: [
            {
              pk_columns: {
                id: $("id", "uuid!"),
              },
              _set: {
                mr: $("mr", "Int!"),
                type: $("type", "e_match_types_enum!"),
                best_of: $("best_of", "Int!"),
                knife_round: $("knife_round", "Boolean!"),
                default_models: $("default_models", "Boolean!"),
                overtime: $("overtime", "Boolean!"),
                map_veto: true,
                region_veto: $("region_veto", "Boolean!"),
                regions: $("regions", "[String!]!"),
                coaches: $("coaches", "Boolean!"),
                number_of_substitutes: $("number_of_substitutes", "Int!"),
                ready_setting: $("ready_setting", "e_ready_settings_enum!"),
                timeout_setting: $(
                  "timeout_setting",
                  "e_timeout_settings_enum!",
                ),
                tech_timeout_setting: $(
                  "tech_timeout_setting",
                  "e_timeout_settings_enum!",
                ),
                map_pool_id: $("map_pool_id", "uuid!"),
              },
            },
            {
              id: true,
            },
          ],
        }),
      });
      return matchOptionsId;
    },
    async createMatchOptions(
      form: any,
      mapPoolId: string | null,
    ): Promise<string> {
      const { data } = await (this as any).$apollo.mutate({
        variables: {
          mr: parseInt(form.mr),
          type: form.type,
          best_of: parseInt(form.best_of),
          knife_round: form.knife_round,
          default_models: form.default_models,
          overtime: form.overtime,
          coaches: form.coaches,
          region_veto: form.region_veto,
          regions: form.regions,
          number_of_substitutes: form.number_of_substitutes,
          timeout_setting: form.timeout_setting,
          ready_setting: form.ready_setting,
          tech_timeout_setting: form.tech_timeout_setting,
          map_pool_id: mapPoolId,
        },
        mutation: generateMutation({
          insert_match_options_one: [
            {
              object: {
                mr: $("mr", "Int!"),
                type: $("type", "e_match_types_enum!"),
                best_of: $("best_of", "Int!"),
                knife_round: $("knife_round", "Boolean!"),
                default_models: $("default_models", "Boolean!"),
                overtime: $("overtime", "Boolean!"),
                map_veto: true,
                region_veto: $("region_veto", "Boolean!"),
                regions: $("regions", "[String!]!"),
                coaches: $("coaches", "Boolean!"),
                number_of_substitutes: $("number_of_substitutes", "Int!"),
                ready_setting: $("ready_setting", "e_ready_settings_enum!"),
                timeout_setting: $(
                  "timeout_setting",
                  "e_timeout_settings_enum!",
                ),
                tech_timeout_setting: $(
                  "tech_timeout_setting",
                  "e_timeout_settings_enum!",
                ),
                map_pool_id: $("map_pool_id", "uuid!"),
              },
            },
            {
              id: true,
            },
          ],
        }),
      });
      return data.insert_match_options_one.id;
    },
    async deleteMatchOptions(matchOptionsId: string): Promise<void> {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          delete_match_options_by_pk: [
            {
              id: matchOptionsId,
            },
            {
              __typename: true,
            },
          ],
        }),
      });
    },
    hasMatchOptionsChanged() {
      if (!this.tournament) {
        return false;
      }

      const form = this.form.values;
      const tournamentOptions = this.tournament.options;

      // Check if match type differs
      if (form.type !== tournamentOptions.type) {
        return true;
      }

      // Check if other match options differ
      if (
        parseInt(form.mr) !== tournamentOptions.mr ||
        form.coaches !== tournamentOptions.coaches ||
        form.knife_round !== tournamentOptions.knife_round ||
        form.default_models !== tournamentOptions.default_models ||
        form.region_veto !== tournamentOptions.region_veto ||
        form.overtime !== tournamentOptions.overtime ||
        parseInt(form.best_of) !== tournamentOptions.best_of ||
        form.number_of_substitutes !==
          tournamentOptions.number_of_substitutes ||
        form.timeout_setting !== tournamentOptions.timeout_setting ||
        form.tech_timeout_setting !== tournamentOptions.tech_timeout_setting ||
        form.ready_setting !== tournamentOptions.ready_setting ||
        JSON.stringify(form.regions || []) !==
          JSON.stringify(tournamentOptions.regions || [])
      ) {
        return true;
      }

      // Check if map pool differs
      // If using custom map pool, check if the selected maps differ
      if (form.custom_map_pool) {
        // Custom map pool always means it's different
        return true;
      }

      // If not custom, check if map_pool_id differs from tournament default
      if (form.map_pool_id !== tournamentOptions.map_pool.id) {
        return true;
      }

      return false;
    },
    async updateCreateStage() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      const form = this.form.values;
      const customMatchOptions = this.hasMatchOptionsChanged();

      if (this.stage) {
        // Handle match options first to get the match_options_id
        let matchOptionsId: string | null = null;

        if (this.stage.options?.id) {
          // Match options exist - update if different, delete if same
          if (customMatchOptions) {
            const mapPoolId = await this.getMapPoolId(form, customMatchOptions);
            matchOptionsId = await this.updateMatchOptions(
              this.stage.options.id,
              form,
              mapPoolId,
            );
          } else {
            // Match options exist but match tournament defaults - delete them
            await this.deleteMatchOptions(this.stage.options.id);
            matchOptionsId = null;
          }
        } else {
          // Match options don't exist - create if different, do nothing if same
          if (customMatchOptions) {
            const mapPoolId = await this.getMapPoolId(form, customMatchOptions);
            matchOptionsId = await this.createMatchOptions(form, mapPoolId);
          }
        }

        // Update stage with match_options_id
        const updateSet: any = {
          order: this.order,
          groups: this.form.values.groups,
          type: this.form.values.stage_type,
          min_teams: this.form.values.min_teams,
          max_teams: this.form.values.max_teams,
        };

        if (matchOptionsId !== null) {
          updateSet.match_options_id = matchOptionsId;
        } else {
          updateSet.match_options_id = null;
        }

        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_tournament_stages_by_pk: [
              {
                pk_columns: {
                  id: this.stage.id,
                },
                _set: updateSet,
              },
              {
                __typename: true,
              },
            ],
          }),
        });

        this.$emit("updated");
        return;
      }

      // Create new stage
      let matchOptionsId: string | null = null;

      // Handle match options if they differ from tournament defaults
      if (customMatchOptions) {
        const mapPoolId = await this.getMapPoolId(form, customMatchOptions);
        // We'll create the match options after the stage is created
        // First create the stage, then create match options and update the stage
      }

      const { data: stageData } = await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_stages_one: [
            {
              object: {
                order: this.order,
                groups: this.form.values.groups,
                type: this.form.values.stage_type,
                min_teams: this.form.values.min_teams,
                max_teams: this.form.values.max_teams,
                tournament_id:
                  (this as any).$route.params.tournamentId ||
                  (this as any).$route.params.id,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      const stageId = stageData.insert_tournament_stages_one.id;

      // Create match options if they differ from tournament defaults
      if (customMatchOptions) {
        const mapPoolId = await this.getMapPoolId(form, customMatchOptions);
        matchOptionsId = await this.createMatchOptions(form, mapPoolId);

        // Update stage with match_options_id
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_tournament_stages_by_pk: [
              {
                pk_columns: {
                  id: stageId,
                },
                _set: {
                  match_options_id: matchOptionsId,
                } as any,
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      }

      // Emit updated event with the order so parent can switch to this tab
      this.$emit("updated", this.order);
    },
  },
};
</script>
