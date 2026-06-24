<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import PlayerDisplay from "~/components/PlayerDisplay.vue";

const cardClasses =
  "relative rounded-lg border border-border p-5 [background:linear-gradient(180deg,hsl(var(--card)_/_0.55)_0%,hsl(var(--card)_/_0.25)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[12px] before:w-[12px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[12px] after:w-[12px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']";

const eyebrowClasses =
  "inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground";

const tickClasses = "h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]";

const labelClasses =
  "font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground";

const submitClasses =
  "w-full bg-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)_/_0.9)] text-[hsl(var(--tac-amber-foreground))] font-sans font-bold uppercase tracking-[0.18em] disabled:opacity-60";
</script>

<template>
  <form @submit.prevent="updateCreateTeam" class="grid gap-5">
    <div :class="cardClasses">
      <div :class="eyebrowClasses">
        <span :class="tickClasses"></span>
        {{ $t("team.form.identity") }}
      </div>

      <div class="mt-5 space-y-5">
        <FormField v-slot="{ componentField }" name="team_name">
          <FormItem class="space-y-1.5">
            <FormLabel :class="labelClasses">
              {{ $t("common.team_name") }}
            </FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('team.form.name_placeholder')"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="short_name">
          <FormItem class="space-y-1.5">
            <FormLabel :class="labelClasses">
              {{ $t("team.form.short_name") }}
            </FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('team.form.short_name_placeholder')"
                maxlength="5"
                class="uppercase tracking-[0.15em] font-mono"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField
          v-if="team && canUpdateOwner"
          v-slot="{ componentField }"
          name="owner_steam_id"
        >
          <FormItem class="space-y-1.5">
            <FormLabel :class="labelClasses">
              {{ $t("team.form.owner") }}
            </FormLabel>
            <Select v-bind="componentField">
              <FormControl>
                <SelectTrigger>
                  <SelectValue :placeholder="$t('team.form.select_owner')" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="{ player } in team.roster"
                    :key="player.steam_id"
                    :value="player.steam_id"
                  >
                    <PlayerDisplay :player="player" />
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </div>

    <div v-if="!team && invitedPlayers.length" :class="cardClasses">
      <div :class="eyebrowClasses">
        <span :class="tickClasses"></span>
        {{ $t("team.form.inviting") }}
      </div>
      <div class="mt-4 flex flex-col gap-2">
        <PlayerDisplay
          v-for="player in invitedPlayers"
          :key="player.steam_id"
          :player="player"
        />
      </div>
      <p class="mt-3 text-xs text-muted-foreground">
        {{ $t("team.form.inviting_hint") }}
      </p>
    </div>

    <Button
      type="submit"
      :disabled="Object.keys(form.errors).length > 0"
      :loading="submitting"
      :class="submitClasses"
    >
      {{ team ? $t("team.form.update") : $t("team.form.create") }}
    </Button>
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { $, e_player_roles_enum } from "~/generated/zeus";

export default {
  emits: ["updated"],
  props: {
    team: {
      type: Object,
      required: false,
    },
    inviteMembers: {
      type: Array,
      required: false,
      default: () => [],
    },
  },
  data() {
    return {
      submitting: false,
      owner: undefined,
      invitedPlayers: [] as Array<Record<string, any>>,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            team_name: z.string().min(1),
            short_name: z.string().min(1).max(5),
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
  apollo: {
    invitedPlayers: {
      query: generateQuery({
        players: [
          {
            where: {
              steam_id: { _in: $("steamIds", "[bigint!]!") },
            },
          },
          {
            steam_id: true,
            name: true,
            avatar_url: true,
            custom_avatar_url: true,
            country: true,
            role: true,
          },
        ],
      }),
      variables(this: any) {
        return { steamIds: this.inviteSteamIds };
      },
      skip(this: any) {
        return this.inviteSteamIds.length === 0;
      },
      update: (data: any) => data.players ?? [],
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    inviteSteamIds(): string[] {
      return (this.inviteMembers as string[]).filter(
        (steamId) => steamId && steamId !== this.me?.steam_id,
      );
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

        const teamId = data.insert_teams_one.id;

        const members = this.inviteSteamIds;
        if (members.length > 0) {
          // Inviting a player is an insert into team_roster (role defaults to
          // 'Pending'); the user role has no direct insert on team_invites.
          await this.$apollo.mutate({
            mutation: generateMutation({
              insert_team_roster: [
                {
                  objects: members.map((steamId) => ({
                    team_id: teamId,
                    player_steam_id: steamId,
                  })),
                },
                { affected_rows: true },
              ],
            }),
          });
        }

        this.$router.push(`/teams/${teamId}`);
      } finally {
        this.submitLock = false;
        this.submitting = false;
      }
    },
  },
};
</script>
