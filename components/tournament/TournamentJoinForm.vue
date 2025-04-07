<script setup lang="ts">
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
import { MessageCircleWarning } from "lucide-vue-next";
</script>

<template>
  <form @submit.prevent="joinTournament" class="grid gap-4">
    <h1 class="flex gap-2">
      <MessageCircleWarning />
      This tournament requires at least
      {{ tournament.min_players_per_lineup }} players
    </h1>

    <FormField v-slot="{ value, handleChange }" name="newTeam">
      <FormItem
        class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
        @click="handleChange(!value)"
      >
        <div class="space-y-0.5">
          <FormLabel class="text-base"> New Team </FormLabel>
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

    <template v-if="!form.values.newTeam">
      <FormField v-slot="{ componentField }" name="team_id">
        <FormItem>
          <FormLabel>Team</FormLabel>
          <Select v-bind="componentField">
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="team in teams"
                  :key="team.id"
                  :value="team.id"
                >
                  {{ team.name }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      </FormField>
    </template>
    <template v-else>
      <FormField v-slot="{ componentField }" name="team_name">
        <FormItem>
          <FormLabel>Team Name</FormLabel>
          <Input v-bind="componentField"></Input>
          <FormMessage />
        </FormItem>
      </FormField>
    </template>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      Join Tournament
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useAuthStore } from "~/stores/AuthStore";
import { generateMutation } from "~/graphql/graphqlGen";
import { e_match_types_enum } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            team_name: z
              .string()
              .optional()
              .refine(
                (value) => {
                  if (!this.form.values.newTeam) {
                    return true;
                  }
                  return value !== undefined;
                },
                { message: "team name is required" },
              ),
            team_id: z
              .string()
              .optional()
              .refine(
                (value) => {
                  if (this.form.values.newTeam) {
                    return true;
                  }
                  return value !== undefined;
                },
                { message: "team is required" },
              ),
          }),
        ),
      }),
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    teams() {
      return this.me.teams;
    },
    requiresOwnerSteamId() {
      const { isAdmin, isTournamentOrganizer } = useAuthStore();
      return isAdmin || isTournamentOrganizer;
    },
  },
  watch: {
    tournament: {
      deep: true,
      immediate: true,
      handler() {
        const type = this.tournament.options.type;
        this.form.setFieldValue(
          "newTeam",
          type !== e_match_types_enum.Competitive,
        );
      },
    },
  },
  methods: {
    async joinTournament() {
      if (!this.me) {
        return;
      }

      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      const newTeam = this.form.values.newTeam;
      let teamName = this.form.values.team_name;
      if (!newTeam) {
        const team = this.teams.find(({ id }) => {
          return id === this.form.values.team_id;
        });

        if (!team) {
          return;
        }
        teamName = team.name;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_teams_one: [
            {
              object: {
                ...(this.requiresOwnerSteamId
                  ? { owner_steam_id: this.me.steam_id }
                  : {}),
                tournament_id: this.$route.params.tournamentId,
                name: teamName,
                team_id: this.form.values.newTeam
                  ? null
                  : this.form.values.team_id,
                roster: {
                  data: [
                    {
                      player_steam_id: this.me.steam_id,
                      tournament_id: this.$route.params.tournamentId,
                    },
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

      toast({
        title: "Joined Tournament",
      });

      this.form.resetForm();
    },
  },
};
</script>
