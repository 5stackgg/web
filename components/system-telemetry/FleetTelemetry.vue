<script setup lang="ts">
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import FleetTelemetryChart from "./FleetTelemetryChart.vue";
import FleetDistribution from "./FleetDistribution.vue";
import FleetVersions from "./FleetVersions.vue";
import FleetMeter from "./FleetMeter.vue";
import FleetShares from "./FleetShares.vue";
import FleetReadout from "./FleetReadout.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
</script>

<template>
  <div class="space-y-8">
    <div v-if="!telemetryStats" class="space-y-8">
      <Skeleton class="h-64 w-full rounded-xl" />
      <div class="grid gap-4 lg:grid-cols-2">
        <Skeleton v-for="i in 2" :key="i" class="h-48 w-full rounded-lg" />
      </div>
    </div>

    <template v-else>
      <!-- One number leads the page, with its own 90-day shape beside it.
           Everything below is detail hung off these two. -->
      <section
        class="relative overflow-hidden rounded-xl border border-border/60 bg-card/40 [backdrop-filter:blur(6px)]"
      >
        <span aria-hidden="true" class="fleet-masthead-grid" />
        <span aria-hidden="true" class="fleet-masthead-glow" />

        <div
          class="relative grid gap-6 p-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8 lg:p-6"
        >
          <div class="flex flex-col justify-between gap-5">
            <div>
              <div
                class="font-sans text-[0.66rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                {{ $t("pages.system_telemetry.totals.matches") }}
              </div>
              <div class="mt-2 text-5xl font-semibold leading-none sm:text-6xl">
                {{ format(totals?.matches ?? 0) }}
              </div>
              <div class="mt-2.5 flex flex-wrap items-center gap-x-2 text-sm">
                <span class="font-mono text-[hsl(var(--tac-amber))]">
                  +{{ format(totals?.matchesWeek ?? 0) }}
                </span>
                <span class="text-muted-foreground">
                  {{ $t("pages.system_telemetry.totals.last_7d") }}
                </span>
                <span
                  v-if="mapsPerPlayer"
                  class="flex items-center gap-1 text-muted-foreground"
                >
                  <span class="text-border">·</span>
                  {{
                    $t("pages.system_telemetry.totals.maps_per_player", {
                      maps: mapsPerPlayer,
                    })
                  }}
                  <FiveStackToolTip>
                    {{
                      $t("pages.system_telemetry.totals.maps_per_player_hint")
                    }}
                  </FiveStackToolTip>
                </span>
              </div>
            </div>

            <div
              class="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border/60 pt-4"
            >
              <FleetReadout
                :label="$t('pages.system_telemetry.installs.online')"
                :value="telemetryStats?.online ?? 0"
                live
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.installs.total')"
                :value="telemetryStats?.installs?.total ?? 0"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.totals.players_played')"
                :value="totals?.playersPlayed ?? 0"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.totals.players_active')"
                :value="totals?.playersActive30d ?? 0"
              />
            </div>
          </div>

          <div class="flex min-w-0 flex-col">
            <div
              class="mb-2 font-sans text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              {{ $t("pages.system_telemetry.activity.matches") }}
            </div>
            <div class="h-52 min-w-0 lg:h-full lg:min-h-[13rem]">
              <FleetTelemetryChart
                v-if="activity.length"
                :labels="activityLabels"
                :values="activityMatches"
                :color="matchesColor"
                :label="$t('pages.system_telemetry.activity.matches_unit')"
              />
              <div
                v-else
                class="flex h-full items-center justify-center text-sm text-muted-foreground"
              >
                {{ $t("pages.system_telemetry.no_data") }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- PANELS -->
      <section class="space-y-3">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("pages.system_telemetry.installs.title") }}
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div
            class="flex flex-col justify-between gap-5 rounded-lg border border-border/60 bg-card/40 p-4"
          >
            <div>
              <div class="flex items-center gap-1.5 text-sm">
                {{ $t("pages.system_telemetry.installs.recency") }}
                <FiveStackToolTip>
                  {{ $t("pages.system_telemetry.installs.recency_hint") }}
                </FiveStackToolTip>
              </div>
              <div class="mt-4">
                <FleetMeter :segments="recencySegments" />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
              <FleetReadout
                :label="$t('pages.system_telemetry.installs.new_30d')"
                :value="installs?.new30d ?? 0"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.installs.retained_180d')"
                :value="installs?.retained180d ?? 0"
                :hint="$t('pages.system_telemetry.installs.retained_180d_hint')"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.installs.reporting')"
                :value="totals?.panels ?? 0"
                :hint="$t('pages.system_telemetry.installs.reporting_hint')"
              />
            </div>
          </div>

          <div class="rounded-lg border border-border/60 bg-card/40 p-4">
            <div class="text-sm">
              {{ $t("pages.system_telemetry.growth.title") }}
            </div>
            <div class="mt-3 h-44">
              <FleetTelemetryChart
                v-if="growth.length"
                type="bar"
                :labels="growthLabels"
                :values="growthValues"
                :color="installsColor"
                :label="$t('pages.system_telemetry.growth.unit')"
              />
              <div
                v-else
                class="flex h-full items-center justify-center text-sm text-muted-foreground"
              >
                {{ $t("pages.system_telemetry.no_data") }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CAPACITY -->
      <section class="space-y-3">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("pages.system_telemetry.totals.infrastructure") }}
          <FiveStackToolTip>
            {{ $t("pages.system_telemetry.totals.self_reported") }}
          </FiveStackToolTip>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div
            v-for="card of capacityCards"
            :key="card.key"
            class="flex flex-col gap-5 rounded-lg border border-border/60 bg-card/40 p-4"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <div
                  class="flex items-center gap-1 font-sans text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  {{ card.label }}
                  <FiveStackToolTip v-if="card.hint">
                    {{ card.hint }}
                  </FiveStackToolTip>
                </div>
                <div class="mt-1 text-3xl font-semibold leading-none">
                  {{ format(card.total) }}
                </div>
              </div>
              <div v-if="card.chips.length" class="flex gap-4 sm:gap-5">
                <FleetReadout
                  v-for="chip of card.chips"
                  :key="chip.label"
                  :label="chip.label"
                  :value="chip.value"
                />
              </div>
            </div>

            <FleetMeter :segments="card.segments" :subset="card.subset" />
          </div>
        </div>
      </section>

      <!-- MATCHES -->
      <section class="space-y-3">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("pages.system_telemetry.totals.match_volume") }}
          <FiveStackToolTip>
            {{ $t("pages.system_telemetry.totals.hosted_hint") }}
          </FiveStackToolTip>
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
          <div
            class="flex flex-col justify-between gap-4 rounded-lg border border-border/60 bg-card/40 p-4"
          >
            <div>
              <div class="text-sm">
                {{ $t("pages.system_telemetry.totals.hosted_windows") }}
              </div>
              <div class="mt-3">
                <FleetDistribution
                  bare
                  scale="max"
                  :items="matchWindows"
                  label-field="label"
                  value-field="value"
                  :color="matchesColor"
                />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
              <FleetReadout
                :label="$t('pages.system_telemetry.totals.maps_played')"
                :value="totals?.mapsPlayed ?? 0"
                :caption="$t('pages.system_telemetry.totals.all_time')"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.totals.matches_created')"
                :value="totals?.matchesCreated ?? 0"
                :caption="
                  $t('pages.system_telemetry.totals.matches_created_caption')
                "
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.totals.matches_live')"
                :value="totals?.matchesLive ?? 0"
                :caption="
                  $t('pages.system_telemetry.totals.matches_live_caption')
                "
                :unavailable="!outcomesReported"
                :hint="
                  outcomesReported
                    ? ''
                    : $t('pages.system_telemetry.totals.not_reported_hint')
                "
              />
            </div>
          </div>

          <div class="rounded-lg border border-border/60 bg-card/40 p-4">
            <div class="flex items-center gap-1.5 text-sm">
              {{ $t("pages.system_telemetry.composition.by_type") }}
              <FiveStackToolTip>
                {{ $t("pages.system_telemetry.composition.hint") }}
              </FiveStackToolTip>
            </div>
            <div class="mt-3">
              <FleetDistribution
                bare
                :items="matchTypes"
                label-field="type"
                value-field="matches"
                :color="matchesColor"
              />
            </div>
          </div>

          <div class="rounded-lg border border-border/60 bg-card/40 p-4">
            <div class="text-sm">
              {{ $t("pages.system_telemetry.composition.by_source") }}
            </div>
            <div class="mt-3">
              <FleetDistribution
                bare
                :items="matchSources"
                label-field="source"
                value-field="matches"
                :color="matchesColor"
              />
            </div>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-lg border border-border/60 bg-card/40 p-4">
            <div class="text-sm">
              {{ $t("pages.system_telemetry.totals.matches_imported") }}
            </div>
            <div class="mt-3">
              <FleetDistribution
                bare
                scale="max"
                :items="importedRows"
                label-field="label"
                value-field="value"
                :color="importedColor"
              />
            </div>
          </div>

          <div
            class="flex flex-col justify-between gap-4 rounded-lg border border-border/60 bg-card/40 p-4"
          >
            <div>
              <div class="flex items-center gap-1.5 text-sm">
                {{ $t("pages.system_telemetry.totals.completion") }}
                <FiveStackToolTip>
                  {{ $t("pages.system_telemetry.totals.completion_hint") }}
                </FiveStackToolTip>
              </div>

              <template v-if="outcomesReported">
                <div class="mt-2 text-3xl font-semibold leading-none">
                  {{ completionRate }}%
                </div>
                <div class="mt-4">
                  <FleetMeter :segments="outcomeSegments" />
                </div>
              </template>

              <div v-else class="mt-2">
                <div
                  class="text-3xl font-semibold leading-none text-muted-foreground"
                >
                  —
                </div>
                <p class="mt-2 text-[0.72rem] text-muted-foreground">
                  {{ $t("pages.system_telemetry.totals.not_reported_hint") }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- COMPETITION -->
      <section class="space-y-3">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("pages.system_telemetry.totals.competition") }}
          <FiveStackToolTip>
            {{ $t("pages.system_telemetry.totals.competition_hint") }}
          </FiveStackToolTip>
        </div>

        <div
          v-if="!competitionReported"
          class="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground"
        >
          {{ $t("pages.system_telemetry.totals.not_reported_hint") }}
        </div>

        <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="card of competitionCards"
            :key="card.key"
            class="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/40 p-4"
          >
            <div>
              <div
                class="font-sans text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ card.label }}
              </div>
              <div class="mt-1 text-3xl font-semibold leading-none">
                {{ format(card.total) }}
              </div>
            </div>

            <FleetMeter v-if="card.segments" :segments="card.segments" />

            <div class="mt-auto flex flex-wrap gap-x-5 gap-y-3">
              <FleetReadout
                v-for="chip of card.chips"
                :key="chip.label"
                :label="chip.label"
                :value="chip.value"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- COMMUNITY -->
      <section class="space-y-3">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("pages.system_telemetry.totals.community") }}
          <FiveStackToolTip>
            {{ $t("pages.system_telemetry.totals.community_hint") }}
          </FiveStackToolTip>
        </div>

        <div class="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div class="rounded-lg border border-border/60 bg-card/40 p-4">
            <div class="flex items-center gap-1.5 text-sm">
              {{ $t("pages.system_telemetry.totals.player_base") }}
              <FiveStackToolTip>
                {{ $t("pages.system_telemetry.totals.player_base_hint") }}
              </FiveStackToolTip>
            </div>
            <div class="mt-4">
              <FleetShares :rows="playerBase" />
            </div>
          </div>

          <div
            class="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/40 p-4"
          >
            <FleetReadout
              large
              :label="$t('pages.system_telemetry.totals.teams')"
              :value="totals?.teams ?? 0"
              :caption="$t('pages.system_telemetry.totals.all_time')"
            />
            <FleetReadout
              large
              :label="$t('pages.system_telemetry.totals.players_active_7d')"
              :value="totals?.playersActive7d ?? 0"
              :caption="$t('pages.system_telemetry.totals.last_7d')"
            />
          </div>
        </div>
      </section>

      <!-- FLEET DISTRIBUTION -->
      <section class="space-y-3">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("pages.system_telemetry.distribution.title") }}
          <FiveStackToolTip>
            {{ $t("pages.system_telemetry.distribution.hint") }}
          </FiveStackToolTip>
        </div>

        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div
            class="rounded-lg border border-border/60 bg-card/40 p-4 lg:col-span-2"
          >
            <FleetVersions :versions="telemetryStats?.versions ?? []" />
          </div>

          <div
            v-for="panel of distributions"
            :key="panel.key"
            class="rounded-lg border border-border/60 bg-card/40 p-4"
          >
            <div class="text-sm">{{ panel.title }}</div>
            <div class="mt-3">
              <FleetDistribution
                bare
                :items="panel.items"
                :label-field="panel.labelField"
                value-field="installs"
                :color="installsColor"
                :flags="panel.flags"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Split by what the flag actually is: an adoption rate for something
           nobody can switch reads as broken, and so does "0 panels using" for
           something nothing counts. -->
      <section
        v-for="group of featureGroups"
        :key="group.key"
        class="space-y-3"
      >
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ group.title }}
          <FiveStackToolTip>{{ group.hint }}</FiveStackToolTip>
        </div>

        <div
          class="overflow-x-auto rounded-lg border border-border/60 bg-card/40"
        >
          <table class="w-full min-w-[560px] text-sm">
            <thead>
              <tr
                class="border-b border-border/60 text-left font-sans text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                <th class="py-2.5 pl-4 pr-4 font-normal">
                  {{ $t("pages.system_telemetry.features.feature") }}
                </th>
                <th v-if="group.showFlag" class="py-2.5 pr-4 font-normal">
                  {{ group.flagLabel }}
                </th>
                <th class="py-2.5 pr-4 font-normal">
                  {{ $t("pages.system_telemetry.features.panels_using") }}
                </th>
                <th class="py-2.5 pr-4 text-right font-normal">
                  {{ $t("pages.system_telemetry.features.total") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="feature of group.features"
                :key="feature.key"
                class="border-b border-border/30 last:border-0"
              >
                <td class="py-2 pl-4 pr-4 font-medium">
                  {{ featureLabel(feature.key) }}
                </td>
                <td v-if="group.showFlag" class="py-2 pr-4">
                  <span class="flex items-center gap-2">
                    <span
                      class="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-border/60"
                    >
                      <span
                        class="block h-full rounded-full bg-[hsl(var(--tac-step-2))]"
                        :style="{
                          width: `${percent(feature.enabled, feature.flagged)}%`,
                        }"
                      />
                    </span>
                    <span class="font-mono tabular-nums text-muted-foreground">
                      {{ feature.enabled }}/{{ feature.flagged }}
                    </span>
                  </span>
                </td>
                <td class="py-2 pr-4">
                  <span v-if="!feature.counted" class="text-muted-foreground">
                    {{ NO_METRIC }}
                    <FiveStackToolTip>
                      {{ $t("pages.system_telemetry.features.no_metric_hint") }}
                    </FiveStackToolTip>
                  </span>
                  <span v-else class="flex items-center gap-2">
                    <span
                      class="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-border/60"
                    >
                      <span
                        class="block h-full rounded-full bg-muted-foreground/60"
                        :style="{
                          width: `${percent(feature.installsUsing, feature.counted)}%`,
                        }"
                      />
                    </span>
                    <span class="font-mono tabular-nums text-muted-foreground">
                      {{ feature.installsUsing }}/{{ feature.counted }}
                    </span>
                  </span>
                </td>
                <td class="py-2 pr-4 text-right font-mono tabular-nums">
                  <span v-if="!feature.counted" class="text-muted-foreground">
                    {{ NO_METRIC }}
                  </span>
                  <template v-else>{{ format(feature.total) }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* Faint survey grid, faded out from the top-left so the hero number sits on
   plain surface and the texture only shows at the edges. */
.fleet-masthead-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(hsl(var(--border) / 0.55) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--border) / 0.55) 1px, transparent 1px);
  background-size: 34px 34px;
  -webkit-mask-image: radial-gradient(
    120% 100% at 0% 0%,
    transparent 30%,
    black 100%
  );
  mask-image: radial-gradient(120% 100% at 0% 0%, transparent 30%, black 100%);
  pointer-events: none;
}

.fleet-masthead-glow {
  position: absolute;
  top: -40%;
  left: -10%;
  width: 40rem;
  height: 30rem;
  background: radial-gradient(
    closest-side,
    hsl(var(--tac-amber) / 0.12),
    transparent
  );
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .animate-ping {
    animation: none;
  }
}
</style>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import {
  FLEET_MATCHES_CHART_COLORS,
  FLEET_INSTALLS_CHART_COLORS,
} from "~/utilities/chartColors";

// A real em dash, not the entity: a mustache renders text, so "&mdash;" here
// would put those eight characters on the page.
const NO_METRIC = "—";

export default {
  apollo: {
    telemetryStats: {
      query: generateQuery({
        telemetryStats: {
          online: true,
          installs: {
            total: true,
            active24h: true,
            active7d: true,
            active30d: true,
            new30d: true,
            retained180d: true,
          },
          totals: {
            panels: true,
            gameServerNodes: true,
            gameServerNodesEnabled: true,
            gameServerNodesOnline: true,
            regions: true,
            gpuNodes: true,
            servers: true,
            serversEnabled: true,
            dedicatedServers: true,
            publicServers: true,
            matches: true,
            matchesCreated: true,
            matchesWeek: true,
            matchesMonth: true,
            matchesYear: true,
            outcomesReported: true,
            matchesFinished: true,
            matchesAbandoned: true,
            matchesLive: true,
            matchesTournament: true,
            matchesLeague: true,
            matchesScrim: true,
            matchesImported: true,
            matchesImportedMonth: true,
            matchesImportedYear: true,
            mapsPlayed: true,
            playersKnown: true,
            playersRegistered: true,
            playersPlayed: true,
            appearancesReported: true,
            playerAppearances: true,
            playersActive7d: true,
            playersActive30d: true,
            teams: true,
            competitionReported: true,
            tournaments: true,
            tournamentsFinished: true,
            tournamentTeams: true,
            leagueSeasons: true,
            leagueSeasonsFinished: true,
            leagueRegistrations: true,
            leagueTeams: true,
            scrimRequests: true,
            events: true,
            eventTeams: true,
          },
          features: {
            key: true,
            kind: true,
            enabled: true,
            flagged: true,
            reporting: true,
            counted: true,
            installsUsing: true,
            total: true,
          },
          matchTypes: {
            type: true,
            matches: true,
          },
          matchSources: {
            source: true,
            matches: true,
          },
          versions: {
            version: true,
            rank: true,
            since: true,
            installs: true,
          },
          runtimes: {
            runtime: true,
            installs: true,
          },
          countries: {
            country: true,
            installs: true,
          },
          growth: {
            month: true,
            installs: true,
          },
          activity: {
            day: true,
            installs: true,
            matches: true,
          },
        },
      }),
      pollInterval: 60 * 1000,
    },
  },
  data() {
    return {
      NO_METRIC,
    };
  },
  methods: {
    format(value: number) {
      return (value ?? 0).toLocaleString();
    },
    percent(value: number, total: number) {
      if (!total) {
        return 0;
      }

      return Math.round((value / total) * 100);
    },
    featureLabel(key: string) {
      const path = `pages.system_telemetry.features.keys.${key}`;

      // A panel on a newer build can report a feature this one has no name for.
      return this.$te(path) ? this.$t(path) : key;
    },
    step(index: number) {
      return `hsl(var(--tac-step-${index}))`;
    },
    // Bands cut out of nested counts. Fleet totals are sums over independently
    // reported payloads, and a panel on an older build still reports node
    // states that are not strictly nested, so each level is pinned to the one
    // above it before the differences are taken -- otherwise a band goes
    // negative or the segments overrun the bar.
    bands(levels) {
      let ceiling = Infinity;
      const clamped = levels.map((level) => {
        ceiling = Math.min(ceiling, Math.max(level.value ?? 0, 0));
        return { ...level, value: ceiling };
      });

      return clamped.map((level, index) => ({
        ...level,
        value: Math.max(level.value - (clamped[index + 1]?.value ?? 0), 0),
      }));
    },
  },
  computed: {
    matchesColor() {
      return FLEET_MATCHES_CHART_COLORS.at(0);
    },
    installsColor() {
      return FLEET_INSTALLS_CHART_COLORS.at(0);
    },
    importedColor() {
      return "hsl(var(--muted-foreground) / 0.7)";
    },
    totals() {
      return this.telemetryStats?.totals;
    },
    installs() {
      return this.telemetryStats?.installs;
    },
    outcomesReported() {
      return this.totals?.outcomesReported ?? 0;
    },
    features() {
      return this.telemetryStats?.features ?? [];
    },
    growth() {
      return this.telemetryStats?.growth ?? [];
    },
    activity() {
      return this.telemetryStats?.activity ?? [];
    },
    matchTypes() {
      return this.telemetryStats?.matchTypes ?? [];
    },
    matchSources() {
      return this.telemetryStats?.matchSources ?? [];
    },
    growthLabels() {
      return this.growth.map((point) => point.month);
    },
    growthValues() {
      return this.growth.map((point) => point.installs);
    },
    activityLabels() {
      return this.activity.map((point) => point.day);
    },
    activityMatches() {
      return this.activity.map((point) => point.matches);
    },
    // The install counts are nested (24h is inside 7d is inside 30d), so they
    // are cut into disjoint recency bands to be drawn as one bar. Panels that
    // reported within the hour come out of the freshest band rather than
    // adding to it, otherwise the segments sum past the install total.
    recencySegments() {
      const installs = this.installs;
      const online = Math.min(
        this.telemetryStats?.online ?? 0,
        installs?.active24h ?? 0,
      );
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.installs.${key}`);

      return this.bands([
        {
          label: t("dormant"),
          value: installs?.total ?? 0,
          color: "hsl(var(--muted-foreground) / 0.25)",
        },
        {
          label: t("active_30d"),
          value: installs?.active30d ?? 0,
          color: this.step(4),
        },
        {
          label: t("active_7d"),
          value: installs?.active7d ?? 0,
          color: this.step(3),
        },
        {
          label: t("seen_24h"),
          value: installs?.active24h ?? 0,
          color: this.step(2),
        },
        { label: t("online"), value: online, color: this.step(1) },
      ]).reverse();
    },
    capacityCards() {
      const totals = this.totals;
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.totals.${key}`);

      const nodesEnabled = totals?.gameServerNodesEnabled ?? 0;
      const nodesOnline = totals?.gameServerNodesOnline ?? 0;
      const servers = totals?.servers ?? 0;
      const dedicated = totals?.dedicatedServers ?? 0;

      return [
        {
          key: "nodes",
          label: t("game_server_nodes"),
          hint: t("nodes_hint"),
          // Enabled, not registered. A node an operator switched off is not
          // capacity, and on most panels the disabled ones outnumber the live
          // ones -- which left two thirds of this bar showing nothing usable.
          total: nodesEnabled,
          // Regions are not nodes, so they stay a plain readout; GPU is a
          // slice of the same enabled nodes and belongs inside the bar.
          chips: [{ label: t("regions"), value: totals?.regions ?? 0 }],
          subset: {
            label: t("gpu_nodes"),
            value: totals?.gpuNodes ?? 0,
            color: "hsl(var(--tac-subset))",
          },
          segments: this.bands([
            {
              label: t("nodes_offline"),
              value: nodesEnabled,
              color: this.step(3),
            },
            {
              label: t("nodes_online"),
              value: nodesOnline,
              color: this.step(1),
            },
          ]).reverse(),
        },
        {
          key: "servers",
          label: t("servers"),
          total: servers,
          // Enabled sits at 99% on any healthy fleet, so as a lane it is a
          // full-width line that says nothing -- it reads better as a number.
          // Public is the slice worth seeing, and it cuts across dedicated and
          // panel-managed alike rather than being a band of either.
          chips: [
            { label: t("servers_enabled"), value: totals?.serversEnabled ?? 0 },
          ],
          subset: {
            label: t("public_servers"),
            value: totals?.publicServers ?? 0,
            color: "hsl(var(--tac-subset))",
          },
          segments: this.bands([
            {
              label: t("servers_managed"),
              value: servers,
              color: this.step(3),
            },
            {
              label: t("dedicated_servers"),
              value: dedicated,
              color: this.step(1),
            },
          ]).reverse(),
        },
      ];
    },
    matchWindows() {
      const totals = this.totals;
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.totals.${key}`);

      return [
        { label: t("all_time"), value: totals?.matches ?? 0 },
        { label: t("last_1y"), value: totals?.matchesYear ?? 0 },
        { label: t("last_30d"), value: totals?.matchesMonth ?? 0 },
        { label: t("last_7d"), value: totals?.matchesWeek ?? 0 },
      ];
    },
    competitionReported() {
      return this.totals?.competitionReported ?? 0;
    },
    // How many maps the average player who has ever played turned up for. A
    // match count on its own cannot tell a busy community apart from a handful
    // of people playing a lot, which is the whole reason this is here.
    mapsPerPlayer() {
      if (!this.totals?.appearancesReported || !this.totals?.playersPlayed) {
        return null;
      }

      return (
        Math.round(
          (this.totals.playerAppearances / this.totals.playersPlayed) * 10,
        ) / 10
      );
    },
    competitionCards() {
      const totals = this.totals;
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.totals.${key}`);
      const finished = (label: string, done: number, all: number) =>
        this.bands([
          { label: t("ongoing"), value: all, color: this.step(4) },
          { label, value: done, color: this.step(1) },
        ]).reverse();

      return [
        {
          key: "tournaments",
          label: t("tournaments"),
          total: totals?.tournaments ?? 0,
          segments: finished(
            t("finished"),
            totals?.tournamentsFinished ?? 0,
            totals?.tournaments ?? 0,
          ),
          chips: [
            { label: t("matches"), value: totals?.matchesTournament ?? 0 },
            { label: t("teams_entered"), value: totals?.tournamentTeams ?? 0 },
          ],
        },
        {
          key: "leagues",
          label: t("league_seasons"),
          total: totals?.leagueSeasons ?? 0,
          segments: finished(
            t("finished"),
            totals?.leagueSeasonsFinished ?? 0,
            totals?.leagueSeasons ?? 0,
          ),
          chips: [
            { label: t("matches"), value: totals?.matchesLeague ?? 0 },
            {
              label: t("registrations"),
              value: totals?.leagueRegistrations ?? 0,
            },
            { label: t("league_teams"), value: totals?.leagueTeams ?? 0 },
          ],
        },
        {
          key: "scrims",
          label: t("scrim_requests"),
          total: totals?.scrimRequests ?? 0,
          segments: finished(
            t("played"),
            totals?.matchesScrim ?? 0,
            totals?.scrimRequests ?? 0,
          ),
          chips: [{ label: t("matches"), value: totals?.matchesScrim ?? 0 }],
        },
        {
          key: "events",
          label: t("events"),
          // Nothing marks an event finished, so there is no split to draw.
          total: totals?.events ?? 0,
          segments: null,
          chips: [
            { label: t("teams_entered"), value: totals?.eventTeams ?? 0 },
          ],
        },
      ];
    },
    importedRows() {
      const totals = this.totals;
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.totals.${key}`);

      return [
        { label: t("all_time"), value: totals?.matchesImported ?? 0 },
        { label: t("last_1y"), value: totals?.matchesImportedYear ?? 0 },
        { label: t("last_30d"), value: totals?.matchesImportedMonth ?? 0 },
      ];
    },
    outcomeSegments() {
      const totals = this.totals;
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.totals.${key}`);

      return [
        {
          label: t("matches_finished"),
          value: totals?.matchesFinished ?? 0,
          color: this.step(1),
        },
        {
          label: t("matches_abandoned"),
          value: totals?.matchesAbandoned ?? 0,
          color: "hsl(var(--muted-foreground) / 0.35)",
        },
      ];
    },
    completionRate() {
      const finished = this.totals?.matchesFinished ?? 0;
      const abandoned = this.totals?.matchesAbandoned ?? 0;
      const decided = finished + abandoned;

      return decided ? Math.round((finished / decided) * 100) : 0;
    },
    // Ordered by size, not by any pipeline: more steam ids have stats on a map
    // than have ever signed in, so drawing these as a funnel would show a stage
    // growing on the way down. Every row is a slice of the first, nothing more.
    playerBase() {
      const totals = this.totals;
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.totals.${key}`);

      return [
        {
          label: t("players_known"),
          value: totals?.playersKnown ?? 0,
          hint: t("players_known_caption"),
        },
        { label: t("players_played"), value: totals?.playersPlayed ?? 0 },
        {
          label: t("players"),
          value: totals?.playersRegistered ?? 0,
          hint: t("signed_in_caption"),
        },
        {
          label: t("players_active_30d"),
          value: totals?.playersActive30d ?? 0,
        },
        {
          label: t("players_active_7d"),
          value: totals?.playersActive7d ?? 0,
        },
      ];
    },
    distributions() {
      return [
        {
          key: "runtimes",
          title: this.$t("pages.system_telemetry.distribution.runtimes"),
          items: this.telemetryStats?.runtimes ?? [],
          labelField: "runtime",
          flags: false,
        },
        {
          key: "countries",
          title: this.$t("pages.system_telemetry.distribution.countries"),
          items: this.telemetryStats?.countries ?? [],
          labelField: "country",
          flags: true,
        },
      ];
    },
    featureGroups() {
      const buckets = {
        setting: [],
        detected: [],
        always: [],
      };

      for (const feature of this.features) {
        // The server classifies; the fallback only covers a response from
        // before it did.
        const kind =
          feature.kind ?? (feature.flagged > 0 ? "setting" : "always");

        (buckets[kind] ?? buckets.always).push(feature);
      }

      return [
        {
          key: "optional",
          title: this.$t("pages.system_telemetry.features.optional"),
          hint: this.$t("pages.system_telemetry.features.optional_hint"),
          flagLabel: this.$t("pages.system_telemetry.features.enabled"),
          showFlag: true,
          features: buckets.setting,
        },
        {
          key: "capabilities",
          title: this.$t("pages.system_telemetry.features.capabilities"),
          hint: this.$t("pages.system_telemetry.features.capabilities_hint"),
          flagLabel: this.$t("pages.system_telemetry.features.configured"),
          showFlag: true,
          features: buckets.detected,
        },
        {
          key: "always",
          title: this.$t("pages.system_telemetry.features.always"),
          hint: this.$t("pages.system_telemetry.features.always_hint"),
          showFlag: false,
          features: buckets.always,
        },
      ].filter((group) => group.features.length > 0);
    },
  },
};
</script>
