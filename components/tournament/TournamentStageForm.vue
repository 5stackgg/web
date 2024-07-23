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
  <form @submit.prevent="updateCreateStage">
    <FormField v-slot="{ componentField }" name="type">
      <FormItem>
        <FormLabel>Assign Match Server</FormLabel>
        <Select v-bind="componentField">
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Stage Type" />
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
        <FormLabel>Min Teams</FormLabel>
        <FormControl>
          <Input type="number" v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="max_teams">
      <FormItem>
        <FormLabel>Max Teams</FormLabel>
        <FormControl>
          <Input type="number" v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      <template v-if="stage"> Update </template
      ><template v-else> Create </template> Stage
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";

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
          z.object({
            type: z.string(),
            min_teams: z.number().min(4),
            max_teams: z.number().max(16),
          })
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
            min_teams: stage.min_teams,
            max_teams: stage.max_teams,
          });
        }
      },
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
                tournament_id: this.$route.params.id,
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
