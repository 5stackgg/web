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

    <MatchOptions :form="form" :stage-bracket-override="true"></MatchOptions>

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
          if (stage.options && this.tournament) {
            // Always use tournament defaults for restricted fields
            // Only load allowed fields from stage options
            this.form.setValues({
              // Restricted fields - always use tournament defaults
              type: this.tournament.options.type,
              mr: this.tournament.options.mr.toString(),
              map_pool_id: this.tournament.options.map_pool.id,
              regions: this.tournament.options.regions || [],
              map_veto: true,
              custom_map_pool: false,
              // Allowed fields - use from stage options
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
            });
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
          // Always use tournament defaults for all fields when creating new stage
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
            custom_map_pool: false,
          });
        } else if (tournament && this.stage) {
          // When tournament changes, ensure restricted fields use tournament defaults
          this.form.setValues({
            type: tournament.options.type,
            mr: tournament.options.mr.toString(),
            map_pool_id: tournament.options.map_pool.id,
            regions: tournament.options.regions || [],
            map_veto: true,
            custom_map_pool: false,
          });
        }
      },
    },
    // Ensure restricted fields always use tournament defaults
    "tournament.options": {
      deep: true,
      handler() {
        if (!this.tournament) {
          return;
        }
        // Always sync restricted fields from tournament
        this.form.setValues({
          type: this.tournament.options.type,
          mr: this.tournament.options.mr.toString(),
          map_pool_id: this.tournament.options.map_pool.id,
          regions: this.tournament.options.regions || [],
          map_veto: true,
          custom_map_pool: false,
        });
      },
    },
    // Watch restricted fields and reset them to tournament defaults if changed
    "form.values.type": {
      handler(newValue) {
        if (this.tournament && newValue !== this.tournament.options.type) {
          this.form.setFieldValue("type", this.tournament.options.type);
        }
      },
    },
    "form.values.mr": {
      handler(newValue) {
        if (
          this.tournament &&
          parseInt(newValue) !== this.tournament.options.mr
        ) {
          this.form.setFieldValue("mr", this.tournament.options.mr.toString());
        }
      },
    },
    "form.values.regions": {
      deep: true,
      handler(newValue) {
        if (this.tournament) {
          const tournamentRegions = this.tournament.options.regions || [];
          const formRegions = newValue || [];
          if (
            JSON.stringify(tournamentRegions.sort()) !==
            JSON.stringify(formRegions.sort())
          ) {
            this.form.setFieldValue("regions", [...tournamentRegions]);
          }
        }
      },
    },
    "form.values.map_pool_id": {
      handler(newValue) {
        if (
          this.tournament &&
          newValue !== this.tournament.options.map_pool.id
        ) {
          this.form.setFieldValue(
            "map_pool_id",
            this.tournament.options.map_pool.id,
          );
        }
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
      let max = 256;
      let options = [];

      switch (this.form.values.stage_type) {
        case e_tournament_stage_types_enum.SingleElimination:
        case e_tournament_stage_types_enum.DoubleElimination:
          while (max > 2) {
            options.push({
              value: max.toString(),
              display: max,
            });

            max--;
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
    async getMapPoolId(
      form: any,
      customMatchOptions: boolean,
    ): Promise<string | null> {
      // Map pools are restricted - always use tournament default
      // Custom map pools are not allowed for stages
      if (!this.tournament) {
        return null;
      }
      return this.tournament.options.map_pool.id;
    },
    async updateMatchOptions(
      matchOptionsId: string,
      form: any,
      mapPoolId: string | null,
    ): Promise<string> {
      // Always use tournament defaults for restricted fields
      if (!this.tournament) {
        throw new Error("Tournament is required");
      }
      const tournamentOptions = this.tournament.options;

      await (this as any).$apollo.mutate({
        variables: {
          id: matchOptionsId,
          // Restricted fields - use tournament defaults
          mr: tournamentOptions.mr,
          type: tournamentOptions.type,
          regions: tournamentOptions.regions || [],
          map_pool_id: mapPoolId || tournamentOptions.map_pool.id,
          // Allowed fields - use from form
          best_of: parseInt(form.best_of),
          knife_round: form.knife_round,
          default_models: form.default_models,
          overtime: form.overtime,
          coaches: form.coaches,
          region_veto: form.region_veto,
          number_of_substitutes: form.number_of_substitutes,
          timeout_setting: form.timeout_setting,
          ready_setting: form.ready_setting,
          tech_timeout_setting: form.tech_timeout_setting,
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
      // Always use tournament defaults for restricted fields
      if (!this.tournament) {
        throw new Error("Tournament is required");
      }
      const tournamentOptions = this.tournament.options;

      const { data } = await (this as any).$apollo.mutate({
        variables: {
          // Restricted fields - use tournament defaults
          mr: tournamentOptions.mr,
          type: tournamentOptions.type,
          regions: tournamentOptions.regions || [],
          map_pool_id: mapPoolId || tournamentOptions.map_pool.id,
          // Allowed fields - use from form
          best_of: parseInt(form.best_of),
          knife_round: form.knife_round,
          default_models: form.default_models,
          overtime: form.overtime,
          coaches: form.coaches,
          region_veto: form.region_veto,
          number_of_substitutes: form.number_of_substitutes,
          timeout_setting: form.timeout_setting,
          ready_setting: form.ready_setting,
          tech_timeout_setting: form.tech_timeout_setting,
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

      // Only check allowed fields that can be modified:
      // coaches, knife_round, default_models, region_veto, overtime,
      // best_of, number_of_substitutes, timeout_setting, tech_timeout_setting, ready_setting
      if (
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
        form.ready_setting !== tournamentOptions.ready_setting
      ) {
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
            // First, remove the reference from the stage to avoid FK constraint issues
            await (this as any).$apollo.mutate({
              mutation: generateMutation({
                update_tournament_stages_by_pk: [
                  {
                    pk_columns: {
                      id: this.stage.id,
                    },
                    _set: {
                      match_options_id: null,
                    },
                  },
                  {
                    __typename: true,
                  },
                ],
              }),
            });
            // Now safe to delete the match options
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
