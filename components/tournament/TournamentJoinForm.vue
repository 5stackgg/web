<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Switch } from "~/components/ui/switch";
import { MessageCircleWarning } from "lucide-vue-next";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import { Card } from "~/components/ui/card";
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
      <FormItem>
        <Card
          class="bg-gradient-to-br from-muted/50 to-muted/30 border-border/50 cursor-pointer"
          @click="handleChange(!value)"
        >
          <div class="flex flex-row items-center justify-between p-4">
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
          </div>
        </Card>
      </FormItem>
    </FormField>

    <template v-if="tournament.is_organizer && form.values.new_team">
      <FormField
        v-if="tournament.can_join"
        v-slot="{ value, handleChange }"
        name="add_self_to_lineup"
      >
        <FormItem>
          <Card
            class="bg-gradient-to-br from-muted/50 to-muted/30 border-border/50 cursor-pointer"
            @click="handleChange(!value)"
          >
            <div class="flex flex-row items-center justify-between p-4">
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
            </div>
          </Card>
        </FormItem>
      </FormField>

      <PlayerSearch
        :label="$t('tournament.join.team_owner')"
        @selected="setOwnerTeamOwner"
        :selected="teamOwner"
        :exclude="existingTournamentPlayerSteamIds"
        v-if="!form.values.add_self_to_lineup && form.values.new_team"
      ></PlayerSearch>
    </template>

    <template v-if="!form.values.new_team">
      <FormField v-slot="{ handleChange, componentField, meta }" name="team_id">
        <FormItem>
          <TeamSearch
            :label="$t('tournament.team.select')"
            :my-teams="canSelectAnyTeam ? false : true"
            :is-admin="canSelectAnyTeam ? false : true"
            :tournament-join-selector="!canSelectAnyTeam"
            :exclude="existingTeamIds"
            @selected="
              async (team) => {
                handleChange(String(team.id));
                form.setFieldTouched('team_id', true);
              }
            "
            v-model="componentField.modelValue"
          ></TeamSearch>
          <FormMessage v-if="meta.touched" />
        </FormItem>
      </FormField>
    </template>
    <template v-else>
      <FormField v-slot="{ componentField, meta }" name="team_name">
        <FormItem>
          <FormLabel>{{ $t("common.team_name") }}</FormLabel>
          <Input v-bind="componentField"></Input>
          <FormMessage v-if="meta.touched" />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField, meta }" name="short_name">
        <FormItem>
          <FormLabel>{{ $t("team.form.short_name") }}</FormLabel>
          <Input
            v-bind="componentField"
            :placeholder="$t('team.form.short_name_placeholder')"
            maxlength="5"
            class="uppercase tracking-[0.15em] font-mono"
            @input="autoShortName = false"
          ></Input>
          <FormMessage v-if="meta.touched" />
        </FormItem>
      </FormField>
    </template>

    <Button
      type="submit"
      :disabled="
        (!form.values.new_team && !form.values.team_id) ||
        (form.values.new_team && !form.values.team_name) ||
        (form.values.new_team && !form.values.short_name) ||
        (form.values.new_team &&
          tournament.is_organizer &&
          !form.values.add_self_to_lineup &&
          !form.values.owner_steam_id)
      "
    >
      {{ $t("tournament.join.title") }}
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
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
      autoShortName: true,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            new_team: z.boolean().default(false),
            add_self_to_lineup: z.boolean().default(false),
            owner_steam_id: z
              .string()
              .optional()
              .refine(
                (value) => {
                  if (
                    !this.form.values.new_team ||
                    this.form.values.add_self_to_lineup ||
                    !this.tournament.is_organizer
                  ) {
                    return true;
                  }
                  return value !== undefined;
                },
                { message: this.$t("validation_extras.team_owner_required") },
              ),
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
                { message: this.$t("validation_extras.team_name_required") },
              ),
            short_name: z
              .string()
              .max(5)
              .optional()
              .refine(
                (value) => {
                  if (!this.form.values.new_team) {
                    return true;
                  }
                  return value !== undefined && value.length > 0;
                },
                { message: this.$t("validation_extras.short_name_required") },
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
                { message: this.$t("validation_extras.team_required") },
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
    canSelectAnyTeam() {
      return this.tournament.is_organizer || useAuthStore().isAdmin;
    },
    existingTeamIds() {
      return (this.tournament.teams || [])
        .map((t) => t.team_id)
        .filter(Boolean);
    },
    existingTournamentPlayerSteamIds() {
      const steamIds = new Set<string>();
      for (const team of this.tournament.teams || []) {
        for (const entry of team.roster || []) {
          if (entry.player?.steam_id) {
            steamIds.add(entry.player.steam_id);
          }
        }
      }
      return Array.from(steamIds);
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
          this.autoShortName = true;
          this.form.setFieldValue("owner_steam_id", undefined);
          this.form.setFieldValue("add_self_to_lineup", false);
          return;
        }

        // Only set add_self_to_lineup to true if can_join is true
        const shouldAddSelf = this.tournament.is_organizer
          ? false
          : this.tournament.can_join;
        this.form.setFieldValue("add_self_to_lineup", shouldAddSelf);
      },
    },
    "form.values.team_name": {
      handler(newName: string | undefined) {
        if (!this.autoShortName) {
          return;
        }
        const derived = (newName || "")
          .split(/\s+/)
          .filter(Boolean)
          .map((word) => word[0])
          .join("")
          .toUpperCase()
          .slice(0, 5);
        this.form.setFieldValue("short_name", derived);
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
      let shortName = this.form.values.short_name;

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

      // For a new tournament-only team, the captain is the player being added.
      // For an existing team, leave it unset so the trigger picks the team's
      // captain/owner — the organizer adding the team isn't necessarily on its roster.
      const captainSteamId = this.form.values.new_team
        ? addPlayerSteamId || this.me.steam_id
        : null;

      await this.$apollo.mutate({
        mutation: generateMutation({
          insert_tournament_teams_one: [
            {
              object: {
                tournament_id: this.$route.params.tournamentId,
                name: teamName,
                short_name: this.form.values.new_team ? shortName : null,
                ...(this.tournament.is_organizer && addPlayerSteamId
                  ? { owner_steam_id: addPlayerSteamId }
                  : {}),
                ...(captainSteamId ? { captain_steam_id: captainSteamId } : {}),
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
      this.autoShortName = true;

      // Emit close event to close drawer/modal
      this.$emit("close");
    },
  },
};
</script>
