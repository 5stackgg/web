<script setup lang="ts">
import { ChevronDown, List } from "lucide-vue-next";
import Skeleton from "~/components/ui/skeleton/Skeleton.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import FleetTelemetryChart from "./FleetTelemetryChart.vue";
import FleetDistribution from "./FleetDistribution.vue";
import FleetVersions from "./FleetVersions.vue";
import FleetMeter from "./FleetMeter.vue";
import FleetShares from "./FleetShares.vue";
import FleetReadout from "./FleetReadout.vue";
import FleetSection from "./FleetSection.vue";
import FleetCount from "./FleetCount.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import LiveStamp from "~/components/admin/LiveStamp.vue";
import StatTile from "~/components/admin/StatTile.vue";
import { TONE_TEXT } from "~/components/admin/tone";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

// Stat tiles and chart cards are the only frames on the page; sections are
// split by hairlines.
const card =
  "flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card/40 p-4";
const cardTitle = "flex items-center gap-1.5 text-[13.5px] font-semibold";
// What hangs under a stat tile's number: its bar, then its readouts.
const tileBody = "mt-2 grid gap-4 text-foreground";
const cardChips =
  "flex flex-wrap gap-x-6 gap-y-3 border-t border-border/60 pt-3.5";
const delta = "font-semibold tabular-nums";
</script>

<template>
  <div class="grid gap-7">
    <!-- 5stack.gg reports like any other panel, and it is the largest install
         on the page. Setting it aside is the only view that answers what
         everybody else is running. -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <AnimatedFilters
        v-if="telemetryStats"
        v-model="fleetFilter"
        square
        :options="fleetFilterOptions"
      />
      <LiveStamp v-if="updatedAt" :at="updatedAt" live :every="60_000" />
      <span class="grow" />
      <DropdownMenu v-if="telemetryStats">
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm">
            <List />
            {{ $t("pages.system_telemetry.jump_to") }}
            <ChevronDown class="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          class="w-52"
          @close-auto-focus="onJumpMenuClosed"
        >
          <DropdownMenuItem
            v-for="section of jumpSections"
            :key="section.id"
            @select="pendingJump = section.id"
          >
            {{ section.label }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <FadeSwap>
      <div
        v-if="!telemetryStats"
        key="loading"
        class="grid gap-7"
        aria-busy="true"
      >
        <Skeleton class="h-60 w-full rounded-lg" />
        <div class="grid gap-3 lg:grid-cols-2">
          <Skeleton v-for="i in 2" :key="i" class="h-48 w-full rounded-lg" />
        </div>
      </div>

      <div
        v-else
        key="report"
        class="grid gap-8 transition-opacity motion-reduce:transition-none"
        :class="
          switching
            ? 'opacity-45 [transition-duration:110ms] ease-in'
            : '[transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]'
        "
        :aria-busy="switching"
      >
        <!-- One number leads the page, with its own 90-day shape beside it.
             Everything below is detail hung off these two. -->
        <section
          class="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
        >
          <div>
            <div
              class="flex items-center gap-1 text-[12.5px] text-muted-foreground"
            >
              {{ $t("pages.system_telemetry.totals.maps_played") }}
              <FiveStackToolTip>
                <span class="block max-w-[20rem]">
                  {{ $t("pages.system_telemetry.totals.hosted_hint") }}
                </span>
              </FiveStackToolTip>
            </div>
            <div
              class="mt-2 text-5xl font-bold leading-none tracking-tight tabular-nums sm:text-[3.5rem]"
            >
              {{ format(totals?.mapsPlayed ?? 0) }}
            </div>
            <div
              class="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13.5px] text-muted-foreground"
            >
              <span>
                <span class="font-semibold tabular-nums text-foreground">
                  {{ format(totals?.matches ?? 0) }}
                </span>
                {{ $t("pages.system_telemetry.activity.matches_unit") }}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <span :class="[delta, TONE_TEXT.amber]">
                  +{{ format(totals?.matchesWeek ?? 0) }}
                </span>
                {{ $t("pages.system_telemetry.totals.last_7d") }}
              </span>
              <template v-if="mapsPerPlayer">
                <span aria-hidden="true">·</span>
                <span class="inline-flex items-center gap-1">
                  {{
                    $t("pages.system_telemetry.totals.maps_per_player", {
                      maps: mapsPerPlayer,
                    })
                  }}
                  <FiveStackToolTip>
                    <span class="block max-w-[20rem]">
                      {{
                        $t("pages.system_telemetry.totals.maps_per_player_hint")
                      }}
                    </span>
                  </FiveStackToolTip>
                </span>
              </template>
            </div>

            <div
              class="mt-5 grid grid-cols-2 gap-4 border-t border-border/60 pt-4"
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

          <div class="grid min-w-0 content-start gap-2.5">
            <span class="text-[12.5px] text-muted-foreground">
              {{ $t("pages.system_telemetry.activity.matches") }}
            </span>
            <div v-if="activity.length" class="h-56 min-w-0 lg:h-64">
              <FleetTelemetryChart
                :labels="activityLabels"
                :values="activityMatches"
                :color="matchesColor"
                :label="$t('pages.system_telemetry.activity.matches_unit')"
              />
            </div>
            <SectionEmpty
              v-else
              :title="$t('pages.system_telemetry.no_data')"
              :description="$t('pages.system_telemetry.no_activity_hint')"
            />
          </div>
        </section>

        <!-- PANELS -->
        <FleetSection
          id="fleet-panels"
          :label="$t('pages.system_telemetry.installs.title')"
        >
          <div class="grid gap-3 lg:grid-cols-2">
            <div :class="card">
              <span :class="cardTitle">
                {{ $t("pages.system_telemetry.installs.recency") }}
                <FiveStackToolTip class="text-muted-foreground">
                  <span class="block max-w-[20rem]">
                    {{ $t("pages.system_telemetry.installs.recency_hint") }}
                  </span>
                </FiveStackToolTip>
              </span>
              <FleetMeter :segments="recencySegments" />
              <div :class="cardChips">
                <FleetReadout
                  :label="$t('pages.system_telemetry.installs.new_30d')"
                  :value="installs?.new30d ?? 0"
                />
                <FleetReadout
                  :label="$t('pages.system_telemetry.installs.retained_180d')"
                  :value="installs?.retained180d ?? 0"
                  :hint="
                    $t('pages.system_telemetry.installs.retained_180d_hint')
                  "
                />
                <FleetReadout
                  :label="$t('pages.system_telemetry.installs.reporting')"
                  :value="totals?.panels ?? 0"
                  :hint="$t('pages.system_telemetry.installs.reporting_hint')"
                />
              </div>
            </div>

            <div :class="card">
              <span :class="cardTitle">
                {{ $t("pages.system_telemetry.growth.title") }}
              </span>
              <div class="h-44">
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
        </FleetSection>

        <!-- CAPACITY -->
        <FleetSection
          id="fleet-infra"
          :label="$t('pages.system_telemetry.totals.infrastructure')"
          :hint="$t('pages.system_telemetry.totals.self_reported')"
        >
          <div class="grid gap-3 lg:grid-cols-2">
            <StatTile
              v-for="item of capacityCards"
              :key="item.key"
              :label="item.label"
              :tip="item.hint"
            >
              <FleetCount :value="item.total" />
              <template #sub>
                <div :class="tileBody">
                  <FleetMeter :segments="item.segments" :subset="item.subset" />
                  <div v-if="item.chips.length" :class="cardChips">
                    <FleetReadout
                      v-for="chip of item.chips"
                      :key="chip.label"
                      :label="chip.label"
                      :value="chip.value"
                    />
                  </div>
                </div>
              </template>
            </StatTile>
          </div>
        </FleetSection>

        <!-- MATCHES -->
        <FleetSection
          id="fleet-matches"
          :label="$t('pages.system_telemetry.totals.match_volume')"
          :hint="$t('pages.system_telemetry.totals.hosted_hint')"
        >
          <div class="grid gap-3 lg:grid-cols-3">
            <div :class="card">
              <span :class="cardTitle">
                {{ $t("pages.system_telemetry.totals.hosted_windows") }}
              </span>
              <FleetDistribution
                bare
                scale="max"
                :items="matchWindows"
                label-field="label"
                value-field="value"
                :color="matchesColor"
              />
              <div :class="cardChips">
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

            <div :class="card">
              <span :class="cardTitle">
                {{ $t("pages.system_telemetry.composition.by_type") }}
                <FiveStackToolTip class="text-muted-foreground">
                  <span class="block max-w-[20rem]">
                    {{ $t("pages.system_telemetry.composition.hint") }}
                  </span>
                </FiveStackToolTip>
              </span>
              <FleetDistribution
                bare
                :items="matchTypes"
                label-field="type"
                value-field="matches"
                :color="matchesColor"
              />
            </div>

            <div :class="card">
              <span :class="cardTitle">
                {{ $t("pages.system_telemetry.composition.by_source") }}
              </span>
              <FleetDistribution
                bare
                :items="matchSources"
                label-field="source"
                value-field="matches"
                :color="matchesColor"
              />
            </div>
          </div>

          <div class="grid gap-3 lg:grid-cols-2">
            <div :class="card">
              <span :class="cardTitle">
                {{ $t("pages.system_telemetry.totals.matches_imported") }}
              </span>
              <FleetDistribution
                bare
                scale="max"
                :items="importedRows"
                label-field="label"
                value-field="value"
                :color="importedColor"
              />
            </div>

            <StatTile
              :label="$t('pages.system_telemetry.totals.completion')"
              :tip="$t('pages.system_telemetry.totals.completion_hint')"
              :value="outcomesReported ? completionRate : null"
              suffix="%"
            >
              <template #sub>
                <div v-if="outcomesReported" :class="tileBody">
                  <FleetMeter :segments="outcomeSegments" />
                </div>
                <p v-else class="mt-1">
                  {{ $t("pages.system_telemetry.totals.not_reported_hint") }}
                </p>
              </template>
            </StatTile>
          </div>
        </FleetSection>

        <!-- COMPETITION -->
        <FleetSection
          id="fleet-competition"
          :label="$t('pages.system_telemetry.totals.competition')"
          :hint="$t('pages.system_telemetry.totals.competition_hint')"
        >
          <SectionEmpty
            v-if="!competitionReported"
            :title="$t('pages.system_telemetry.not_reported_title')"
            :description="$t('pages.system_telemetry.totals.not_reported_hint')"
          />

          <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatTile
              v-for="item of competitionCards"
              :key="item.key"
              :label="item.label"
            >
              <FleetCount :value="item.total" />
              <template #sub>
                <div :class="tileBody">
                  <FleetMeter v-if="item.segments" :segments="item.segments" />
                  <div :class="cardChips">
                    <FleetReadout
                      v-for="chip of item.chips"
                      :key="chip.label"
                      :label="chip.label"
                      :value="chip.value"
                    />
                  </div>
                </div>
              </template>
            </StatTile>
          </div>
        </FleetSection>

        <!-- UTILITY -->
        <FleetSection
          id="fleet-utility"
          :label="$t('pages.system_telemetry.utility.title')"
          :hint="$t('pages.system_telemetry.utility.hint')"
        >
          <SectionEmpty
            v-if="!utilityReported"
            :title="$t('pages.system_telemetry.not_reported_title')"
            :description="$t('pages.system_telemetry.totals.not_reported_hint')"
          />

          <div v-else class="grid gap-3 lg:grid-cols-3">
            <StatTile :label="$t('pages.system_telemetry.utility.lineups')">
              <FleetCount :value="utility?.lineups ?? 0" />
              <template #sub>
                <span :class="[delta, TONE_TEXT.amber]">
                  +{{ format(utility?.week ?? 0) }}
                </span>
                {{ $t("pages.system_telemetry.totals.last_7d") }}
                <div :class="tileBody">
                  <FleetMeter :segments="utilityVisibility" />

                  <div :class="cardChips">
                    <FleetReadout
                      :label="$t('pages.system_telemetry.utility.authors')"
                      :value="utility?.authors ?? 0"
                      :hint="$t('pages.system_telemetry.utility.authors_hint')"
                    />
                    <FleetReadout
                      :label="$t('pages.system_telemetry.utility.maps')"
                      :value="utility?.maps ?? 0"
                    />
                    <FleetReadout
                      :label="$t('pages.system_telemetry.utility.archived')"
                      :value="utility?.archived ?? 0"
                      :caption="
                        $t('pages.system_telemetry.utility.archived_caption')
                      "
                    />
                  </div>
                </div>
              </template>
            </StatTile>

            <div :class="card">
              <span :class="cardTitle">
                {{ $t("pages.system_telemetry.utility.by_type") }}
              </span>
              <FleetDistribution
                bare
                :items="utilityTypeItems"
                label-field="label"
                value-field="value"
              />
            </div>

            <div :class="card">
              <span :class="cardTitle">
                {{ $t("pages.system_telemetry.utility.by_source") }}
                <FiveStackToolTip class="text-muted-foreground">
                  <span class="block max-w-[20rem]">
                    {{ $t("pages.system_telemetry.utility.by_source_hint") }}
                  </span>
                </FiveStackToolTip>
              </span>
              <FleetDistribution
                bare
                :items="utilitySourceItems"
                label-field="label"
                value-field="value"
                :color="installsColor"
              />
            </div>

            <StatTile :label="$t('pages.system_telemetry.utility.sessions')">
              <FleetCount :value="utility?.sessions ?? 0" />
              <template #sub>
                {{
                  $t("pages.system_telemetry.utility.hit_rate", {
                    percent: utilityHitRate,
                  })
                }}
                <div :class="tileBody">
                  <FleetMeter :segments="utilityAccuracy" />

                  <div :class="cardChips">
                    <FleetReadout
                      :label="$t('pages.system_telemetry.utility.practicing')"
                      :value="utility?.practicing ?? 0"
                      :hint="
                        $t('pages.system_telemetry.utility.practicing_hint')
                      "
                    />
                    <FleetReadout
                      :label="$t('pages.system_telemetry.utility.hosts')"
                      :value="utility?.hosts ?? 0"
                    />
                    <FleetReadout
                      :label="
                        $t('pages.system_telemetry.utility.sessions_week')
                      "
                      :value="utility?.sessionsWeek ?? 0"
                      :caption="$t('pages.system_telemetry.totals.last_7d')"
                    />
                    <FleetReadout
                      :label="
                        $t('pages.system_telemetry.utility.sessions_failed')
                      "
                      :value="utility?.sessionsFailed ?? 0"
                      :hint="
                        $t(
                          'pages.system_telemetry.utility.sessions_failed_hint',
                        )
                      "
                    />
                  </div>
                </div>
              </template>
            </StatTile>

            <div :class="[card, 'grid grid-cols-2']">
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.verified')"
                :value="utility?.verified ?? 0"
                :hint="$t('pages.system_telemetry.utility.verified_hint')"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.pending_review')"
                :value="utility?.pendingReview ?? 0"
                :hint="$t('pages.system_telemetry.utility.pending_review_hint')"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.previews')"
                :value="utility?.previews ?? 0"
                :caption="$t('pages.system_telemetry.utility.previews_caption')"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.mastered')"
                :value="utility?.mastered ?? 0"
                :hint="$t('pages.system_telemetry.utility.mastered_hint')"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.favorites')"
                :value="utility?.favorites ?? 0"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.votes')"
                :value="utility?.votes ?? 0"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.collections')"
                :value="utility?.collections ?? 0"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.playbooks')"
                :value="utility?.playbooks ?? 0"
                :caption="
                  $t('pages.system_telemetry.utility.playbook_steps', {
                    steps: format(utility?.playbookSteps ?? 0),
                  })
                "
              />
            </div>

            <div :class="[card, 'grid grid-cols-2']">
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.demo_throws')"
                :value="utility?.demoThrows ?? 0"
                :hint="$t('pages.system_telemetry.utility.demo_throws_hint')"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.demos_mined')"
                :value="utility?.demosMined ?? 0"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.meta_lineups')"
                :value="utility?.metaLineups ?? 0"
                :hint="$t('pages.system_telemetry.utility.meta_lineups_hint')"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.drift_scans')"
                :value="utility?.driftScans ?? 0"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.drift_flagged')"
                :value="utility?.driftFlagged ?? 0"
                :hint="$t('pages.system_telemetry.utility.drift_flagged_hint')"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.utility.repairs')"
                :value="utility?.repairs ?? 0"
              />
            </div>
          </div>
        </FleetSection>

        <!-- COMMUNITY -->
        <FleetSection
          id="fleet-community"
          :label="$t('pages.system_telemetry.totals.community')"
          :hint="$t('pages.system_telemetry.totals.community_hint')"
        >
          <div class="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div :class="card">
              <span :class="cardTitle">
                {{ $t("pages.system_telemetry.totals.player_base") }}
                <FiveStackToolTip class="text-muted-foreground">
                  <span class="block max-w-[20rem]">
                    {{ $t("pages.system_telemetry.totals.player_base_hint") }}
                  </span>
                </FiveStackToolTip>
              </span>
              <FleetShares :rows="playerBase" />
            </div>

            <div :class="card">
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
        </FleetSection>

        <!-- FLEET DISTRIBUTION -->
        <FleetSection
          id="fleet-distribution"
          :label="$t('pages.system_telemetry.distribution.title')"
          :hint="$t('pages.system_telemetry.distribution.hint')"
        >
          <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div :class="[card, 'lg:col-span-2']">
              <FleetVersions :versions="telemetryStats?.versions ?? []" />
            </div>

            <div v-for="panel of distributions" :key="panel.key" :class="card">
              <span :class="cardTitle">{{ panel.title }}</span>
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
        </FleetSection>

        <!-- Split by what the flag actually is: an adoption rate for something
             nobody can switch reads as broken, and so does "0 panels using"
             for something nothing counts. -->
        <FleetSection v-if="featureGroups.length" id="fleet-features">
          <div class="grid gap-7">
            <div
              v-for="group of featureGroups"
              :key="group.key"
              class="grid gap-3"
            >
              <div class="flex items-center gap-1.5">
                <h2 :class="[tacticalSectionLabelClasses, 'mb-0']">
                  <span :class="tacticalSectionTickClasses" />
                  {{ group.title }}
                </h2>
                <FiveStackToolTip class="text-muted-foreground">
                  <span class="block max-w-[20rem]">{{ group.hint }}</span>
                </FiveStackToolTip>
              </div>

              <div
                class="overflow-x-auto rounded-lg border border-border bg-card/20"
              >
                <!-- Phones keep the counts and drop the bars, so nothing
                     scrolls sideways. -->
                <table class="w-full text-sm md:min-w-[560px]">
                  <thead>
                    <tr
                      class="border-b border-border text-left text-xs text-muted-foreground"
                    >
                      <th class="py-2.5 pl-4 pr-4 font-medium">
                        {{ $t("pages.system_telemetry.features.feature") }}
                      </th>
                      <th v-if="group.showFlag" class="py-2.5 pr-4 font-medium">
                        {{ group.flagLabel }}
                      </th>
                      <th class="py-2.5 pr-4 font-medium">
                        {{ $t("pages.system_telemetry.features.panels_using") }}
                      </th>
                      <th class="py-2.5 pr-4 text-right font-medium">
                        {{ $t("pages.system_telemetry.features.total") }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="feature of group.features"
                      :key="feature.key"
                      class="border-b border-border/40 last:border-0"
                    >
                      <td
                        class="py-2 pl-4 pr-4 font-medium"
                        :class="
                          feature.reporting ? '' : 'text-muted-foreground'
                        "
                      >
                        <span class="flex items-center gap-1.5">
                          {{ featureLabel(feature.key) }}
                          <FiveStackToolTip v-if="!feature.reporting">
                            <span class="block max-w-[20rem]">
                              {{
                                $t(
                                  "pages.system_telemetry.totals.not_reported_hint",
                                )
                              }}
                            </span>
                          </FiveStackToolTip>
                        </span>
                      </td>
                      <td v-if="group.showFlag" class="py-2 pr-4">
                        <span
                          v-if="!feature.reporting"
                          class="text-muted-foreground"
                        >
                          {{ NO_METRIC }}
                        </span>
                        <span v-else class="flex items-center gap-2">
                          <span
                            class="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted md:block"
                          >
                            <span
                              class="block h-full rounded-full bg-[hsl(var(--tac-step-2))]"
                              :style="{
                                width: `${percent(feature.enabled, feature.flagged)}%`,
                              }"
                            />
                          </span>
                          <span class="tabular-nums text-muted-foreground">
                            {{ feature.enabled }}/{{ feature.flagged }}
                          </span>
                        </span>
                      </td>
                      <td class="py-2 pr-4">
                        <span
                          v-if="!feature.reporting"
                          class="text-muted-foreground"
                        >
                          {{ NO_METRIC }}
                        </span>
                        <span
                          v-else-if="!feature.counted"
                          class="inline-flex items-center gap-1.5 text-muted-foreground"
                        >
                          {{ NO_METRIC }}
                          <FiveStackToolTip>
                            <span class="block max-w-[20rem]">
                              {{
                                $t(
                                  "pages.system_telemetry.features.no_metric_hint",
                                )
                              }}
                            </span>
                          </FiveStackToolTip>
                        </span>
                        <span v-else class="flex items-center gap-2">
                          <span
                            class="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted md:block"
                          >
                            <span
                              class="block h-full rounded-full bg-muted-foreground/60"
                              :style="{
                                width: `${percent(feature.installsUsing, feature.counted)}%`,
                              }"
                            />
                          </span>
                          <span class="tabular-nums text-muted-foreground">
                            {{ feature.installsUsing }}/{{ feature.counted }}
                          </span>
                        </span>
                      </td>
                      <td class="py-2 pr-4 text-right tabular-nums">
                        <span
                          v-if="!feature.reporting || !feature.counted"
                          class="text-muted-foreground"
                        >
                          {{ NO_METRIC }}
                        </span>
                        <template v-else>{{ format(feature.total) }}</template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </FleetSection>

        <FleetSection
          v-if="pluginsReported > 0"
          id="fleet-plugins"
          :label="$t('pages.system_telemetry.plugins.title')"
          :hint="
            $t('pages.system_telemetry.plugins.hint', {
              panels: pluginsReported,
            })
          "
        >
          <div class="grid gap-3 lg:grid-cols-3">
            <div :class="[card, 'lg:col-span-2']">
              <span :class="cardTitle">
                {{ $t("pages.system_telemetry.plugins.most_installed") }}
              </span>
              <FleetDistribution
                v-if="topPlugins.length"
                bare
                scale="max"
                :items="topPlugins"
                label-field="label"
                value-field="value"
              />
              <p v-else class="text-sm text-muted-foreground">
                {{ $t("pages.system_telemetry.plugins.none") }}
              </p>
            </div>

            <div :class="[card, 'grid grid-cols-2']">
              <FleetReadout
                :label="$t('pages.system_telemetry.plugins.requested')"
                :value="totals?.pluginsRequested ?? 0"
                :caption="
                  $t('pages.system_telemetry.plugins.requested_caption')
                "
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.plugins.manual')"
                :value="totals?.pluginsManual ?? 0"
                :caption="$t('pages.system_telemetry.plugins.manual_caption')"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.plugins.modes')"
                :value="totals?.gameModes ?? 0"
                :caption="$t('pages.system_telemetry.plugins.modes_caption')"
              />
              <FleetReadout
                :label="$t('pages.system_telemetry.plugins.modes_unranked')"
                :value="totals?.gameModesUnranked ?? 0"
                :caption="
                  $t('pages.system_telemetry.plugins.modes_unranked_caption')
                "
              />
            </div>
          </div>
        </FleetSection>
      </div>
    </FadeSwap>
  </div>
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import {
  FLEET_MATCHES_CHART_COLORS,
  FLEET_INSTALLS_CHART_COLORS,
} from "~/utilities/chartColors";
import {
  readRememberedView,
  saveRememberedView,
} from "~/composables/useRememberedView";

// A real em dash, not the entity: a mustache renders text, so "&mdash;" here
// would put those eight characters on the page.
const NO_METRIC = "—";

// The scope survives a refresh or a return. Options state rather than the
// composable: script-setup bindings are not reachable from `this`.
const VIEW_KEY = "fleet-telemetry";
const VIEW_DEFAULTS = { scope: "all" };
const VIEW_VALIDATE = {
  scope: (value: unknown) => value === "all" || value === "self_hosted",
};

export default {
  apollo: {
    telemetryStats: {
      query: generateQuery({
        telemetryStats: [
          { includeSelf: $("includeSelf", "Boolean") },
          {
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
              // Read by the Plugins section; it never rendered while these
              // were missing from the selection.
              pluginsReported: true,
              pluginsBySlug: true,
              pluginsRequested: true,
              pluginsManual: true,
              gameModes: true,
              gameModesUnranked: true,
            },
            utility: {
              reported: true,
              lineups: true,
              archived: true,
              week: true,
              public: true,
              team: true,
              private: true,
              authors: true,
              maps: true,
              verified: true,
              pendingReview: true,
              previews: true,
              favorites: true,
              votes: true,
              collections: true,
              playbooks: true,
              playbookSteps: true,
              sessions: true,
              sessionsWeek: true,
              sessionsFailed: true,
              hosts: true,
              practicing: true,
              attempts: true,
              successes: true,
              mastered: true,
              demosMined: true,
              demoThrows: true,
              metaLineups: true,
              driftScans: true,
              driftFlagged: true,
              repairs: true,
            },
            utilityTypes: {
              type: true,
              lineups: true,
            },
            utilitySources: {
              source: true,
              lineups: true,
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
        ],
      }),
      variables() {
        return {
          includeSelf: this.fleetFilter === "all",
        };
      },
      pollInterval: 60 * 1000,
      result(this: any) {
        this.updatedAt = Date.now();
        this.switching = false;
      },
      error(this: any) {
        this.switching = false;
      },
    },
  },
  data() {
    return {
      NO_METRIC,
      fleetFilter: readRememberedView(VIEW_KEY, VIEW_DEFAULTS, VIEW_VALIDATE)
        .scope,
      updatedAt: null as number | null,
      // The fleet toggle refetches; the report dims until the answer lands
      // and its numbers glide to the new values.
      switching: false,
      pendingJump: null as string | null,
    };
  },
  watch: {
    fleetFilter(scope: string) {
      saveRememberedView(VIEW_KEY, { scope }, VIEW_DEFAULTS);
      this.switching = true;
      // A scope already in the cache answers before this watcher runs, so
      // there is no result left to clear the dim.
      this.$nextTick(() => {
        if (!this.$apollo.queries.telemetryStats?.loading) {
          this.switching = false;
        }
      });
    },
  },
  methods: {
    // Runs once the menu has closed: handing focus back to the trigger
    // would scroll the page straight back up, so focus lands on the section
    // instead -- which is also where a keyboard user wants it.
    onJumpMenuClosed(event: Event) {
      const id = this.pendingJump;
      this.pendingJump = null;
      const target = id ? document.getElementById(id) : null;
      if (!target) {
        return;
      }
      event.preventDefault();
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      target.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start",
      });
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    },
    format(value: number) {
      return (value ?? 0).toLocaleString();
    },
    percent(value: number, total: number) {
      if (!total) {
        return 0;
      }

      return Math.round((value / total) * 100);
    },
    utilityLabel(group: string, value: string) {
      const path = `pages.utility.${group}.${value}`;

      return this.$te(path) ? this.$t(path) : value;
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
    jumpSections(): Array<{ id: string; label: string }> {
      const t = (key: string) => this.$t(`pages.system_telemetry.${key}`);
      return [
        { id: "fleet-panels", label: t("installs.title") },
        { id: "fleet-infra", label: t("totals.infrastructure") },
        { id: "fleet-matches", label: t("totals.match_volume") },
        { id: "fleet-competition", label: t("totals.competition") },
        { id: "fleet-utility", label: t("utility.title") },
        { id: "fleet-community", label: t("totals.community") },
        { id: "fleet-distribution", label: t("distribution.title") },
        ...(this.featureGroups.length
          ? [{ id: "fleet-features", label: t("features_title") }]
          : []),
        ...(this.pluginsReported > 0
          ? [{ id: "fleet-plugins", label: t("plugins.title") }]
          : []),
      ];
    },
    pluginsReported(): number {
      return (this.totals as Record<string, any>)?.pluginsReported ?? 0;
    },
    // Ranked by how many separate panels run it, not how many nodes: one
    // operator with forty nodes is not forty operators, and the point of this
    // list is which plugins people chose.
    topPlugins(): Array<{ label: string; value: number }> {
      const bySlug = (this.totals as Record<string, any>)?.pluginsBySlug ?? {};

      return Object.entries(bySlug)
        .map(([slug, counts]) => ({
          label: slug,
          value: Number((counts as Record<string, any>)?.panels ?? 0),
        }))
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    },
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
    utility() {
      return this.telemetryStats?.utility;
    },
    utilityReported() {
      return this.utility?.reported ?? 0;
    },
    utilityVisibility() {
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.utility.${key}`);

      return [
        {
          label: t("public"),
          value: this.utility?.public ?? 0,
          color: this.step(1),
        },
        {
          label: t("team"),
          value: this.utility?.team ?? 0,
          color: this.step(3),
        },
        {
          label: t("private"),
          value: this.utility?.private ?? 0,
          color: "hsl(var(--muted-foreground) / 0.35)",
        },
      ];
    },
    // Throws, not sessions: the practice plugin scores each grenade, so this is
    // the fleet's hit rate against its own lineups.
    utilityAccuracy() {
      const attempts = this.utility?.attempts ?? 0;
      const successes = Math.min(this.utility?.successes ?? 0, attempts);
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.utility.${key}`);

      return [
        { label: t("landed"), value: successes, color: this.step(1) },
        {
          label: t("missed"),
          value: attempts - successes,
          color: "hsl(var(--muted-foreground) / 0.35)",
        },
      ];
    },
    utilityHitRate() {
      const attempts = this.utility?.attempts ?? 0;

      return attempts
        ? Math.round(((this.utility?.successes ?? 0) / attempts) * 100)
        : 0;
    },
    // Both lists borrow the utility feature's own labels rather than restating
    // them here, and fall back to the raw value for anything a newer panel
    // reports that this build has no name for.
    utilityTypeItems() {
      return (this.telemetryStats?.utilityTypes ?? []).map((entry) => ({
        label: this.utilityLabel("types", entry.type),
        value: entry.lineups,
      }));
    },
    utilitySourceItems() {
      return (this.telemetryStats?.utilitySources ?? []).map((entry) => ({
        label: this.utilityLabel("origin_sources", entry.source),
        value: entry.lineups,
      }));
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
    fleetFilterOptions() {
      const t = (key: string) =>
        this.$t(`pages.system_telemetry.filter.${key}`);

      return [
        { key: "all", label: t("all") },
        { key: "self_hosted", label: t("self_hosted") },
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

      // Live rows first. The server sorts by total, which leaves a feature no
      // panel has reported yet sitting among the ones that are simply at zero.
      for (const bucket of Object.values(buckets)) {
        bucket.sort(
          (a, b) => Number(b.reporting > 0) - Number(a.reporting > 0),
        );
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
