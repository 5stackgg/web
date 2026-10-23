<script setup lang="ts">
import MatchOptions from "~/components/MatchOptions.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { Button } from "~/components/ui/button";
</script>

<template>
  <form v-if="options" @submit.prevent="save" class="grid gap-4">
    <MatchOptions
      :form="form"
      :hide-best-of="true"
      :hide-match-mode="true"
      :lock-rules="true"
      :lock-rules-reason="$t('match.options.rules_locked.tournament_match')"
    />

    <div v-if="ownOptionsId" class="flex justify-end">
      <Button type="button" variant="outline" @click="useStageSettings">
        {{ $t("tournament.bracket.use_stage_settings") }}
      </Button>
    </div>

    <SettingsSaveBar
      contained
      :dirty="isDirty"
      :submitting="submitting"
      @save="save"
      @discard="discardChanges"
    />
  </form>
</template>

<script lang="ts">
import gql from "graphql-tag";
import { useForm } from "vee-validate";
import { $, e_map_pool_types_enum } from "~/generated/zeus";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { matchOptionsFields } from "~/graphql/matchOptionsFields";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { toast } from "@/components/ui/toast";
import {
  keepStoredRules,
  setupOptions,
  setupOptionsVariables,
  setupOptionsSetMutation,
} from "~/utilities/setupOptions";

const cloneBracketOptions = gql`
  mutation CloneTournamentBracketOptions($bracketId: uuid!) {
    clone_tournament_bracket_options(args: { _bracket_id: $bracketId }) {
      match_options_id
    }
  }
`;

export default {
  props: {
    bracketId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      options: null as Record<string, any> | null,
      ownOptionsId: null as string | null,
      submitting: false,
      baseline: null as string | null,
      isDirty: false,
      form: useForm({
        keepValuesOnUnmount: true,
        validationSchema: toTypedSchema(
          matchOptionsValidator(
            this,
            {},
            useApplicationSettingsStore().settings,
          ),
        ),
      }),
    };
  },
  watch: {
    bracketId: {
      immediate: true,
      handler() {
        this.load();
      },
    },
    ["form.values"]: {
      deep: true,
      handler() {
        this.isDirty =
          this.baseline !== null &&
          JSON.stringify(this.form.values) !== this.baseline;
      },
    },
  },
  methods: {
    async load() {
      const bracketId = this.bracketId;
      try {
        const { data } = await this.$apollo.query({
          fetchPolicy: "network-only",
          variables: { bracketId },
          query: generateQuery({
            tournament_brackets_by_pk: [
              { id: $("bracketId", "uuid!") },
              {
                match_options_id: true,
                options: matchOptionsFields,
                stage: {
                  options: matchOptionsFields,
                  tournament: {
                    options: matchOptionsFields,
                  },
                },
              },
            ],
          }),
        });
        if (bracketId !== this.bracketId) {
          return;
        }
        const bracket = data?.tournament_brackets_by_pk;
        this.ownOptionsId = bracket?.match_options_id ?? null;
        this.options =
          bracket?.options ??
          bracket?.stage?.options ??
          bracket?.stage?.tournament?.options ??
          null;
        if (this.options) {
          this.populate();
        }
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
    populate() {
      setupOptions(this.form, this.options);
      if (this.options!.map_pool.type === e_map_pool_types_enum.Custom) {
        this.form.setValues({
          custom_map_pool: true,
          map_pool: this.options!.map_pool.maps.map(
            (map: { id: string }) => map.id,
          ),
        });
      }
      this.takeSnapshot();
    },
    takeSnapshot() {
      this.$nextTick(() => {
        this.baseline = JSON.stringify(this.form.values);
        this.isDirty = false;
      });
    },
    discardChanges() {
      this.populate();
    },
    async save() {
      if (this.submitting) {
        return;
      }

      const { valid, errors } = await this.form.validate();
      if (!valid) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: Object.values(errors ?? {})[0] as string,
        });
        return;
      }

      this.submitting = true;
      try {
        let optionsId = this.ownOptionsId;
        if (!optionsId) {
          const { data } = await this.$apollo.mutate({
            mutation: cloneBracketOptions,
            variables: { bracketId: this.bracketId },
          });
          optionsId = data.clone_tournament_bracket_options[0].match_options_id;
        }

        const variables = setupOptionsVariables(this.form.values, {
          mapPoolId: this.options!.map_pool.id,
        });

        await this.$apollo.mutate({
          variables: {
            id: optionsId,
            ...keepStoredRules(variables, this.options!),
          },
          mutation: generateMutation({
            update_match_options_by_pk: [
              {
                pk_columns: { id: $("id", "uuid!") },
                _set: setupOptionsSetMutation(true),
              },
              { __typename: true },
            ],
          }),
        });

        toast({ title: this.$t("pages.matches.match_updated") });

        await this.load();
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.submitting = false;
      }
    },
    async useStageSettings() {
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_tournament_brackets_by_pk: [
              {
                pk_columns: { id: this.bracketId },
                _set: { match_options_id: null },
              },
              { __typename: true },
            ],
          }),
        });
        await this.load();
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      }
    },
  },
};
</script>
