<script setup lang="ts">
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import FleetTelemetryChart from "./FleetTelemetryChart.vue";
import FleetDistribution from "./FleetDistribution.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
</script>

<template>
  <div class="space-y-10">
    <div v-if="!telemetryStats" class="space-y-8">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton v-for="i in 4" :key="i" class="h-28 w-full" />
      </div>
      <Skeleton class="h-64 w-full" />
    </div>

    <template v-else>
      <!-- The four numbers the whole page exists to answer. -->
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div
          v-for="stat of headlineStats"
          :key="stat.label"
          class="relative overflow-hidden rounded-lg border border-border/60 bg-card/40 p-4 [backdrop-filter:blur(6px)]"
          :class="stat.live ? 'border-[hsl(var(--tac-amber)/0.45)]' : ''"
        >
          <span
            v-if="stat.live"
            class="absolute right-4 top-4 flex h-2 w-2"
            :title="$t('pages.system_telemetry.installs.live')"
          >
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--tac-amber))] opacity-60"
            />
            <span
              class="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--tac-amber))]"
            />
          </span>

          <div
            class="font-sans text-[0.66rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ stat.label }}
          </div>
          <div
            class="mt-2 text-4xl font-bold leading-none tabular-nums"
            :class="stat.live ? 'text-[hsl(var(--tac-amber))]' : ''"
          >
            {{ format(stat.value) }}
          </div>
          <div class="mt-1 text-xs text-muted-foreground">
            {{ stat.caption }}
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("pages.system_telemetry.installs.title") }}
        </div>

        <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div
            v-for="stat of installStats"
            :key="stat.label"
            class="rounded-lg border border-border/60 bg-card/40 px-3 py-2.5"
          >
            <div
              class="flex items-center gap-1 font-sans text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              {{ stat.label }}
              <FiveStackToolTip v-if="stat.hint">
                {{ stat.hint }}
              </FiveStackToolTip>
            </div>
            <div class="mt-1 text-xl font-semibold tabular-nums">
              {{ format(stat.value) }}
            </div>
          </div>
        </div>
      </section>

      <section
        v-for="group of fleetGroups"
        :key="group.title"
        class="space-y-3"
      >
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ group.title }}
          <FiveStackToolTip v-if="group.hint">
            {{ group.hint }}
          </FiveStackToolTip>
        </div>

        <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div
            v-for="stat of group.stats"
            :key="stat.label"
            class="rounded-lg border border-border/60 bg-card/40 px-3 py-2.5"
            :class="stat.muted ? 'opacity-70' : ''"
          >
            <div
              class="flex items-center gap-1 font-sans text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              {{ stat.label }}
              <FiveStackToolTip v-if="stat.unavailable">
                {{ $t("pages.system_telemetry.totals.not_reported_hint") }}
              </FiveStackToolTip>
            </div>
            <div
              class="mt-1 text-xl font-semibold tabular-nums"
              :class="stat.unavailable ? 'text-muted-foreground' : ''"
            >
              {{ stat.unavailable ? NO_METRIC : format(stat.value) }}
            </div>
            <div class="mt-0.5 text-[0.68rem] text-muted-foreground">
              {{
                stat.unavailable
                  ? $t("pages.system_telemetry.totals.not_reported")
                  : stat.caption
              }}
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("pages.system_telemetry.composition.title") }}
          <FiveStackToolTip>
            {{ $t("pages.system_telemetry.composition.hint") }}
          </FiveStackToolTip>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="space-y-2">
            <div class="text-xs text-muted-foreground">
              {{ $t("pages.system_telemetry.composition.by_type") }}
            </div>
            <FleetDistribution
              :items="matchTypes"
              label-field="type"
              value-field="matches"
              :color="matchesColor"
            />
          </div>

          <div class="space-y-2">
            <div class="text-xs text-muted-foreground">
              {{ $t("pages.system_telemetry.composition.by_source") }}
            </div>
            <FleetDistribution
              :items="matchSources"
              label-field="source"
              value-field="matches"
              :color="matchesColor"
            />
          </div>
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-3">
          <div :class="tacticalSectionLabelClasses">
            <span :class="tacticalSectionTickClasses" />
            {{ $t("pages.system_telemetry.activity.matches") }}
          </div>
          <div class="h-64 rounded-lg border border-border/60 bg-card/40 p-3">
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

        <div class="space-y-3">
          <div :class="tacticalSectionLabelClasses">
            <span :class="tacticalSectionTickClasses" />
            {{ $t("pages.system_telemetry.growth.title") }}
          </div>
          <div class="h-64 rounded-lg border border-border/60 bg-card/40 p-3">
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
      </section>

      <section class="space-y-3">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("pages.system_telemetry.distribution.title") }}
          <FiveStackToolTip>
            {{ $t("pages.system_telemetry.distribution.hint") }}
          </FiveStackToolTip>
        </div>

        <div class="grid gap-3 md:grid-cols-3">
          <div
            v-for="panel of distributions"
            :key="panel.key"
            class="space-y-2"
          >
            <div class="text-xs text-muted-foreground">{{ panel.title }}</div>
            <FleetDistribution
              :items="panel.items"
              :label-field="panel.labelField"
              value-field="installs"
              :color="installsColor"
              :flags="panel.flags"
            />
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

        <div class="overflow-x-auto">
          <table class="w-full min-w-[560px] text-sm">
            <thead>
              <tr
                class="border-b border-border/60 text-left font-sans text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                <th class="py-2 pr-4 font-normal">
                  {{ $t("pages.system_telemetry.features.feature") }}
                </th>
                <th v-if="group.showFlag" class="py-2 pr-4 font-normal">
                  {{ group.flagLabel }}
                </th>
                <th class="py-2 pr-4 font-normal">
                  {{ $t("pages.system_telemetry.features.panels_using") }}
                </th>
                <th class="py-2 text-right font-normal">
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
                <td class="py-2.5 pr-4 font-medium">
                  {{ featureLabel(feature.key) }}
                </td>
                <td v-if="group.showFlag" class="py-2.5 pr-4">
                  <span class="flex items-center gap-2">
                    <span
                      class="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-border/60"
                    >
                      <span
                        class="block h-full rounded-full bg-[hsl(var(--tac-amber))]"
                        :style="{
                          width: `${percent(feature.enabled, feature.flagged)}%`,
                        }"
                      />
                    </span>
                    <span class="tabular-nums text-muted-foreground">
                      {{ feature.enabled }} / {{ feature.flagged }}
                    </span>
                  </span>
                </td>
                <td class="py-2.5 pr-4">
                  <span v-if="!feature.counted" class="text-muted-foreground">
                    {{ NO_METRIC }}
                    <FiveStackToolTip>
                      {{ $t("pages.system_telemetry.features.no_metric_hint") }}
                    </FiveStackToolTip>
                  </span>
                  <span v-else class="flex items-center gap-2">
                    <span
                      class="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-border/60"
                    >
                      <span
                        class="block h-full rounded-full bg-muted-foreground/60"
                        :style="{
                          width: `${percent(feature.installsUsing, feature.counted)}%`,
                        }"
                      />
                    </span>
                    <span class="tabular-nums text-muted-foreground">
                      {{ feature.installsUsing }} / {{ feature.counted }}
                    </span>
                  </span>
                </td>
                <td class="py-2.5 text-right tabular-nums">
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
            playersActive7d: true,
            playersActive30d: true,
            teams: true,
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
  },
  computed: {
    matchesColor() {
      return FLEET_MATCHES_CHART_COLORS.at(0);
    },
    installsColor() {
      return FLEET_INSTALLS_CHART_COLORS.at(0);
    },
    totals() {
      return this.telemetryStats?.totals;
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
    distributions() {
      return [
        {
          key: "versions",
          title: this.$t("pages.system_telemetry.distribution.versions"),
          items: this.telemetryStats?.versions ?? [],
          labelField: "version",
          flags: false,
        },
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
    headlineStats() {
      const installs = this.telemetryStats?.installs;

      return [
        {
          label: this.$t("pages.system_telemetry.installs.online"),
          value: this.telemetryStats?.online ?? 0,
          caption: this.$t("pages.system_telemetry.installs.online_caption"),
          live: true,
        },
        {
          label: this.$t("pages.system_telemetry.installs.total"),
          value: installs?.total ?? 0,
          caption: this.$t("pages.system_telemetry.installs.total_caption"),
        },
        {
          label: this.$t("pages.system_telemetry.totals.matches"),
          value: this.totals?.matches ?? 0,
          caption: this.$t("pages.system_telemetry.totals.matches_caption"),
        },
        {
          label: this.$t("pages.system_telemetry.totals.players_active"),
          value: this.totals?.playersActive30d ?? 0,
          caption: this.$t("pages.system_telemetry.totals.players_caption"),
        },
      ];
    },
    installStats() {
      const installs = this.telemetryStats?.installs;

      return [
        {
          label: this.$t("pages.system_telemetry.installs.active_24h"),
          value: installs?.active24h ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.installs.active_7d"),
          value: installs?.active7d ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.installs.active_30d"),
          value: installs?.active30d ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.installs.new_30d"),
          value: installs?.new30d ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.installs.retained_180d"),
          value: installs?.retained180d ?? 0,
          hint: this.$t("pages.system_telemetry.installs.retained_180d_hint"),
        },
        {
          label: this.$t("pages.system_telemetry.installs.reporting"),
          value: this.totals?.panels ?? 0,
          hint: this.$t("pages.system_telemetry.installs.reporting_hint"),
        },
      ];
    },
    fleetGroups() {
      const totals = this.totals;
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.totals.${key}`);
      // Match outcomes arrived after most panels' builds. Summing a field
      // nobody sends gives a confident zero, so hide it until somebody does.
      const outcomes = totals?.outcomesReported ?? 0;

      return [
        {
          title: t("infrastructure"),
          hint: t("self_reported"),
          stats: [
            {
              label: t("game_server_nodes"),
              caption: t("game_server_nodes_caption"),
              value: totals?.gameServerNodes ?? 0,
            },
            {
              label: t("nodes_enabled"),
              caption: t("nodes_enabled_caption"),
              value: totals?.gameServerNodesEnabled ?? 0,
            },
            {
              label: t("nodes_online"),
              caption: t("nodes_online_caption"),
              value: totals?.gameServerNodesOnline ?? 0,
            },
            {
              label: t("regions"),
              caption: t("regions_caption"),
              value: totals?.regions ?? 0,
            },
            {
              label: t("gpu_nodes"),
              caption: t("gpu_nodes_caption"),
              value: totals?.gpuNodes ?? 0,
            },
            {
              label: t("servers"),
              caption: t("servers_caption"),
              value: totals?.servers ?? 0,
            },
            {
              label: t("servers_enabled"),
              caption: t("servers_enabled_caption"),
              value: totals?.serversEnabled ?? 0,
            },
            {
              label: t("dedicated_servers"),
              caption: t("dedicated_servers_caption"),
              value: totals?.dedicatedServers ?? 0,
            },
            {
              label: t("public_servers"),
              caption: t("public_servers_caption"),
              value: totals?.publicServers ?? 0,
            },
          ],
        },
        {
          title: t("match_volume"),
          hint: t("hosted_hint"),
          stats: [
            {
              label: t("matches_week"),
              caption: t("last_7d"),
              value: totals?.matchesWeek ?? 0,
            },
            {
              label: t("matches_month"),
              caption: t("last_30d"),
              value: totals?.matchesMonth ?? 0,
            },
            {
              label: t("matches_year"),
              caption: t("last_1y"),
              value: totals?.matchesYear ?? 0,
            },
            {
              label: t("maps_played"),
              caption: t("all_time"),
              value: totals?.mapsPlayed ?? 0,
            },
            {
              label: t("matches_live"),
              caption: t("matches_live_caption"),
              value: totals?.matchesLive ?? 0,
              unavailable: !outcomes,
            },
            {
              label: t("matches_finished"),
              caption: t("matches_finished_caption"),
              value: totals?.matchesFinished ?? 0,
              unavailable: !outcomes,
            },
            {
              label: t("matches_abandoned"),
              caption: t("matches_abandoned_caption"),
              value: totals?.matchesAbandoned ?? 0,
              unavailable: !outcomes,
            },
            {
              label: t("matches_created"),
              caption: t("matches_created_caption"),
              value: totals?.matchesCreated ?? 0,
              muted: true,
            },
          ],
        },
        {
          title: t("competition"),
          hint: t("competition_hint"),
          stats: [
            {
              label: t("matches_tournament"),
              caption: t("all_time"),
              value: totals?.matchesTournament ?? 0,
            },
            {
              label: t("matches_league"),
              caption: t("all_time"),
              value: totals?.matchesLeague ?? 0,
            },
            {
              label: t("matches_scrim"),
              caption: t("all_time"),
              value: totals?.matchesScrim ?? 0,
            },
            {
              label: t("matches_imported"),
              caption: t("all_time"),
              value: totals?.matchesImported ?? 0,
              muted: true,
            },
            {
              label: t("matches_imported_year"),
              caption: t("last_1y"),
              value: totals?.matchesImportedYear ?? 0,
              muted: true,
            },
            {
              label: t("matches_imported_month"),
              caption: t("last_30d"),
              value: totals?.matchesImportedMonth ?? 0,
              muted: true,
            },
          ],
        },
        {
          title: t("community"),
          hint: t("community_hint"),
          stats: [
            {
              label: t("players"),
              caption: t("signed_in_caption"),
              value: totals?.playersRegistered ?? 0,
            },
            {
              label: t("players_played"),
              caption: t("all_time"),
              value: totals?.playersPlayed ?? 0,
            },
            {
              label: t("players_active_7d"),
              caption: t("last_7d"),
              value: totals?.playersActive7d ?? 0,
            },
            {
              label: t("players_active_30d"),
              caption: t("last_30d"),
              value: totals?.playersActive30d ?? 0,
            },
            {
              label: t("teams"),
              caption: t("all_time"),
              value: totals?.teams ?? 0,
            },
            {
              label: t("players_known"),
              caption: t("players_known_caption"),
              value: totals?.playersKnown ?? 0,
              muted: true,
            },
          ],
        },
      ];
    },
  },
};
</script>
