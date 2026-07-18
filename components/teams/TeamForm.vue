<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormSection,
} from "~/components/ui/form";
import { Switch } from "~/components/ui/switch";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import { tacticalCtaButtonClasses } from "~/utilities/tacticalClasses";
</script>

<template>
  <form @submit.prevent="updateCreateTeam" class="grid gap-6">
    <FormSection :title="$t('team.form.identity')">
      <div class="grid gap-4">
        <FormField v-slot="{ componentField }" name="team_name">
          <FormItem>
            <FormLabel>{{ $t("common.team_name") }}</FormLabel>
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
          <FormItem>
            <FormLabel>{{ $t("team.form.short_name") }}</FormLabel>
            <FormControl>
              <Input
                v-bind="componentField"
                :placeholder="$t('team.form.short_name_placeholder')"
                maxlength="5"
                class="font-mono uppercase tracking-[0.15em] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
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
          <FormItem>
            <FormLabel>{{ $t("team.form.owner") }}</FormLabel>
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

        <FormField
          v-if="team && isOrganizationEditable"
          v-slot="{ value, handleChange }"
          name="is_organization"
        >
          <FormItem>
            <div
              class="flex flex-row items-center justify-between cursor-pointer"
              @click="handleChange(!value)"
            >
              <div class="space-y-0.5">
                <FormLabel>{{ $t("team.form.is_organization.label") }}</FormLabel>
                <FormDescription>{{
                  $t("team.form.is_organization.description")
                }}</FormDescription>
              </div>
              <FormControl>
                <Switch
                  class="pointer-events-none"
                  :model-value="value"
                  @update:model-value="handleChange"
                />
              </FormControl>
            </div>
          </FormItem>
        </FormField>
      </div>
    </FormSection>

    <FormSection
      v-if="!team && invitedPlayers.length"
      :title="$t('team.form.inviting')"
    >
      <div class="flex flex-col gap-2">
        <PlayerDisplay
          v-for="player in invitedPlayers"
          :key="player.steam_id"
          :player="player"
        />
      </div>
      <p class="mt-3 text-xs text-muted-foreground">
        {{ $t("team.form.inviting_hint") }}
      </p>
    </FormSection>

    <Button
      v-if="!team"
      type="submit"
      :disabled="Object.keys(form.errors).length > 0"
      :loading="submitting"
      :class="[tacticalCtaButtonClasses, 'w-full justify-center']"
    >
      {{ $t("team.form.create") }}
    </Button>

    <SettingsSaveBar
      v-else
      contained
      :dirty="isDirty"
      :submitting="submitting"
      @save="updateCreateTeam"
      @discard="discardChanges"
    />
  </form>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { $, e_player_roles_enum } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";

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
      baseline: null as string | null,
      isDirty: false,
      owner: undefined,
      invitedPlayers: [] as Array<Record<string, any>>,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            team_name: z.string().min(1),
            short_name: z.string().min(1).max(5),
            is_organization: z.boolean().optional(),
          }),
        ),
      }),
    };
  },
  watch: {
    team: {
      immediate: true,
      handler(team) {
        // `team` is subscription-backed; don't clobber in-progress edits.
        if (team && (this.baseline === null || !this.isDirty)) {
          this.populateTeam(team);
        }
      },
    },
    ["form.values"]: {
      deep: true,
      handler() {
        this.isDirty =
          this.baseline !== null &&
          JSON.stringify(this.form.values) !== this.baseline;
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
    isOrganizationEditable() {
      return useAuthStore().isRoleAbove(e_player_roles_enum.tournament_organizer);
    },
  },
  methods: {
    populateTeam(team: any) {
      this.form.setValues({
        team_name: team.name,
        short_name: team.short_name,
        is_organization: team.is_organization ?? false,
      });
      this.takeSnapshot();
    },
    takeSnapshot() {
      this.$nextTick(() => {
        this.baseline = JSON.stringify(this.form.values);
        this.isDirty = false;
      });
    },
    discardChanges() {
      if (this.team) {
        this.populateTeam(this.team);
      }
    },
    async updateCreateTeam() {
      if (this.submitLock) {
        return;
      }
      this.submitLock = true;
      try {
        const { valid, errors } = await this.form.validate();

        if (!valid) {
          toast({
            variant: "destructive",
            title: this.$t("common.error"),
            description: Object.values(errors ?? {})[0] as string,
          });
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
                    ...(this.isOrganizationEditable
                      ? { is_organization: this.form.values.is_organization }
                      : {}),
                  },
                },
                {
                  __typename: true,
                },
              ],
            }),
          });
          this.takeSnapshot();
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
