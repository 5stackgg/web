<script lang="ts" setup>
import TeamSearch from "~/components/teams/TeamSearch.vue";
</script>

<template>
  <form class="grid gap-4" @submit.prevent="addTeamToTournament">
    <FormField
      v-slot="{ value, handleChange }"
      name="my_teams"
      v-if="isAdmin || isTournamentOrganizer"
    >
      <FormItem
        class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
        @click="handleChange(!value)"
      >
        <div class="space-y-0.5">
          <FormLabel class="text-base">{{
            $t("tournament.team.my_teams")
          }}</FormLabel>
          <FormDescription>{{
            $t("tournament.team.my_teams_description")
          }}</FormDescription>
        </div>
        <FormControl>
          <Switch
            class="pointer-events-none"
            :checked="value"
            @update:checked="handleChange"
          />
        </FormControl>
      </FormItem>
    </FormField>

    <template v-if="form.values.my_teams && teams?.length === 0">
      {{ $t("tournament.team.no_eligible_teams") }}
    </template>
    <FormField v-slot="{ handleChange, componentField }" name="team_id" v-else>
      <FormItem>
        <FormLabel>{{ $t("tournament.team.team") }}</FormLabel>
        <template v-if="form.values.my_teams">
          <Select v-bind="componentField">
            <FormControl>
              <SelectTrigger>
                <SelectValue :placeholder="$t('tournament.team.select_team')" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectGroup>
                <SelectItem :value="team.id" v-for="team of teams">
                  {{ team.name }} [{{ team.short_name }}]
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </template>
        <template v-else>
          <TeamSearch
            :label="
              tempTeam ? tempTeam.name : $t('tournament.team.search_team')
            "
            @selected="
              (team) => {
                this.tempTeam = team;
                handleChange(team.id);
              }
            "
            v-model="componentField.modelValue"
            :exclude="tournament.teams.map(({ team_id }) => team_id)"
          ></TeamSearch>
        </template>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button
      type="submit"
      :disabled="form.values.my_teams && teams?.length === 0"
    >
      {{ $t("tournament.team.add_to_tournament") }}
    </Button>
  </form>
</template>

<script lang="ts">
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import { $, order_by } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  apollo: {
    teams: {
      fetchPolicy: "network-only",
      query: function () {
        return generateQuery({
          teams: [
            {
              order_by: [
                {},
                {
                  name: order_by.asc,
                },
              ],
              where: {
                _and: [
                  {
                    _or: [
                      {
                        owner_steam_id: {
                          _eq: $("steam_id", "bigint!"),
                        },
                      },
                      {
                        roster: {
                          player_steam_id: {
                            _eq: $("steam_id", "bigint!"),
                          },
                        },
                      },
                    ],
                  },
                  {
                    tournament_teams_aggregate: {
                      count: {
                        predicate: {
                          _eq: 0,
                        },
                        filter: {
                          tournament_id: {
                            _eq: $("tournament_id", "uuid!"),
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
            {
              id: true,
              name: true,
              short_name: true,
            },
          ],
        });
      },
      variables: function () {
        return {
          steam_id: this.me?.steam_id,
          tournament_id: this.$route.params.tournamentId,
        };
      },
    },
  },
  data() {
    return {
      tempTeam: undefined,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            team_id: z.string(),
            team_name: z.string(),
            my_teams: z.boolean().default(true),
          }),
        ),
      }),
    };
  },
  computed: {
    isAdmin() {
      return useAuthStore().isAdmin;
    },
    isTournamentOrganizer() {
      return useAuthStore().isTournamentOrganizer;
    },
    me() {
      return useAuthStore().me;
    },
  },
  methods: {
    async addTeamToTournament() {
      const { data } = await this.$apollo.query({
        query: generateQuery({
          teams_by_pk: [
            {
              id: this.form.values.team_id,
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

      if (!team) {
        return;
      }

      this.form.resetForm();

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

      toast({
        title: "Added team to tournament.",
      });
    },
  },
};
</script>
