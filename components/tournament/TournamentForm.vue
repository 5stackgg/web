<script setup lang="ts">
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Calendar as CalendarIcon } from "lucide-vue-next";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import MatchOptions from "~/components/MatchOptions.vue";
</script>

<template>
  <form @submit.prevent="updateCreateTournament">
    <FormField v-slot="{ componentField }" name="name">
      <FormItem>
        <FormLabel>Name</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="description">
      <FormItem>
        <FormLabel>Description</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <match-options :form="form"></match-options>

    <FormField v-slot="{ componentField }" name="start">
      <FormItem>
        <FormLabel>Start</FormLabel>
        <FormControl>
          <div class="flex">
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  class="w-[280px] justify-start text-left font-normal"
                  :class="{
                    ['text-muted-foreground']: !componentField.modelValue,
                  }"
                >
                  <CalendarIcon class="mr-2 h-4 w-4" />
                  {{ startDate || "Pick a date" }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="startDate" initial-focus />
              </PopoverContent>
            </Popover>

            <Input
              type="time"
              v-model="startTime"
              style="color-scheme: dark"
            ></Input>
          </div>

          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      <template v-if="tournament"> Update </template
      ><template v-else> Create </template> Tournament
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { mapFields } from "~/graphql/mapGraphql";
import { e_match_types_enum } from "~/generated/zeus";
import matchOptionsValidator from "~/utilities/match-options-validator";

export default {
  emits: ["updated"],
  props: {
    tournament: {
      type: Object,
      required: false,
    },
  },
  apollo: {
    e_match_types: {
      query: generateQuery({
        e_match_types: [
          {},
          {
            value: true,
            description: true,
          },
        ],
      }),
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
      startDate: undefined,
      startTime: undefined,
      form: useForm({
        validationSchema: matchOptionsValidator({
          name: z.string().min(1),
          start: z.date(),
          description: z.string().nullable().default(null),
        }),
      }),
    };
  },
  watch: {
    startTime: {
      immediate: true,
      handler() {
        this.setStart();
      },
    },
    startDate: {
      immediate: true,
      handler() {
        this.setStart();
      },
    },
    tournament: {
      immediate: true,
      handler(tournament) {
        if (tournament) {
          this.form.setValues({
            name: tournament.name,
            type: tournament.type,
            start: tournament.start,
            description: tournament.description,
          });
        }
      },
    },
  },
  computed: {
    defaultMapPool() {
      return this.map_pools?.find((pool) => {
        return pool.type === this.form.values.type;
      });
    },
  },
  methods: {
    setStart() {
      if (!this.startDate || !this.startTime) {
        return;
      }
      this.form.setValues({
        start: new Date(`${this.startDate} ${this.startTime}`),
      });
    },
    async updateCreateTournament() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      if (this.tournament) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_tournaments_by_pk: [
              {
                pk_columns: {
                  id: this.tournament.id,
                },
                _set: {
                  name: this.form.values.name,
                  type: this.form.values.type,
                  start: this.form.values.start,
                  description: this.form.values.description,
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

      const { data } = await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournaments_one: [
            {
              object: {
                name: this.form.values.name,
                type: this.form.values.type,
                start: this.form.values.start,
                map_pool_id: this.defaultMapPool.id,
                description: this.form.values.description,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.$router.push(`/tournaments/${data.insert_tournaments_one.id}`);
    },
  },
};
</script>
