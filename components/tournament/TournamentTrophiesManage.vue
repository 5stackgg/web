<script lang="ts">
import { Button } from "~/components/ui/button";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $ } from "~/generated/zeus";

const PLACEMENT_LABELS: Record<number, string> = {
  0: "MVP",
  1: "1st Place",
  2: "2nd Place",
  3: "3rd Place",
};

const PLACEMENT_COLORS: Record<number, string> = {
  0: "hsl(195 85% 60%)",
  1: "hsl(45 95% 60%)",
  2: "hsl(0 0% 78%)",
  3: "hsl(28 70% 52%)",
};

export default {
  components: { Button },
  props: {
    tournament: { type: Object, required: true },
  },
  data() {
    return {
      placementLabels: PLACEMENT_LABELS,
      placementColors: PLACEMENT_COLORS,
      placements: [0, 1, 2, 3],
      adding: false,
      saving: false,
      draft: {
        placement: 1 as 0 | 1 | 2 | 3,
        tournament_team_id: null as string | null,
        player_steam_id: null as string | null,
      },
    };
  },
  computed: {
    isOrganizer(): boolean {
      return !!this.tournament?.is_organizer;
    },
    manualTrophies(): any[] {
      return ((this.tournament?.trophies || []) as any[])
        .filter((t) => t.manual)
        .sort((a, b) => a.placement - b.placement);
    },
    teams(): any[] {
      return (this.tournament?.teams || []) as any[];
    },
    selectedTeam(): any | null {
      return (
        this.teams.find((t) => t.id === this.draft.tournament_team_id) || null
      );
    },
    rosterOptions(): Array<{ steam_id: string; name: string }> {
      const roster = this.selectedTeam?.roster || [];
      return roster
        .map((r: any) => r.player)
        .filter(Boolean)
        .map((p: any) => ({ steam_id: String(p.steam_id), name: p.name }));
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
      this.draft = {
        placement: 1,
        tournament_team_id: null,
        player_steam_id: null,
      };
      this.adding = true;
    },
    cancelAdd() {
      this.adding = false;
    },
    onTeamChange(teamId: string) {
      this.draft.tournament_team_id = teamId || null;
      this.draft.player_steam_id = null;
    },
    async submitAdd() {
      if (
        !this.draft.tournament_team_id ||
        !this.draft.player_steam_id ||
        this.draft.placement == null
      ) {
        return;
      }
      this.saving = true;
      try {
        await this.$apollo.mutate({
          mutation: typedGql("mutation")({
            insert_tournament_trophies_one: [
              {
                object: {
                  tournament_id: $("tournament_id", "uuid!"),
                  tournament_team_id: $("tournament_team_id", "uuid!"),
                  player_steam_id: $("player_steam_id", "bigint!"),
                  placement: $("placement", "Int!"),
                },
              },
              { id: true },
            ],
          }),
          variables: {
            tournament_id: this.tournament.id,
            tournament_team_id: this.draft.tournament_team_id,
            player_steam_id: this.draft.player_steam_id,
            placement: this.draft.placement,
          },
        });
        this.adding = false;
      } catch (err) {
        console.error("Failed to add manual trophy", err);
      } finally {
        this.saving = false;
      }
    },
    async remove(trophyId: string) {
      try {
        await this.$apollo.mutate({
          mutation: typedGql("mutation")({
            delete_tournament_trophies_by_pk: [
              { id: $("id", "uuid!") },
              { id: true },
            ],
          }),
          variables: { id: trophyId },
        });
      } catch (err) {
        console.error("Failed to remove manual trophy", err);
      }
    },
    playerNameFor(trophy: any): string {
      if (trophy.player?.name) return trophy.player.name;
      const team = this.teams.find((t) => t.id === trophy.tournament_team_id);
      const roster = team?.roster || [];
      const member = roster.find(
        (r: any) =>
          String(r.player?.steam_id) === String(trophy.player_steam_id),
      );
      return member?.player?.name || String(trophy.player_steam_id);
    },
  },
};
</script>

<template>
  <section
    class="relative overflow-hidden rounded-lg border border-border px-6 py-6 [background:linear-gradient(180deg,hsl(var(--card)_/_0.7)_0%,hsl(var(--card)_/_0.35)_100%)] [backdrop-filter:blur(6px)]"
  >
    <header class="relative mb-4 flex items-center justify-between gap-4">
      <div class="flex flex-col gap-1">
        <div
          class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground"
        >
          <span
            class="translate-y-[-1px] text-[0.7rem] text-[hsl(var(--tac-amber))]"
            >◢</span
          >
          Manual Awards
        </div>
        <div
          class="font-mono text-[0.62rem] uppercase tracking-[0.3em] text-muted-foreground/70"
        >
          ▚ GRANT A TROPHY OUTSIDE OF THE BRACKET CALCULATION
        </div>
      </div>
      <Button
        v-if="isOrganizer && !adding"
        size="sm"
        @click="startAdd"
        :disabled="!teams.length"
      >
        Add Award
      </Button>
    </header>

    <div
      v-if="!isOrganizer"
      class="rounded-sm border border-dashed border-border px-4 py-6 text-center font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground"
    >
      ORGANIZER ACCESS REQUIRED
    </div>

    <template v-else>
      <div
        v-if="adding"
        class="mb-4 grid gap-3 rounded-sm border border-border/60 bg-background/40 p-4 sm:grid-cols-[auto_1fr_1fr_auto_auto]"
      >
        <label class="flex flex-col gap-1">
          <span
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
            >Placement</span
          >
          <select
            v-model.number="draft.placement"
            class="rounded-sm border border-border bg-background px-2 py-1 text-sm"
          >
            <option v-for="p in placements" :key="p" :value="p">
              {{ placementLabels[p] }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
            >Team</span
          >
          <select
            :value="draft.tournament_team_id || ''"
            class="rounded-sm border border-border bg-background px-2 py-1 text-sm"
            @change="onTeamChange(($event.target as HTMLSelectElement).value)"
          >
            <option value="">Select team…</option>
            <option v-for="team in teams" :key="team.id" :value="team.id">
              {{ teamNameById[team.id] }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
            >Player</span
          >
          <select
            v-model="draft.player_steam_id"
            :disabled="!draft.tournament_team_id"
            class="rounded-sm border border-border bg-background px-2 py-1 text-sm disabled:opacity-60"
          >
            <option :value="null">Select player…</option>
            <option
              v-for="p in rosterOptions"
              :key="p.steam_id"
              :value="p.steam_id"
            >
              {{ p.name }}
            </option>
          </select>
        </label>
        <div class="flex items-end">
          <Button
            size="sm"
            :disabled="
              saving || !draft.tournament_team_id || !draft.player_steam_id
            "
            @click="submitAdd"
          >
            {{ saving ? "Saving…" : "Save" }}
          </Button>
        </div>
        <div class="flex items-end">
          <Button
            variant="outline"
            size="sm"
            :disabled="saving"
            @click="cancelAdd"
          >
            Cancel
          </Button>
        </div>
      </div>

      <div
        v-if="!manualTrophies.length"
        class="rounded-sm border border-dashed border-border bg-background/30 px-4 py-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground"
      >
        NO MANUAL AWARDS
      </div>

      <ul v-else class="flex flex-col divide-y divide-border/60">
        <li
          v-for="trophy in manualTrophies"
          :key="trophy.id"
          class="flex items-center gap-3 py-2"
        >
          <span
            class="rounded-sm border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.22em]"
            :style="{
              borderColor: placementColors[trophy.placement] + '55',
              background: placementColors[trophy.placement] + '12',
              color: placementColors[trophy.placement],
            }"
          >
            {{ placementLabels[trophy.placement] }}
          </span>
          <span class="text-sm font-semibold">
            {{ playerNameFor(trophy) }}
          </span>
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            · {{ teamNameById[trophy.tournament_team_id] || "—" }}
          </span>
          <span class="flex-1"></span>
          <Button variant="outline" size="sm" @click="remove(trophy.id)">
            Remove
          </Button>
        </li>
      </ul>
    </template>
  </section>
</template>
