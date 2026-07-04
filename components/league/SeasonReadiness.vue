<script setup lang="ts">
import { computed } from "vue";
import { Check, AlertTriangle } from "lucide-vue-next";

// Two things worth showing before a season starts: how many approved teams
// each division holds, and which teams are below the minimum roster size (they
// are warned and revoked at kickoff otherwise).
const props = defineProps<{
  season: any;
  divisions: any[];
}>();

const rosterMin = computed(
  () =>
    props.season.min_roster_size ??
    useApplicationSettingsStore().teamMinRosterSize,
);

const approvedByDivision = computed(() => {
  const counts = new Map<string, number>();
  for (const ts of props.season.team_seasons ?? []) {
    if (ts.status === "Approved" && ts.assigned_division_id) {
      counts.set(
        ts.assigned_division_id,
        (counts.get(ts.assigned_division_id) ?? 0) + 1,
      );
    }
  }
  return counts;
});

const divisionSizes = computed(() =>
  (props.divisions ?? [])
    .filter((d: any) => d.active)
    .map((d: any) => ({
      id: d.id,
      name: d.name,
      count: approvedByDivision.value.get(d.id) ?? 0,
    })),
);

const thinTeams = computed(() =>
  (props.season.team_seasons ?? [])
    .filter(
      (ts: any) =>
        ts.status !== "Withdrawn" &&
        ts.status !== "Declined" &&
        (ts.roster?.length ?? 0) < rosterMin.value,
    )
    .map((ts: any) => ({
      id: ts.id,
      name: ts.league_team.team.name,
      count: ts.roster?.length ?? 0,
    })),
);
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-1.5">
      <div
        class="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{ $t("league.readiness.division_sizes") }}
      </div>
      <ul class="space-y-1">
        <li
          v-for="division in divisionSizes"
          :key="division.id"
          class="flex items-center justify-between rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm"
        >
          <span>{{ division.name }}</span>
          <span class="font-mono text-xs text-muted-foreground">
            {{ division.count }}
          </span>
        </li>
      </ul>
    </div>

    <div class="space-y-1.5">
      <div
        class="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{
          thinTeams.length
            ? $t("league.readiness.rosters_thin")
            : $t("league.readiness.rosters_ok")
        }}
      </div>
      <p
        v-if="!thinTeams.length"
        class="flex items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm text-success"
      >
        <Check class="h-4 w-4 shrink-0" />
        {{ $t("league.readiness.rosters_ok") }}
      </p>
      <ul v-else class="space-y-1">
        <li
          v-for="team in thinTeams"
          :key="team.id"
          class="flex items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm"
        >
          <span class="flex items-center gap-2">
            <AlertTriangle class="h-4 w-4 shrink-0 text-warning" />
            {{ team.name }}
          </span>
          <span class="font-mono text-xs text-muted-foreground">
            {{ team.count }}/{{ rosterMin }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
