<script setup lang="ts">
import { Button } from "@/components/ui/button";
import MatchOptions from "~/components/MatchOptions.vue";
</script>

<template>
  <form @submit.prevent="updateBracket" class="grid gap-4">
    <MatchOptions
      :form="form"
      :stage-bracket-override="true"
      :match="bracket?.match"
    ></MatchOptions>

    <Button
      type="submit"
      :disabled="Object.keys(form.errors).length > 0 || isMatchLocked"
    >
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
import { e_match_status_enum } from "~/generated/zeus";
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
    // The inherited defaults (stage or tournament) — what this bracket would
    // have without ANY per-bracket override.
    defaultOptions() {
      return this.stage?.options
        ? this.stage.options
        : this.tournament?.options;
    },
    // What the bracket currently shows — its own options if set, otherwise
    // the inherited defaults.
    currentEffectiveOptions() {
      return this.bracket?.options || this.defaultOptions;
    },
    isMatchLocked(): boolean {
      const match = this.bracket?.match;
      if (!match) return false;
      return [
        e_match_status_enum.Veto,
        e_match_status_enum.Live,
        e_match_status_enum.Finished,
        e_match_status_enum.Forfeit,
        e_match_status_enum.Tie,
        e_match_status_enum.Surrendered,
      ].includes(match.status);
    },
  },
  methods: {
    setFormOptions() {
      if (!this.bracket && !this.tournament) {
        return;
      }

      setupOptions(
        this.form,
        this.currentEffectiveOptions,
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
    // Compare form values against a baseline options object.
    optionsDifferFrom(baseline: any) {
      if (!baseline || !this.tournament) {
        return false;
      }
      const form = this.form.values;
      return (
        form.coaches !== baseline.coaches ||
        form.knife_round !== baseline.knife_round ||
        form.default_models !== baseline.default_models ||
        form.region_veto !== baseline.region_veto ||
        form.overtime !== baseline.overtime ||
        parseInt(form.best_of) !== baseline.best_of ||
        form.number_of_substitutes !== baseline.number_of_substitutes ||
        form.timeout_setting !== baseline.timeout_setting ||
        form.tech_timeout_setting !== baseline.tech_timeout_setting ||
        form.ready_setting !== baseline.ready_setting ||
        form.tv_delay !== baseline.tv_delay ||
        form.check_in_setting !== baseline.check_in_setting
      );
    },
    // Did the user actually change anything from what the bracket currently has?
    hasFormChanged() {
      return this.optionsDifferFrom(this.currentEffectiveOptions);
    },
    // Does the form differ from the inherited defaults (stage/tournament)?
    // If true, the bracket needs its own custom match_options record.
    hasMatchOptionsChanged() {
      return this.optionsDifferFrom(this.defaultOptions);
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
    async updateBracket() {
      if (this.isMatchLocked) {
        return;
      }

      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      // If user didn't actually change anything from the bracket's current
      // state, just close — no DB operations needed.
      if (!this.hasFormChanged()) {
        this.$emit("updated");
        return;
      }

      const form = this.form.values;
      const needsCustomRecord = this.hasMatchOptionsChanged();

      if (needsCustomRecord) {
        // Form differs from inherited defaults → CREATE a new record unique
        // to this bracket. We never update in place because the existing
        // record may be shared with other decider brackets.
        const mapPoolId = await this.getMapPoolId(form, needsCustomRecord);
        const newOptionsId = await this.createMatchOptions(form, mapPoolId);

        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_tournament_brackets_by_pk: [
              {
                pk_columns: {
                  id: this.bracket.id,
                },
                _set: {
                  match_options_id: newOptionsId,
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      } else if (
        this.bracket.options?.id &&
        this.bracket.options.id !== this.stage?.options?.id &&
        this.bracket.options.id !== this.tournament?.options?.id
      ) {
        // REVERT: form matches inherited defaults, bracket had a custom/decider
        // record. Unset bracket FK so it falls back to stage/tournament defaults.
        // Old match_options record is left as-is — it may be shared with other
        // brackets, and will be cleaned up by backend triggers when
        // brackets/matches are deleted.
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
      }

      this.$emit("updated");
    },
  },
};
</script>
