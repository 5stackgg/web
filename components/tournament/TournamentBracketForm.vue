<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import MatchOptions from "~/components/MatchOptions.vue";
import { $ } from "~/generated/zeus";
</script>

<template>
  <form @submit.prevent="updateBracket" class="grid gap-4">
    <MatchOptions :form="form" :stage-bracket-override="true"></MatchOptions>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      {{ $t("tournament.bracket.update") }}
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { generateMutation } from "~/graphql/graphqlGen";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { toTypedSchema } from "@vee-validate/zod";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

export default {
  emits: ["updated"],
  props: {
    bracket: {
      type: Object,
      required: true,
    },
    tournament: {
      type: Object,
      required: true,
    },
    stage: {
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
            {},
            (useApplicationSettingsStore() as any).settings,
          ),
        ),
      }),
    };
  },
  watch: {
    bracket: {
      immediate: true,
      handler(bracket) {
        if (bracket && this.tournament) {
          // Load match options from bracket if they exist
          if (bracket.options) {
            // Always use tournament defaults for restricted fields
            // Only load allowed fields from bracket options
            this.form.setValues({
              // Restricted fields - always use tournament defaults
              type: this.tournament.options.type,
              mr: this.tournament.options.mr.toString(),
              map_pool_id: this.tournament.options.map_pool.id,
              regions: this.tournament.options.regions || [],
              map_veto: true,
              custom_map_pool: false,
              // Allowed fields - use from bracket options
              coaches: bracket.options.coaches,
              knife_round: bracket.options.knife_round,
              default_models: bracket.options.default_models,
              region_veto: bracket.options.region_veto,
              overtime: bracket.options.overtime,
              best_of: bracket.options.best_of.toString(),
              number_of_substitutes: bracket.options.number_of_substitutes,
              timeout_setting: bracket.options.timeout_setting,
              tech_timeout_setting: bracket.options.tech_timeout_setting,
              ready_setting: bracket.options.ready_setting,
            });
          } else {
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
        }
      },
    },
    tournament: {
      immediate: true,
      handler(tournament) {
        if (tournament && this.bracket) {
          // Always sync restricted fields from tournament
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
  methods: {
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
    async getMapPoolId(
      form: any,
      customMatchOptions: boolean,
    ): Promise<string | null> {
      // Map pools are restricted - always use tournament default
      // Custom map pools are not allowed for brackets
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
    async updateBracket() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      const form = this.form.values;
      const customMatchOptions = this.hasMatchOptionsChanged();

      // Handle match options first to get the match_options_id
      let matchOptionsId: string | null = null;

      if (this.bracket.options?.id) {
        // Match options exist - update if different, delete if same
        if (customMatchOptions) {
          const mapPoolId = await this.getMapPoolId(form, customMatchOptions);
          matchOptionsId = await this.updateMatchOptions(
            this.bracket.options.id,
            form,
            mapPoolId,
          );
        } else {
          // Match options exist but match tournament defaults - delete them
          // First, remove the reference from the bracket to avoid FK constraint issues
          await (this as any).$apollo.mutate({
            mutation: generateMutation({
              update_tournament_brackets_by_pk: [
                {
                  pk_columns: {
                    id: this.bracket.id,
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
          await this.deleteMatchOptions(this.bracket.options.id);
          matchOptionsId = null;
        }
      } else {
        // Match options don't exist - create if different, do nothing if same
        if (customMatchOptions) {
          const mapPoolId = await this.getMapPoolId(form, customMatchOptions);
          matchOptionsId = await this.createMatchOptions(form, mapPoolId);
        }
      }

      // Update bracket with match_options_id (only if we have a new one or need to set it)
      if (matchOptionsId !== null) {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_tournament_brackets_by_pk: [
              {
                pk_columns: {
                  id: this.bracket.id,
                },
                _set: {
                  match_options_id: matchOptionsId,
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      }

      this.$emit("updated");
    },
  },
};
</script>
