<script lang="ts">
import { Button } from "~/components/ui/button";
import ManageSection from "~/components/common/ManageSection.vue";
import AwardComposer from "~/components/award/AwardComposer.vue";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { awardDefinitionFields } from "~/graphql/awardFields";

const PLACEMENT_COLORS: Record<number, string> = {
  0: "hsl(195 85% 60%)",
  1: "hsl(45 95% 60%)",
  2: "hsl(0 0% 78%)",
  3: "hsl(28 70% 52%)",
};

const TIER_COLORS: Record<string, string> = {
  mvp: "hsl(195 85% 60%)",
  gold: "hsl(45 95% 60%)",
  silver: "hsl(0 0% 78%)",
  bronze: "hsl(28 70% 52%)",
  special: "hsl(258 90% 74%)",
};

export default {
  components: { Button, ManageSection, AwardComposer },
  props: {
    tournament: { type: Object, required: true },
  },
  data() {
    return {
      awards: [] as any[],
      placementColors: PLACEMENT_COLORS,
      adding: false,
    };
  },
  apollo: {
    awards: {
      fetchPolicy: "cache-and-network",
      query: typedGql("query")({
        awards: [{ order_by: [{ name: order_by.asc }] }, awardDefinitionFields],
      }),
    },
  },
  computed: {
    isOrganizer(): boolean {
      return !!this.tournament?.is_organizer;
    },
    manualAwards(): any[] {
      return ((this.tournament?.awards || []) as any[]).filter(
        (grant) => grant.source === "manual",
      );
    },
    canCreateAwards(): boolean {
      return useApplicationSettingsStore().canManageAwards;
    },
    // The 1st/2nd/3rd/MVP awards are placed by the bracket calculation, so
    // offering them here would let an organizer duplicate an automated grant.
    grantableAwards(): any[] {
      return (this.awards as any[]).filter((award) => !award.system_key);
    },
    teams(): any[] {
      return (this.tournament?.teams || []) as any[];
    },
    // Only entries backed by a real team can hold a team award:
    // award_recipients.team_id points at public.teams, and the bracket
    // calculation skips ad-hoc entries for the same reason.
    teamOptions(): Array<{ id: string; team_id: string; name: string }> {
      return this.teams
        .filter((entry: any) => !!entry.team_id)
        .map((entry: any) => ({
          id: entry.id,
          team_id: entry.team_id,
          name:
            entry.name ||
            entry.team?.name ||
            `Team ${String(entry.id).slice(0, 6)}`,
        }));
    },
    // Every rostered player in the tournament, grouped by their entry.
    rosterGroups(): Array<{
      id: string;
      name: string;
      players: Array<{ steam_id: string; name: string }>;
    }> {
      return this.teams
        .map((entry: any) => ({
          id: entry.id,
          name:
            entry.name ||
            entry.team?.name ||
            `Team ${String(entry.id).slice(0, 6)}`,
          players: (entry.roster || [])
            .map((row: any) => row.player)
            .filter(Boolean)
            .map((player: any) => ({
              steam_id: String(player.steam_id),
              name: player.name,
            })),
        }))
        .filter((group: any) => group.players.length > 0);
    },
    hasParticipants(): boolean {
      return this.rosterGroups.length > 0 || this.teamOptions.length > 0;
    },
    teamNameById(): Record<string, string> {
      const map: Record<string, string> = {};
      for (const team of this.teams) {
        map[team.id] =
          team.name || team.team?.name || `Team ${String(team.id).slice(0, 6)}`;
      }
      return map;
    },
  },
  methods: {
    startAdd() {
      this.adding = true;
    },
    async remove(recipientId: string) {
      try {
        await this.$apollo.mutate({
          mutation: typedGql("mutation")({
            revokeAward: [{ id: $("id", "uuid!") }, { success: true }],
          }),
          variables: { id: recipientId },
        });
      } catch (err) {
        console.error("Failed to revoke award", err);
      }
    },
    recipientNameFor(grant: any): string {
      if (!grant.player_steam_id) {
        return (
          grant.team?.name ||
          this.teamNameById[grant.tournament_team_id] ||
          "Team"
        );
      }
      if (grant.player?.name) return grant.player.name;
      const team = this.teams.find((t) => t.id === grant.tournament_team_id);
      const roster = team?.roster || [];
      const member = roster.find(
        (r: any) =>
          String(r.player?.steam_id) === String(grant.player_steam_id),
      );
      return member?.player?.name || String(grant.player_steam_id);
    },
    awardNameFor(grant: any): string {
      return grant.award?.name || "—";
    },
    grantColor(grant: any): string {
      return (
        this.placementColors[grant.placement] ??
        TIER_COLORS[grant.award?.tier] ??
        TIER_COLORS.special
      );
    },
  },
};
</script>

<template>
  <ManageSection
    :label="$t('tournament.awards_manage.manual_awards')"
    :hint="$t('tournament.awards_manage.hint')"
  >
    <!-- Hidden rather than disabled when nothing can receive an award: the
         notice below already states why, and a greyed button next to it still
         reads as pressable. -->
    <template v-if="isOrganizer && !adding && hasParticipants" #action>
      <Button
        size="sm"
        variant="outline"
        :disabled="!grantableAwards.length && !canCreateAwards"
        :title="
          grantableAwards.length || canCreateAwards
            ? undefined
            : $t('tournament.awards_manage.no_awards')
        "
        @click="startAdd"
      >
        {{ $t("tournament.awards_manage.add_award") }}
      </Button>
    </template>

    <div
      v-if="!isOrganizer"
      class="rounded-sm border border-dashed border-border px-4 py-6 text-center font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground"
    >
      {{ $t("tournament.awards_config.organizer_access_required") }}
    </div>

    <template v-else>
      <AwardComposer
        v-if="adding"
        v-model:open="adding"
        :tournament-id="tournament.id"
        :player-options="rosterGroups"
        :team-options="teamOptions"
        @saved="adding = false"
      />

      <div
        v-if="!hasParticipants"
        class="rounded-sm border border-dashed border-border bg-background/30 px-4 py-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground"
      >
        {{ $t("tournament.awards_manage.no_participants") }}
      </div>

      <div
        v-else-if="!manualAwards.length"
        key="empty"
        class="rounded-sm border border-dashed border-border bg-background/30 px-4 py-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground"
      >
        {{ $t("tournament.awards_manage.no_manual_awards") }}
      </div>

      <TransitionGroup
        v-else
        tag="ul"
        name="grant"
        class="relative flex flex-col divide-y divide-border/60"
      >
        <li
          v-for="grant in manualAwards"
          :key="grant.id"
          class="flex items-center gap-3 py-2"
        >
          <span
            class="rounded-sm border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.22em]"
            :style="{
              borderColor: grantColor(grant) + '55',
              background: grantColor(grant) + '12',
              color: grantColor(grant),
            }"
          >
            {{ awardNameFor(grant) }}
          </span>
          <span class="text-sm font-semibold">
            {{ recipientNameFor(grant) }}
          </span>
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            · {{ teamNameById[grant.tournament_team_id] || "—" }}
          </span>
          <span class="flex-1"></span>
          <Button variant="outline" size="sm" @click="remove(grant.id)">
            {{ $t("tournament.awards_manage.remove") }}
          </Button>
        </li>
      </TransitionGroup>
    </template>
  </ManageSection>
</template>

<style scoped>
/* Height-collapse for the grant form, matching the pattern used for the
   custom-pool filter in MatchOptions so the list below never snaps. */
.collapse-enter-active,
.collapse-leave-active {
  transition:
    grid-template-rows 240ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 200ms ease;
}

.collapse-enter-from,
.collapse-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

/* Granted rows slide in from the side they were added on and collapse out, so
   granting or revoking reads as a change to the list rather than a repaint. */
.grant-move,
.grant-enter-active,
.grant-leave-active {
  transition:
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 200ms ease;
}

.grant-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}

.grant-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

/* Taking leaving rows out of flow lets the survivors slide up smoothly. */
.grant-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .collapse-enter-active,
  .collapse-leave-active,
  .grant-move,
  .grant-enter-active,
  .grant-leave-active {
    transition: none;
  }
}
</style>
