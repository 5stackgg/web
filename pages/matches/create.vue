<script lang="ts" setup>
import TeamSearch from "~/components/teams/TeamSearch.vue";
import MatchOptions from "~/components/MatchOptions.vue";
import PageHeading from "~/components/PageHeading.vue";
import { Info } from "lucide-vue-next";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title> Create Match </template>
    </PageHeading>

    <form @submit.prevent="setupMatch">
      <match-options :form="form">
        <template #left>
          <FormField v-slot="{ value, handleChange }" name="pug">
            <FormItem
              class="flex flex-col space-y-3 rounded-lg border p-4 cursor-pointer hover:bg-accent"
              @click="handleChange(!value)"
            >
              <div class="flex justify-between items-center">
                <FormLabel class="text-lg font-semibold"
                  >Pick Up Game</FormLabel
                >
                <FormControl>
                  <Switch
                    class="pointer-events-none"
                    :checked="value"
                    @update:checked="handleChange"
                  />
                </FormControl>
              </div>
              <FormDescription>
                A Pick up game does not require selection of teams.
              </FormDescription>
            </FormItem>
          </FormField>

          <div
            class="flex flex-col gap-4 rounded-lg border p-4"
            v-if="!form.values.pug"
          >
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FormField
                v-slot="{ handleChange, componentField }"
                name="team_1"
              >
                <FormItem>
                  <FormLabel>Team 1</FormLabel>
                  <TeamSearch
                    label="Search for a Team ..."
                    @selected="
                      (team) => {
                        if (team.id == form.values.team_1) {
                          handleChange(undefined);
                          return;
                        }
                        handleChange(team.id);
                      }
                    "
                    v-model="componentField.modelValue"
                    class="w-full"
                  ></TeamSearch>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField
                v-slot="{ handleChange, componentField }"
                name="team_2"
              >
                <FormItem>
                  <FormLabel>Team 2</FormLabel>
                  <TeamSearch
                    label="Search for a Team ..."
                    @selected="
                      (team) => {
                        if (team.id == form.values.team_2) {
                          handleChange(undefined);
                          return;
                        }
                        handleChange(team.id);
                      }
                    "
                    v-model="componentField.modelValue"
                    class="w-full"
                  ></TeamSearch>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <div
              class="flex items-center gap-2 text-sm text-muted-foreground italic"
            >
              <Info class="inline-block w-4 h-4" />
              <span>
                You can select the same team for both slots to create an
                intra-team scrimmage.
              </span>
            </div>
          </div>
        </template>
      </match-options>

      <div class="grid grid-cols-1 md:grid-cols-2">
        <Button type="submit" size="lg" class="mt-6 w-full">
          Create Match
        </Button>
      </div>
    </form>
  </div>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { generateMutation } from "~/graphql/graphqlGen";
import { $, e_map_pool_types_enum } from "~/generated/zeus";
import matchOptionsValidator from "~/utilities/match-options-validator";

export default {
  data() {
    return {
      form: useForm({
        keepValuesOnUnmount: true,
        validationSchema: matchOptionsValidator({
          pug: z.boolean().default(true),
          team_1: z.string().optional(),
          team_2: z.string().optional(),
        }),
      }),
    };
  },
  methods: {
    async setupMatch() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      const form = this.form.values;

      const { data } = await this.$apollo.mutate({
        variables: {
          mr: form.mr,
          type: form.type,
          best_of: form.best_of,
          knife_round: form.knife_round,
          overtime: form.overtime,
          map_veto: form.map_veto,
          region_veto: form.region_veto,
          regions: form.regions,
          coaches: form.coaches,
          timeout_setting: form.timeout_setting,
          tech_timeout_setting: form.tech_timeout_setting,
          tv_delay: form.tv_delay,
          number_of_substitutes: form.number_of_substitutes,
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
          insert_matches_one: [
            {
              object: {
                lineup_1: {
                  data: {
                    ...(this.form.values.team_1
                      ? { team_id: this.form.values.team_1 }
                      : {}),
                  },
                },
                ...(this.form.values.team_2
                  ? {
                      lineup_2: {
                        data: {
                          team_id: this.form.values.team_2,
                        },
                      },
                    }
                  : {}),
                options: {
                  data: {
                    mr: $("mr", "Int!"),
                    type: $("type", "e_match_types_enum!"),
                    coaches: $("coaches", "Boolean!"),
                    tv_delay: $("tv_delay", "Int!"),
                    knife_round: $("knife_round", "Boolean!"),
                    best_of: $("best_of", "Int!"),
                    overtime: $("overtime", "Boolean!"),
                    map_veto: $("map_veto", "Boolean!"),
                    region_veto: $("region_veto", "Boolean!"),
                    regions: $("regions", "[String!]!"),
                    timeout_setting: $(
                      "timeout_setting",
                      "e_timeout_settings_enum!",
                    ),
                    tech_timeout_setting: $(
                      "tech_timeout_setting",
                      "e_timeout_settings_enum!",
                    ),
                    number_of_substitutes: $("number_of_substitutes", "Int!"),
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

      this.$router.push(`/matches/${data.insert_matches_one.id}`);
    },
  },
};
</script>
