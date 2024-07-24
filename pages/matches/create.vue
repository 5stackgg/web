<script lang="ts" setup>
import TeamSearch from "~/components/teams/TeamSearch.vue";
import MapDisplay from "~/components/MapDisplay.vue";
import MatchOptions from "~/components/MatchOptions.vue";
</script>

<template>
  <pre>{{ form.errors }}</pre>
  <form class="w-1/2 space-y-6" @submit.prevent="setupMatch">
    <div>
      <h3 class="mb-4 text-lg font-medium">Match Details</h3>

      <match-options :form="form"></match-options>
    </div>

    <FormField v-slot="{ handleChange, componentField }" name="team_1">
      <FormItem>
        <FormLabel>Team 1</FormLabel>
        <team-search
          label="Search for a Team ..."
          @selected="(team) => handleChange(team.id)"
          v-model="componentField.modelValue"
        ></team-search>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ handleChange, componentField }" name="team_2">
      <FormItem>
        <FormLabel>Team 2</FormLabel>
        <team-search
          label="Search for a Team ..."
          @selected="(team) => handleChange(team.id)"
          :exclude="[form.values.team_1]"
          v-model="componentField.modelValue"
        ></team-search>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button type="submit"> Submit </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { useAuthStore } from "~/stores/AuthStore";
import { generateMutation } from "~/graphql/graphqlGen";
import { $, e_map_pool_types_enum } from "~/generated/zeus";
import matchOptionsValidator from "~/utilities/match-options-validator";

export default {
  data() {
    return {
      form: useForm({
        validationSchema: matchOptionsValidator({
          team_1: z.string().optional(),
          team_2: z.string().optional(),
        }),
      }),
    };
  },
  methods: {
    async setupMatch() {
      const { valid } = await this.form.validate();
      console.info({
        valid,
      });

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
          coaches: form.coaches,
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
                options: {
                  data: {
                    mr: $("mr", "Int!"),
                    type: $("type", "e_match_types_enum!"),
                    coaches: $("coaches", "Boolean!"),
                    knife_round: $("knife_round", "Boolean!"),
                    best_of: $("best_of", "Int!"),
                    overtime: $("overtime", "Boolean!"),
                    map_veto: $("map_veto", "Boolean!"),
                    number_of_substitutes: $("number_of_substitutes", "Int!"),
                    map_pool: $("map_pool", "map_pools_obj_rel_insert_input"),
                    ...(form.map_pool_id
                      ? { map_pool_id: $("map_pool_id", "uuid!") }
                      : {}),
                  },
                },
                lineups: {
                  data: [
                    { lineup_players: { data: [] } },
                    { lineup_players: { data: [] } },
                  ],
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
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
