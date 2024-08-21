<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import PlayerSearch from "~/components/PlayerSearch.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
</script>

<template>
  <form @submit.prevent="updateCreateTeam">
    <FormField v-slot="{ componentField }" name="team_name">
      <FormItem>
        <FormLabel>Name</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <FormField v-slot="{ componentField }" name="short_name">
      <FormItem>
        <FormLabel>Short Name</FormLabel>
        <FormControl>
          <Input v-bind="componentField" />
          <FormMessage />
        </FormControl>
      </FormItem>
    </FormField>

    <FormField
      v-slot="{ componentField }"
      name="owner_steam_id"
      v-if="team && canUpdateOwner"
    >
      <FormItem>
        <FormLabel>Owner </FormLabel>

        <Select v-bind="componentField">
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Update Owner" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                :value="player.steam_id"
                v-for="{ player } of team.roster"
              >
                <PlayerDisplay :player="player"></PlayerDisplay>
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      <template v-if="team"> Update </template
      ><template v-else> Create </template> Team
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { generateMutation } from "~/graphql/graphqlGen";
import { e_player_roles_enum } from "~/generated/zeus";

export default {
  emits: ["updated"],
  props: {
    team: {
      type: Object,
      required: false,
    },
  },
  data() {
    return {
      owner: undefined,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            team_name: z.string().min(1),
            short_name: z.string().min(1).max(3),
          }),
        ),
      }),
    };
  },
  watch: {
    team: {
      immediate: true,
      handler(team) {
        if (team) {
          this.form.setValues({
            team_name: team.name,
            short_name: team.short_name,
          });
        }
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    canUpdateOwner() {
      return (
        this.team.owner_steam_id === this.me?.steam_id ||
        this.me?.role === e_player_roles_enum.tournament_organizer
      );
    },
  },
  methods: {
    async updateCreateTeam() {
      if (this.team) {
        await this.$apollo.mutate({
          mutation: generateMutation({
            update_teams_by_pk: [
              {
                pk_columns: {
                  id: this.team.id,
                },
                _set: {
                  name: this.form.values.team_name,
                  short_name: this.form.values.short_name,
                  owner_steam_id: this.form.values.owner_steam_id,
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
          insert_teams_one: [
            {
              object: {
                name: this.form.values.team_name,
                short_name: this.form.values.short_name,
              },
            },
            {
              id: true,
            },
          ],
        }),
      });

      this.$router.push(`/teams/${data.insert_teams_one.id}`);
    },
  },
};
</script>
