<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import FleetTelemetryChart from "./FleetTelemetryChart.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
</script>

<template>
  <div class="space-y-8 [--tac-clip:14px] [--tac-clip-sm:10px]">
    <div v-if="!telemetryStats" class="space-y-8">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Skeleton v-for="i in 6" :key="i" class="h-20 w-full" />
      </div>
      <Skeleton class="h-64 w-full" />
    </div>

    <template v-else>
      <section class="space-y-4">
        <header
          class="flex items-center gap-3 border-b border-border/60 pb-3"
        >
          <span class="inline-block h-[2px] w-[14px] bg-[hsl(var(--tac-amber))]" />
          <h2 class="font-sans text-lg font-bold uppercase tracking-[0.08em]">
            {{ $t("pages.system_telemetry.installs.title") }}
          </h2>
        </header>

        <div class="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <div
            v-for="stat of installStats"
            :key="stat.label"
            class="rounded-lg border border-border/60 bg-card/40 p-3"
          >
            <div
              class="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
            >
              {{ stat.label }}
              <FiveStackToolTip v-if="stat.hint">
                {{ stat.hint }}
              </FiveStackToolTip>
            </div>
            <div class="mt-1 text-2xl font-bold tabular-nums">
              {{ format(stat.value) }}
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <header
          class="flex items-center gap-3 border-b border-border/60 pb-3"
        >
          <span class="inline-block h-[2px] w-[14px] bg-[hsl(var(--tac-amber))]" />
          <h2
            class="flex items-center gap-2 font-sans text-lg font-bold uppercase tracking-[0.08em]"
          >
            {{ $t("pages.system_telemetry.totals.title") }}
            <span
              class="font-mono text-xs font-normal tracking-[0.15em] text-[hsl(var(--tac-amber))]"
            >
              [ {{ $t("pages.system_telemetry.totals.window") }} ]
            </span>
            <FiveStackToolTip>
              {{ $t("pages.system_telemetry.totals.self_reported") }}
            </FiveStackToolTip>
          </h2>
        </header>

        <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <div
            v-for="stat of fleetStats"
            :key="stat.label"
            class="rounded-lg border border-border/60 bg-card/40 p-3"
          >
            <div
              class="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
            >
              {{ stat.label }}
            </div>
            <div class="mt-1 text-2xl font-bold tabular-nums">
              {{ format(stat.value) }}
            </div>
          </div>
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-3">
          <h3
            class="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground"
          >
            {{ $t("pages.system_telemetry.activity.matches") }}
          </h3>
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
          <h3
            class="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground"
          >
            {{ $t("pages.system_telemetry.growth.title") }}
          </h3>
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

      <section class="space-y-4">
        <header
          class="flex items-center gap-3 border-b border-border/60 pb-3"
        >
          <span class="inline-block h-[2px] w-[14px] bg-[hsl(var(--tac-amber))]" />
          <h2 class="font-sans text-lg font-bold uppercase tracking-[0.08em]">
            {{ $t("pages.system_telemetry.features.title") }}
          </h2>
        </header>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[640px] text-sm">
            <thead>
              <tr
                class="border-b border-border/60 text-left font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
              >
                <th class="py-2 pr-4">
                  {{ $t("pages.system_telemetry.features.feature") }}
                </th>
                <th class="py-2 pr-4">
                  {{ $t("pages.system_telemetry.features.enabled") }}
                </th>
                <th class="py-2 pr-4">
                  {{ $t("pages.system_telemetry.features.using") }}
                </th>
                <th class="py-2 pr-4 text-right">
                  {{ $t("pages.system_telemetry.features.records") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="feature of features"
                :key="feature.key"
                class="border-b border-border/30"
              >
                <td class="py-2 pr-4 font-medium">
                  {{ featureLabel(feature.key) }}
                </td>
                <td class="py-2 pr-4">
                  <span v-if="feature.enabled === null" class="text-muted-foreground">
                    &mdash;
                  </span>
                  <span v-else class="flex items-center gap-2">
                    <span class="h-1.5 w-24 overflow-hidden rounded-full bg-border/60">
                      <span
                        class="block h-full rounded-full bg-[hsl(var(--tac-amber))]"
                        :style="{ width: `${percent(feature.enabled, feature.reporting)}%` }"
                      />
                    </span>
                    <span class="tabular-nums text-muted-foreground">
                      {{ feature.enabled }} / {{ feature.reporting }}
                    </span>
                  </span>
                </td>
                <td class="py-2 pr-4 tabular-nums text-muted-foreground">
                  {{ feature.installsUsing }} / {{ feature.reporting }}
                </td>
                <td class="py-2 pr-4 text-right tabular-nums">
                  {{ format(feature.total) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="versions.length" class="space-y-4">
        <header
          class="flex items-center gap-3 border-b border-border/60 pb-3"
        >
          <span class="inline-block h-[2px] w-[14px] bg-[hsl(var(--tac-amber))]" />
          <h2 class="font-sans text-lg font-bold uppercase tracking-[0.08em]">
            {{ $t("pages.system_telemetry.versions.title") }}
          </h2>
        </header>

        <div class="flex flex-wrap gap-2">
          <Badge
            v-for="version of versions"
            :key="version.version"
            variant="outline"
            class="gap-2 font-mono text-xs"
          >
            {{ shortVersion(version.version) }}
            <span class="text-muted-foreground">{{ version.installs }}</span>
          </Badge>
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
            gameServerNodes: true,
            servers: true,
            dedicatedServers: true,
            publicServers: true,
            serverCapacity: true,
            matches: true,
            matchesWeek: true,
            matchesMonth: true,
            matchesYear: true,
            mapsPlayed: true,
            playersRegistered: true,
            playersActive30d: true,
            teams: true,
          },
          features: {
            key: true,
            enabled: true,
            reporting: true,
            installsUsing: true,
            total: true,
          },
          versions: {
            version: true,
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
    shortVersion(version: string) {
      if (version === "unknown") {
        return this.$t("pages.system_telemetry.versions.unknown");
      }

      return version.slice(0, 7);
    },
    featureLabel(key: string) {
      return this.$t(`pages.system_telemetry.features.keys.${key}`);
    },
  },
  computed: {
    matchesColor() {
      return FLEET_MATCHES_CHART_COLORS.at(0);
    },
    installsColor() {
      return FLEET_INSTALLS_CHART_COLORS.at(0);
    },
    features() {
      return this.telemetryStats?.features ?? [];
    },
    versions() {
      return this.telemetryStats?.versions ?? [];
    },
    growth() {
      return this.telemetryStats?.growth ?? [];
    },
    activity() {
      return this.telemetryStats?.activity ?? [];
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
    installStats() {
      const installs = this.telemetryStats?.installs;

      return [
        {
          label: this.$t("pages.system_telemetry.installs.online"),
          value: this.telemetryStats?.online ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.installs.total"),
          value: installs?.total ?? 0,
          hint: this.$t("pages.system_telemetry.installs.total_hint"),
        },
        {
          label: this.$t("pages.system_telemetry.installs.active_24h"),
          value: installs?.active24h ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.installs.active_7d"),
          value: installs?.active7d ?? 0,
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
      ];
    },
    fleetStats() {
      const totals = this.telemetryStats?.totals;

      return [
        {
          label: this.$t("pages.system_telemetry.totals.game_server_nodes"),
          value: totals?.gameServerNodes ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.servers"),
          value: totals?.servers ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.dedicated_servers"),
          value: totals?.dedicatedServers ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.public_servers"),
          value: totals?.publicServers ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.capacity"),
          value: totals?.serverCapacity ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.matches_week"),
          value: totals?.matchesWeek ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.matches_month"),
          value: totals?.matchesMonth ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.matches_year"),
          value: totals?.matchesYear ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.matches"),
          value: totals?.matches ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.maps_played"),
          value: totals?.mapsPlayed ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.players"),
          value: totals?.playersRegistered ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.players_active"),
          value: totals?.playersActive30d ?? 0,
        },
        {
          label: this.$t("pages.system_telemetry.totals.teams"),
          value: totals?.teams ?? 0,
        },
      ];
    },
  },
};
</script>
