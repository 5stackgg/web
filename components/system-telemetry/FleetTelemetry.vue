<script setup lang="ts">
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import FleetTelemetryChart from "./FleetTelemetryChart.vue";
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

        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
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
              class="font-sans text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              {{ stat.label }}
            </div>
            <div class="mt-1 text-xl font-semibold tabular-nums">
              {{ format(stat.value) }}
            </div>
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

      <!-- Split by whether the feature actually has a switch: showing an
           "enabled" ratio for something nobody can turn off reads as broken. -->
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
                  <span class="flex items-center gap-2">
                    <span
                      class="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-border/60"
                    >
                      <span
                        class="block h-full rounded-full bg-muted-foreground/60"
                        :style="{
                          width: `${percent(feature.installsUsing, feature.reporting)}%`,
                        }"
                      />
                    </span>
                    <span class="tabular-nums text-muted-foreground">
                      {{ feature.installsUsing }} / {{ feature.reporting }}
                    </span>
                  </span>
                </td>
                <td class="py-2.5 text-right tabular-nums">
                  {{ feature.total ? format(feature.total) : "&mdash;" }}
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

// Reported through the same `supports_*` settings as the toggles, but an admin
// cannot switch these on — detectFeatures() derives them from whether the
// Discord / Tailscale / Steam credentials are configured.
const CAPABILITY_KEYS = [
  "discord_bot",
  "game_server_nodes",
  "version_pinning",
];

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
            gpuNodes: true,
            servers: true,
            dedicatedServers: true,
            publicServers: true,
            serverCapacity: true,
            matches: true,
            matchesWeek: true,
            matchesMonth: true,
            matchesYear: true,
            matchesImported: true,
            matchesImportedMonth: true,
            mapsPlayed: true,
            playersRegistered: true,
            playersActive30d: true,
            teams: true,
          },
          features: {
            key: true,
            enabled: true,
            flagged: true,
            reporting: true,
            installsUsing: true,
            total: true,
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
    featureGroups() {
      const optional = [];
      const capabilities = [];
      const always = [];

      for (const feature of this.features) {
        if (CAPABILITY_KEYS.includes(feature.key)) {
          capabilities.push(feature);
          continue;
        }

        // flagged counts panels that reported a real boolean. Zero means the
        // feature ships with no switch at all, not that everyone disabled it.
        if (feature.flagged > 0) {
          optional.push(feature);
          continue;
        }

        always.push(feature);
      }

      return [
        {
          key: "optional",
          title: this.$t("pages.system_telemetry.features.optional"),
          hint: this.$t("pages.system_telemetry.features.optional_hint"),
          flagLabel: this.$t("pages.system_telemetry.features.enabled"),
          showFlag: true,
          features: optional,
        },
        {
          key: "capabilities",
          title: this.$t("pages.system_telemetry.features.capabilities"),
          hint: this.$t("pages.system_telemetry.features.capabilities_hint"),
          flagLabel: this.$t("pages.system_telemetry.features.configured"),
          showFlag: true,
          features: capabilities,
        },
        {
          key: "always",
          title: this.$t("pages.system_telemetry.features.always"),
          hint: this.$t("pages.system_telemetry.features.always_hint"),
          showFlag: false,
          features: always,
        },
      ].filter((group) => group.features.length > 0);
    },
    headlineStats() {
      const installs = this.telemetryStats?.installs;
      const totals = this.telemetryStats?.totals;

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
          value: totals?.matches ?? 0,
          caption: this.$t("pages.system_telemetry.totals.matches_caption"),
        },
        {
          label: this.$t("pages.system_telemetry.totals.players_active"),
          value: totals?.playersActive30d ?? 0,
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
    fleetGroups() {
      const totals = this.telemetryStats?.totals;

      return [
        {
          title: this.$t("pages.system_telemetry.totals.infrastructure"),
          hint: this.$t("pages.system_telemetry.totals.self_reported"),
          stats: [
            {
              label: this.$t("pages.system_telemetry.totals.game_server_nodes"),
              value: totals?.gameServerNodes ?? 0,
            },
            {
              label: this.$t("pages.system_telemetry.totals.gpu_nodes"),
              value: totals?.gpuNodes ?? 0,
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
          ],
        },
        {
          title: this.$t("pages.system_telemetry.totals.match_volume"),
          hint: this.$t("pages.system_telemetry.totals.hosted_hint"),
          stats: [
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
              label: this.$t("pages.system_telemetry.totals.maps_played"),
              value: totals?.mapsPlayed ?? 0,
            },
            {
              label: this.$t("pages.system_telemetry.totals.matches_imported"),
              value: totals?.matchesImported ?? 0,
              muted: true,
            },
            {
              label: this.$t(
                "pages.system_telemetry.totals.matches_imported_month",
              ),
              value: totals?.matchesImportedMonth ?? 0,
              muted: true,
            },
          ],
        },
        {
          title: this.$t("pages.system_telemetry.totals.community"),
          stats: [
            {
              label: this.$t("pages.system_telemetry.totals.players"),
              value: totals?.playersRegistered ?? 0,
            },
            {
              label: this.$t("pages.system_telemetry.totals.teams"),
              value: totals?.teams ?? 0,
            },
          ],
        },
      ];
    },
  },
};
</script>
