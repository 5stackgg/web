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
</script>

<template>
  <form @submit.prevent="updateCreateStage" class="grid gap-4">
    <FormField v-slot="{ componentField }" name="type">
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

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      <template v-if="stage">{{ $t("tournament.stage.update") }}</template>
      <template v-else>{{ $t("tournament.stage.create") }}</template>
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { e_tournament_stage_types_enum } from "~/generated/zeus";

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
  },
  apollo: {
    e_tournament_stage_types: {
      query: generateQuery({
        e_tournament_stage_types: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z
            .object({
              type: z.string(),
              min_teams: z.string().refine((val) => !isNaN(parseInt(val)), {
                message: "min teams must be a number",
              }),
              max_teams: z.string().refine((val) => !isNaN(parseInt(val)), {
                message: "max teams must be a number",
              }),
            })
            .refine(
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
          this.form.setValues({
            type: stage.type,
            min_teams: stage.min_teams.toString(),
            max_teams: stage.max_teams.toString(),
          });
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
      let options = [];
      switch (this.form.values.type) {
        case e_tournament_stage_types_enum.SingleElimination:
          let max = 256;

          while (max > 2) {
            options.push({
              value: max.toString(),
              display: max,
            });

            max = max / 2;
          }

          break;
      }

      return options.reverse();
    },
  },
  methods: {
    async updateCreateStage() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      if (this.stage) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_tournament_stages_by_pk: [
              {
                pk_columns: {
                  id: this.stage.id,
                },
                _set: {
                  order: this.order,
                  type: this.form.values.type,
                  min_teams: this.form.values.min_teams,
                  max_teams: this.form.values.max_teams,
                },
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

      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_stages_one: [
            {
              object: {
                order: this.order,
                type: this.form.values.type,
                min_teams: this.form.values.min_teams,
                max_teams: this.form.values.max_teams,
                tournament_id:
                  this.$route.params.tournamentId || this.$route.params.id,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
