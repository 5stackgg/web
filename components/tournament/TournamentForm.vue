<script setup lang="ts">
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Calendar as CalendarIcon, PlayIcon } from "lucide-vue-next";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import MatchOptions from "~/components/MatchOptions.vue";
</script>

<template>
  <form @submit.prevent="updateCreateTournament" class="grid gap-4">
    <MatchOptions
      :form="form"
      :force-veto="true"
      :hide-best-of="true"
      :hide-match-mode="true"
    >
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
                    {{ startDate || $t("common.pick_date") }}
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

      <FormField v-slot="{ value, handleChange }" name="auto_start">
        <FormItem>
          <div
            class="flex flex-row items-center justify-between cursor-pointer"
            @click="handleChange(!value)"
          >
            <div class="space-y-0.5">
              <FormLabel class="text-lg font-semibold">{{
                $t("tournament.form.auto_start.label")
              }}</FormLabel>
              <FormDescription>{{
                $t("tournament.form.auto_start.description")
              }}</FormDescription>
            </div>
            <FormControl>
              <Switch
                class="pointer-events-none"
                :model-value="value"
                @update:model-value="handleChange"
              />
            </FormControl>
          </div>
        </FormItem>
      </FormField>
      <template #after-advanced>
        <FormField
          v-slot="{ value, handleChange }"
          name="discord_notifications_enabled"
        >
          <FormItem>
            <Card
              class="cursor-pointer"
              @click="handleChange(!value ? true : null)"
            >
              <div class="flex flex-col space-y-3 p-4">
                <div class="flex justify-between items-center">
                  <FormLabel class="text-lg font-semibold">{{
                    $t("tournament.form.discord_notifications")
                  }}</FormLabel>
                  <FormControl>
                    <Switch
                      class="pointer-events-none"
                      :model-value="value === true"
                      @update:model-value="handleChange($event ? true : null)"
                    />
                  </FormControl>
                </div>
                <FormDescription>{{
                  $t("tournament.form.discord_notifications_description")
                }}</FormDescription>
              </div>
            </Card>
          </FormItem>
        </FormField>
      </template>
    </MatchOptions>

    <div class="mt-8 flex justify-center">
      <button
        type="submit"
        :disabled="submitting || Object.keys(form.errors).length > 0"
        class="group/submit relative isolate inline-flex items-center px-12 py-4 font-bold text-base tracking-[0.22em] uppercase text-[hsl(0_0%_8%)] [background:linear-gradient(135deg,hsl(36_100%_65%)_0%,hsl(var(--tac-amber))_50%,hsl(28_90%_52%)_100%)] border border-[hsl(var(--tac-amber))] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.4),0_8px_24px_-6px_hsl(var(--tac-amber)/0.6)] [transition:transform_200ms_cubic-bezier(0.4,0,0.2,1),box-shadow_200ms_ease] cursor-pointer overflow-hidden hover:-translate-y-px hover:shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.6),0_14px_36px_-6px_hsl(var(--tac-amber)/0.8),0_0_28px_hsl(var(--tac-amber)/0.35)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        <span class="relative z-[1] inline-flex items-center gap-3">
          <Spinner v-if="submitting" class="w-5 h-5" />
          <PlayIcon
            v-else
            class="w-5 h-5 fill-current [transition:transform_300ms_cubic-bezier(0.4,0,0.2,1)] group-hover/submit:translate-x-0.5 group-hover/submit:scale-[1.08]"
          />
          <span>
            <template v-if="tournament">
              {{ $t("tournament.form.update") }}
            </template>
            <template v-else>
              {{ $t("tournament.form.create") }}
            </template>
          </span>
        </span>
        <span
          class="absolute inset-0 [background:linear-gradient(90deg,transparent_0%,hsl(0_0%_100%/0.35)_50%,transparent_100%)] -translate-x-full [transition:transform_700ms_cubic-bezier(0.4,0,0.2,1)] pointer-events-none z-0 group-hover/submit:translate-x-full"
          aria-hidden="true"
        ></span>
      </button>
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
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { fromDate, toCalendarDate } from "@internationalized/date";
import { toast } from "@/components/ui/toast";
import {
  setupOptions,
  setupOptionsVariables,
  setupOptionsSetMutation,
} from "~/utilities/setupOptions";

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
      fetchPolicy: "cache-first",
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
      submitting: false,
      startDate: undefined,
      startTime: undefined,
      form: useForm({
        keepValuesOnUnmount: true,
        validationSchema: toTypedSchema(
          matchOptionsValidator(
            this,
            {
              name: z.string().min(1),
              start: z.date().refine((date) => date > new Date(), {
                message: this.$t("validation.date_must_be_future"),
              }),
              description: z.string().nullable().default(null),
              auto_start: z.boolean().default(true),
            },
            useApplicationSettingsStore().settings,
          ),
        ),
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
          this.startDate = toCalendarDate(
            fromDate(
              startDate,
              Intl.DateTimeFormat().resolvedOptions().timeZone,
            ),
          );
          this.startTime = `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`;

          this.form.setValues({
            map_veto: true,
            name: tournament.name,
            description: tournament.description,
            auto_start: tournament.auto_start,
          });

          setupOptions(this.form, tournament.options);
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
      if (this.submitLock) {
        return;
      }
      this.submitLock = true;

      let redirecting = false;

      try {
        const { valid } = await this.form.validate();

        if (!valid) {
          return;
        }

        this.submitting = true;
        const form = this.form.values;

        if (this.tournament) {
          await this.$apollo.mutate({
            variables: {
              name: this.form.values.name,
              start: this.form.values.start,
              description: this.form.values.description,
              auto_start: this.form.values.auto_start,
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
                    auto_start: $("auto_start", "Boolean!"),
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
              ...setupOptionsVariables(form, { mapPoolId }),
            },
            mutation: generateMutation({
              update_match_options_by_pk: [
                {
                  pk_columns: {
                    id: $("id", "uuid!"),
                  },
                  _set: setupOptionsSetMutation(!!mapPoolId),
                },
                {
                  __typename: true,
                },
              ],
            }),
          });

          toast({
            title: this.$t("tournament.updated") as string,
          });
          return;
        }

        const { data } = await this.$apollo.mutate({
          variables: setupOptionsVariables(form),
          mutation: generateMutation({
            insert_tournaments_one: [
              {
                object: {
                  name: this.form.values.name,
                  start: this.form.values.start,
                  description: this.form.values.description,
                  auto_start: this.form.values.auto_start,
                  options: {
                    data: setupOptionsSetMutation(!!form.map_pool_id),
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
        redirecting = true;
      } finally {
        if (!redirecting) {
          this.submitLock = false;
          this.submitting = false;
        }
      }
    },
  },
};
</script>
