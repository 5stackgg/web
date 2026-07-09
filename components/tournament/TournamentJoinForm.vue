<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormSection,
} from "~/components/ui/form";
import { Switch } from "~/components/ui/switch";
import { MessageCircleWarning } from "lucide-vue-next";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
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
              <FormLabel>{{ $t("tournament.team.new") }}</FormLabel>
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
                <FormLabel>{{
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

      <div
        v-if="form.values.team_id && rosterGroups.length"
        class="space-y-2"
      >
        <label
          class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{
            $t("tournament.join.roster_range", {
              selected: selectedPlayers.size,
              max: maxLineup,
            })
          }}
        </label>
        <div v-for="group in rosterGroups" :key="group.key" class="space-y-1.5">
          <div
            class="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t(`tournament.join.group.${group.key}`) }} ·
            {{ group.members.length }}
          </div>
          <ul class="grid gap-1.5 sm:grid-cols-2">
            <li
              v-for="member in group.members"
              :key="member.player_steam_id"
              class="flex items-center gap-2.5 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
              :class="rosterItemClass(member)"
              @click="togglePlayer(member)"
            >
              <Checkbox
                :model-value="selectedPlayers.has(member.player_steam_id)"
                :disabled="
                  isTaken(member) ||
                  (!selectedPlayers.has(member.player_steam_id) && atLineupCap)
                "
                @click.stop="togglePlayer(member)"
              />
              <PlayerDisplay :player="member.player" />
              <span
                v-if="isTaken(member)"
                class="ml-auto text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground"
              >
                {{ $t("tournament.join.already_rostered") }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </template>
    <template v-else>
      <FormSection :title="$t('team.form.identity')">
        <div class="space-y-5">
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
        </div>
      </FormSection>
    </template>

    <Button
      variant="tactical"
      type="submit"
      :loading="submitting"
      :disabled="
        (!form.values.new_team && !form.values.team_id) ||
        (!form.values.new_team &&
          !!form.values.team_id &&
          selectedPlayers.size === 0) ||
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
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
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
      submitting: false,
      teamOwner: null,
      autoShortName: true,
      teamRoster: [] as any[],
      selectedPlayers: new Set<string>(),
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
    maxLineup() {
      return (
        this.tournament.max_players_per_lineup ||
        this.tournament.min_players_per_lineup ||
        0
      );
    },
    takenSteamIds() {
      return new Set(this.existingTournamentPlayerSteamIds.map(String));
    },
    rosterGroups() {
      const sortByName = (list: any[]) =>
        [...list].sort((a, b) =>
          (a.player?.name ?? "").localeCompare(b.player?.name ?? ""),
        );
      return [
        { key: "starters", status: "Starter" },
        { key: "substitutes", status: "Substitute" },
        { key: "benched", status: "Benched" },
      ]
        .map((group) => ({
          key: group.key,
          members: sortByName(
            this.teamRoster.filter((m: any) => m.status === group.status),
          ),
        }))
        .filter((group) => group.members.length);
    },
    atLineupCap() {
      return this.maxLineup > 0 && this.selectedPlayers.size >= this.maxLineup;
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
    "form.values.team_id": {
      handler(teamId: string | undefined) {
        if (!teamId || this.form.values.new_team) {
          this.teamRoster = [];
          this.selectedPlayers = new Set();
          return;
        }
        this.fetchTeamRoster(teamId);
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

        this.teamRoster = [];
        this.selectedPlayers = new Set();

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
    isTaken(member) {
      return this.takenSteamIds.has(member.player_steam_id);
    },
    rosterItemClass(member) {
      if (this.isTaken(member)) {
        return "cursor-not-allowed opacity-40";
      }
      if (!this.selectedPlayers.has(member.player_steam_id) && this.atLineupCap) {
        return "cursor-not-allowed opacity-50";
      }
      return "cursor-pointer";
    },
    togglePlayer(member) {
      if (this.isTaken(member)) {
        return;
      }
      const steamId = member.player_steam_id;
      const next = new Set(this.selectedPlayers);
      if (next.has(steamId)) {
        next.delete(steamId);
      } else if (!this.atLineupCap) {
        next.add(steamId);
      }
      this.selectedPlayers = next;
    },
    async fetchTeamRoster(teamId) {
      const { data } = await this.$apollo.query({
        query: generateQuery({
          team_roster: [
            { where: { team_id: { _eq: teamId } } },
            {
              player_steam_id: true,
              status: true,
              coach: true,
              player: {
                steam_id: true,
                name: true,
                avatar_url: true,
              },
            },
          ],
          teams: [
            { where: { id: { _eq: teamId } } },
            {
              captain_steam_id: true,
              owner_steam_id: true,
            },
          ],
        }),
        fetchPolicy: "network-only",
      });

      if (this.form.values.team_id !== teamId) {
        return;
      }

      this.teamRoster = (data.team_roster || []).map((entry) => ({
        ...entry,
        player_steam_id: String(entry.player_steam_id),
      }));

      const team = (data.teams || [])[0];
      const captainSteamId = String(
        team?.captain_steam_id || team?.owner_steam_id || "",
      );
      const order = { Starter: 0, Substitute: 1, Benched: 2 };
      const prioritized = [...this.teamRoster]
        .filter((member) => !this.takenSteamIds.has(member.player_steam_id))
        .sort((a, b) => {
          const aCaptain = a.player_steam_id === captainSteamId ? -1 : 0;
          const bCaptain = b.player_steam_id === captainSteamId ? -1 : 0;
          if (aCaptain !== bCaptain) {
            return aCaptain - bCaptain;
          }
          return (order[a.status] ?? 3) - (order[b.status] ?? 3);
        });

      this.selectedPlayers = new Set(
        prioritized
          .slice(0, this.maxLineup || prioritized.length)
          .map((member) => member.player_steam_id),
      );
    },
    async joinTournament() {
      if (this.submitLock) {
        return;
      }
      this.submitLock = true;
      try {
        const { valid } = await this.form.validate();

        if (!valid) {
          return;
        }

        this.submitting = true;
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
                  ...(captainSteamId
                    ? { captain_steam_id: captainSteamId }
                    : {}),
                  team_id: this.form.values.new_team
                    ? null
                    : this.form.values.team_id,
                  roster: {
                    data: this.form.values.new_team
                      ? addPlayerSteamId
                        ? [
                            {
                              player_steam_id: addPlayerSteamId,
                              tournament_id: this.$route.params.tournamentId,
                            },
                          ]
                        : []
                      : Array.from(this.selectedPlayers).map(
                          (player_steam_id) => ({
                            player_steam_id,
                            tournament_id: this.$route.params.tournamentId,
                          }),
                        ),
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
        this.teamRoster = [];
        this.selectedPlayers = new Set();

        // Emit close event to close drawer/modal
        this.$emit("close");
      } finally {
        this.submitLock = false;
        this.submitting = false;
      }
    },
  },
};
</script>
