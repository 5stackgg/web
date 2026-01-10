<script setup lang="ts">
import { Button } from "@/components/ui/button";
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
import { useForm } from "vee-validate";
import { generateMutation } from "~/graphql/graphqlGen";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { toTypedSchema } from "@vee-validate/zod";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import {
  setupOptions,
  setupOptionsVariables,
  setupOptionsSetMutation,
} from "~/utilities/setupOptions";

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
      handler() {
        this.setFormOptions();
      },
    },
    tournament: {
      immediate: true,
      handler() {
        this.setFormOptions();
      },
    },
  },
  computed: {
    defaultOptions() {
      return this.stage?.options
        ? this.stage.options
        : this.tournament?.options;
    },
  },
  methods: {
    setFormOptions() {
      if (!this.bracket && !this.tournament) {
        return;
      }

      setupOptions(
        this.form,
        this.bracket?.options || this.tournament.options,
        {
          type: this.tournament.options.type,
          mr: this.tournament.options.mr.toString(),
          map_pool_id: this.tournament.options.map_pool.id,
          regions: this.tournament.options.regions || [],
          map_veto: true,
          custom_map_pool: false,
        },
      );
    },
    hasMatchOptionsChanged() {
      if (!this.tournament) {
        return false;
      }

      const form = this.form.values;
      const defaultOptions = this.defaultOptions;

      // Only check allowed fields that can be modified:
      // coaches, knife_round, default_models, region_veto, overtime,
      // best_of, number_of_substitutes, timeout_setting, tech_timeout_setting, ready_setting
      if (
        form.coaches !== defaultOptions.coaches ||
        form.knife_round !== defaultOptions.knife_round ||
        form.default_models !== defaultOptions.default_models ||
        form.region_veto !== defaultOptions.region_veto ||
        form.overtime !== defaultOptions.overtime ||
        parseInt(form.best_of) !== defaultOptions.best_of ||
        form.number_of_substitutes !== defaultOptions.number_of_substitutes ||
        form.timeout_setting !== defaultOptions.timeout_setting ||
        form.tech_timeout_setting !== defaultOptions.tech_timeout_setting ||
        form.ready_setting !== defaultOptions.ready_setting ||
        form.tv_delay !== defaultOptions.tv_delay ||
        form.check_in_setting !== defaultOptions.check_in_setting
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
        variables: setupOptionsVariables({
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
          tv_delay: form.tv_delay,
          check_in_setting: form.check_in_setting,
        }),
        mutation: generateMutation({
          update_match_options_by_pk: [
            {
              pk_columns: {
                id: $("id", "uuid!"),
              },
              _set: setupOptionsSetMutation(),
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
        variables: setupOptionsVariables({
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
          tv_delay: form.tv_delay,
          check_in_setting: form.check_in_setting,
        }),
        mutation: generateMutation({
          insert_match_options_one: [
            {
              object: setupOptionsSetMutation(),
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
