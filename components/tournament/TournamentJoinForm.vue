<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { MessageCircleWarning } from "lucide-vue-next";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
</script>

<template>
  <form @submit.prevent="joinTournament" class="grid gap-4">
    <h1 class="flex gap-2" v-if="!tournament.is_organizer">
      <MessageCircleWarning />
      {{
        $t("tournament.join.requirements", {
          count: tournament.min_players_per_lineup,
        })
      }}
    </h1>

    <FormField v-slot="{ value, handleChange }" name="new_team">
      <FormItem
        class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
        @click="handleChange(!value)"
      >
        <div class="space-y-0.5">
          <FormLabel class="text-base">{{
            $t("tournament.team.new")
          }}</FormLabel>
        </div>
        <FormControl>
          <Switch
            class="pointer-events-none"
            :model-value="value"
            @update:model-value="handleChange"
          />
        </FormControl>
      </FormItem>
    </FormField>

    <template v-if="tournament.is_organizer && form.values.new_team">
      <FormField v-slot="{ value, handleChange }" name="add_self_to_lineup">
        <FormItem
          class="flex flex-row items-center justify-between rounded-lg border p-4 cursor-pointer"
          @click="handleChange(!value)"
        >
          <div class="space-y-0.5">
            <FormLabel class="text-base">{{
              $t("tournament.join.add_self_to_lineup")
            }}</FormLabel>
          </div>
          <FormControl>
            <Switch
              class="pointer-events-none"
              :model-value="value"
              @update:model-value="handleChange"
            />
          </FormControl>
        </FormItem>
      </FormField>

      <PlayerSearch
        :label="$t('tournament.join.team_owner')"
        @selected="setOwnerTeamOwner"
        :selected="teamOwner"
        v-if="!form.values.add_self_to_lineup && form.values.new_team"
      ></PlayerSearch>
    </template>

    <template v-if="!form.values.new_team">
      <FormField v-slot="{ handleChange, componentField }" name="team_id">
        <FormItem>
          <TeamSearch
            :label="$t('tournament.team.select')"
            :my-teams="tournament.is_organizer ? false : true"
            :is-admin="tournament.is_organizer ? false : true"
            @selected="
              (team) => {
                handleChange(team.id);
              }
            "
            v-model="componentField.modelValue"
          ></TeamSearch>
          <FormMessage />
        </FormItem>
      </FormField>
    </template>
    <template v-else>
      <FormField v-slot="{ componentField }" name="team_name">
        <FormItem>
          <FormLabel>{{ $t("tournament.team.name") }}</FormLabel>
          <Input v-bind="componentField"></Input>
          <FormMessage />
        </FormItem>
      </FormField>
    </template>

    <Button type="submit" :disabled="Object.keys(form.errors).length > 0">
      {{ $t("tournament.join.title") }}
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
  emits: ["close"],
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      teamOwner: null,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            new_team: z.boolean().default(false),
            add_self_to_lineup: z.boolean().default(false),
            owner_steam_id: z.string().optional(),
            team_name: z
              .string()
              .optional()
              .refine(
                (value) => {
                  if (!this.form.values.new_team) {
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
                  if (this.form.values.new_team) {
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
  },
  watch: {
    "form.values.add_self_to_lineup": {
      handler(newVal) {
        if (newVal) {
          this.teamOwner = null;
          if (this.tournament.is_organizer) {
            this.form.setFieldValue("owner_steam_id", this.me.steam_id);
          }
        }
      },
    },
    "form.values.new_team": {
      handler(newVal) {
        if (!newVal) {
          this.teamOwner = null;
          this.form.setFieldValue("owner_steam_id", null);
          this.form.setFieldValue("add_self_to_lineup", false);
          return;
        }

        this.form.setFieldValue(
          "add_self_to_lineup",
          this.tournament.is_organizer ? false : true,
        );
      },
    },
  },
  methods: {
    async setOwnerTeamOwner(player) {
      this.teamOwner = player;
      this.form.setFieldValue("owner_steam_id", player.steam_id);
    },
    async joinTournament() {
      const { valid } = await this.form.validate();

      if (!valid) {
        return;
      }

      let teamName = this.form.values.team_name;

      let addPlayerSteamId = null;
      if (
        !this.form.values.team_id &&
        this.form.values.add_self_to_lineup &&
        !this.form.values.owner_steam_id
      ) {
        addPlayerSteamId = this.me.steam_id;
      } else if (this.form.values.owner_steam_id) {
        addPlayerSteamId = this.form.values.owner_steam_id;
      }

      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_teams_one: [
            {
              object: {
                tournament_id: this.$route.params.tournamentId,
                name: teamName,
                ...(this.tournament.is_organizer && addPlayerSteamId
                  ? { owner_steam_id: addPlayerSteamId }
                  : {}),
                team_id: this.form.values.new_team
                  ? null
                  : this.form.values.team_id,
                roster: {
                  data: addPlayerSteamId
                    ? [
                        {
                          player_steam_id: addPlayerSteamId,
                          tournament_id: this.$route.params.tournamentId,
                        },
                      ]
                    : [],
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
        title: this.$t("tournament.join.title"),
      });

      this.form.resetForm();
      
      // Emit close event to close drawer/modal
      this.$emit("close");
    },
  },
};
</script>
