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
  <form @submit.prevent="updateCreateTournament" class="grid gap-4">
    <match-options :form="form" :force-veto="true">
      <FormField v-slot="{ componentField }" name="name">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.name") }}</FormLabel>
          <FormControl>
            <Input v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="description">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.description") }}</FormLabel>
          <FormControl>
            <Input v-bind="componentField" />
            <FormMessage />
          </FormControl>
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="start">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.start") }}</FormLabel>
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
                    {{ startDate || $t("tournament.form.pick_date") }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0">
                  <Calendar
                    :is-date-disabled="checkDate"
                    v-model="startDate"
                    initial-focus
                  />
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
    </match-options>

    <div class="grid grid-cols-1 md:grid-cols-2">
      <div class="grid gap-4">
        <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
          <template v-if="tournament">{{
            $t("tournament.form.update")
          }}</template>
          <template v-else>{{ $t("tournament.form.create") }}</template>
        </Button>
      </div>
    </div>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { mapFields } from "~/graphql/mapGraphql";
import { $, e_map_pool_types_enum } from "~/generated/zeus";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { fromDate, toCalendarDate } from "@internationalized/date";
import { toast } from "@/components/ui/toast";

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
        keepValuesOnUnmount: true,
        validationSchema: matchOptionsValidator(this, {
          name: z.string().min(1),
          start: z.date().refine((date) => date > new Date(), {
            message: "Date must be in the future",
          }),
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
          const startDate = new Date(tournament.start);
          this.startDate = toCalendarDate(fromDate(startDate));
          this.startTime = `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`;

          this.form.setValues({
            map_veto: true,
            name: tournament.name,
            description: tournament.description,
            type: tournament.options.type,
            mr: tournament.options.mr.toString(),
            coaches: tournament.options.coaches,
            knife_round: tournament.options.knife_round,
            region_veto: tournament.options.region_veto,
            overtime: tournament.options.overtime,
            best_of: tournament.options.best_of.toString(),
            number_of_substitutes: tournament.options.number_of_substitutes,
            timeout_setting: tournament.options.timeout_setting,
            tech_timeout_setting: tournament.options.tech_timeout_setting,
            map_pool_id: tournament.options.map_pool.id,
          });
        }
      },
    },
    isDefaultMapPool: {
      immediate: true,
      handler(isDefaultMapPool) {
        if (isDefaultMapPool) {
          return;
        }

        this.form.setValues({
          custom_map_pool: true,
          map_pool_id: this.tournament?.options.map_pool.id,
          map_pool: this.tournament?.options.map_pool.maps.map(({ id }) => {
            return id;
          }),
        });
      },
    },
  },
  computed: {
    defaultMapPool() {
      return this.map_pools?.find((pool) => {
        return pool.type === this.form.values.type;
      });
    },
    isDefaultMapPool() {
      if (!this.defaultMapPool || !this.tournament) {
        return true;
      }
      return this.defaultMapPool.id === this.tournament.options.map_pool.id;
    },
  },
  methods: {
    checkDate({ day, month, year }) {
      return new Date(year, month - 1, day + 1) < new Date();
    },
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

      const form = this.form.values;

      if (this.tournament) {
        await this.$apollo.mutate({
          variables: {
            name: this.form.values.name,
            start: this.form.values.start,
            description: this.form.values.description,
          },
          mutation: generateMutation({
            update_tournaments_by_pk: [
              {
                pk_columns: {
                  id: this.tournament.id,
                },
                _set: {
                  name: $("name", "String!"),
                  start: $("start", "timestamptz!"),
                  description: $("description", "String"),
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });

        let mapPoolId = form.map_pool_id;

        if (form.custom_map_pool) {
          const { data } = await this.$apollo.mutate({
            variables: {
              map_pool: {
                type: e_map_pool_types_enum.Custom,
                maps: {
                  data: this.form.values.map_pool.map((map_id) => {
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
          mapPoolId = data.insert_map_pools_one.id;
        }

        await this.$apollo.mutate({
          variables: {
            id: this.tournament.options.id,
            mr: form.mr,
            type: form.type,
            best_of: form.best_of,
            knife_round: form.knife_round,
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
                __typename: true,
              },
            ],
          }),
        });

        toast({
          title: "Updated Tournament",
        });
        return;
      }

      const { data } = await this.$apollo.mutate({
        variables: {
          mr: form.mr,
          type: form.type,
          best_of: form.best_of,
          knife_round: form.knife_round,
          overtime: form.overtime,
          coaches: form.coaches,
          region_veto: form.region_veto,
          regions: form.regions,
          number_of_substitutes: form.number_of_substitutes,
          timeout_setting: form.timeout_setting,
          ready_setting: form.ready_setting,
          tech_timeout_setting: form.tech_timeout_setting,
          ...(form.map_pool_id
            ? {
                map_pool_id: form.map_pool_id,
              }
            : {}),
          map_pool: !form.map_pool_id
            ? {
                data: {
                  type: e_map_pool_types_enum.Custom,
                  maps: {
                    data: form?.map_pool?.map((map_id) => {
                      return {
                        id: map_id,
                      };
                    }),
                  },
                },
              }
            : null,
        },
        mutation: generateMutation({
          insert_tournaments_one: [
            {
              object: {
                name: this.form.values.name,
                start: this.form.values.start,
                description: this.form.values.description,
                options: {
                  data: {
                    mr: $("mr", "Int!"),
                    type: $("type", "e_match_types_enum!"),
                    best_of: $("best_of", "Int!"),
                    knife_round: $("knife_round", "Boolean!"),
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
                    map_pool: $("map_pool", "map_pools_obj_rel_insert_input"),
                    ...(form.map_pool_id
                      ? { map_pool_id: $("map_pool_id", "uuid!") }
                      : {}),
                  },
                },
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
