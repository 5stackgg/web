<script lang="ts" setup>
import TeamSearch from "~/components/teams/TeamSearch.vue";
</script>

<template>
  <form class="w-1/2 space-y-6" @submit.prevent="addTeamToTournament">
    <FormField v-slot="{ handleChange, componentField }" name="team_id">
      <FormItem>
        <FormLabel>Team 1</FormLabel>
        <team-search
            label="Search for a Team ..."
            @selected="(team) => { handleChange(team.id) }"
            v-model="componentField.modelValue"
        ></team-search>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button type="submit"> Add Team </Button>
  </form>
</template>

<script lang="ts">
import {generateMutation, generateQuery} from "~/graphql/graphqlGen";
import {useForm} from "vee-validate";
import {toTypedSchema} from "@vee-validate/zod";
import * as z from "zod";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    }
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
            z.object({
              team_id: z.string(),
              team_name: z.string(),
            }),
        ),
      }),
    }
  },
  methods: {
   async addTeamToTournament() {
     const { data } = await this.$apollo.query({
       query: generateQuery({
         teams_by_pk: [
           {
             id: this.form.values.team_id
           },
           {
             id: true,
             name: true,
             owner_steam_id: true,
           },
         ],
       }),
     });

     const team = data.teams_by_pk;

      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_teams_one: [
            {
              object: {
                tournament_id: this.tournament.id,
                name: team.name,
                team_id: team.id,
                owner_steam_id: team.owner_steam_id,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });
    }
  }
}
</script>
