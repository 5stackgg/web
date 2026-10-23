<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { MoreVertical } from "lucide-vue-next";
import TableColumnPicker from "~/components/common/TableColumnPicker.vue";
import LineupOverview from "~/components/match/LineupOverview.vue";
import MatchHeader from "~/components/match/MatchHeader.vue";
import MatchHeaderVeto from "~/components/match/MatchHeaderVeto.vue";
import MatchSideFilter from "~/components/match/MatchSideFilter.vue";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  provideSidebarContext,
  SIDEBAR_MOBILE_QUERY,
} from "~/components/ui/sidebar/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { provideMatchSide } from "~/composables/useMatchSide";
import {
  useAimColumns,
  useOpeningDuelsColumns,
  useOverviewColumns,
  useTradeColumns,
  useUtilityColumns,
} from "~/composables/useMatchTableColumns";
import {
  demoMatch,
  demoPicks,
  demoRewindRounds,
  withDecider,
} from "~/utilities/demoMatch";
import { useDemoFaces } from "~/utilities/landing/demoFaces";
import { demoMatchStats } from "~/utilities/landing/demoMatchStats";
import { lazyPanel } from "~/utilities/lazyPanel";

const LineupAimStats = lazyPanel(
  () => import("~/components/match/LineupAimStats.vue"),
);
const LineupTradeStats = lazyPanel(
  () => import("~/components/match/LineupTradeStats.vue"),
);
const LineupUtility = lazyPanel(
  () => import("~/components/match/LineupUtility.vue"),
);
const LineupOpeningDuels = lazyPanel(
  () => import("~/components/match/LineupOpeningDuels.vue"),
);
const MatchEconomyTimeline = lazyPanel(
  () => import("~/components/match/MatchEconomyTimeline.vue"),
);
const MatchTeamStats = lazyPanel(
  () => import("~/components/match/MatchTeamStats.vue"),
);
const LineupBuyTypes = lazyPanel(
  () => import("~/components/match/LineupBuyTypes.vue"),
);
const LineupClutches = lazyPanel(
  () => import("~/components/match/LineupClutches.vue"),
);
const HeadToHead = lazyPanel(() => import("~/components/match/HeadToHead.vue"));
const LineupRadarComparison = lazyPanel(
  () => import("~/components/match/LineupRadarComparison.vue"),
);
const MatchRoles = lazyPanel(() => import("~/components/match/MatchRoles.vue"));
const MatchUtilityUtility = lazyPanel(
  () => import("~/components/match/MatchUtilityUtility.vue"),
);
const MatchOptionsDisplay = lazyPanel(
  () => import("~/components/match/MatchOptionsDisplay.vue"),
);

provideMatchSide("all");

// The scoreboard's player cells ask the app shell's sidebar whether to go
// compact, and /welcome has no shell.
provideSidebarContext({
  state: computed(() => "collapsed" as const),
  open: ref(false),
  setOpen: () => {},
  isMobile: useMediaQuery(SIDEBAR_MOBILE_QUERY),
  openMobile: ref(false),
  setOpenMobile: () => {},
  toggleSidebar: () => {},
});

const { dressMatch } = useDemoFaces();
const picks = withDecider(demoPicks(8));
const { match: played, views } = demoMatchStats(
  demoMatch({
    step: "finished",
    picks,
    rounds: demoRewindRounds({ finished: true }),
  }),
);
const match = { ...dressMatch(played), is_organizer: false };

// The finished match's tabs, as MatchTabs lists them. Rounds is only for the
// map being played, and Map analysis reads heatmaps this demo doesn't have.
const tabs = [
  { value: "scoreboard", label: "match.tabs.scoreboard" },
  { value: "economy", label: "match.tabs.economy" },
  { value: "clutches", label: "match.tabs.clutches" },
  { value: "head-to-head", label: "match.tabs.head_to_head" },
  { value: "roles", label: "match.tabs.roles" },
  { value: "utility", label: "match.tabs.utility" },
];

const lenses = [
  { value: "general", labelKey: "match.tabs.general" },
  { value: "aim", labelKey: "match.tabs.aim_stats" },
  { value: "trades", labelKey: "match.tabs.trade_stats" },
  { value: "utility", labelKey: "match.tabs.utility" },
  { value: "opening", labelKey: "match.tabs.opening_duels" },
];

const tab = ref("scoreboard");
const lens = ref("general");
const h2hA = ref<string | null>(null);
const h2hB = ref<string | null>(null);

const { columnsRef: overviewColumns } = useOverviewColumns();
const { columnsRef: aimColumns } = useAimColumns();
const { columnsRef: tradeColumns } = useTradeColumns();
const { columnsRef: utilityColumns } = useUtilityColumns();
const { columnsRef: openingColumns } = useOpeningDuelsColumns();

const columnPicker = computed(
  () =>
    ({
      general: { key: "match-overview", columns: overviewColumns.value },
      aim: { key: "match-aim", columns: aimColumns.value },
      trades: { key: "match-trade", columns: tradeColumns.value },
      utility: { key: "match-utility", columns: utilityColumns.value },
      opening: { key: "match-opening-duels", columns: openingColumns.value },
    })[lens.value]!,
);

const panel = ref<HTMLElement | null>(null);
watch([tab, lens], () => panel.value?.scrollTo({ top: 0 }));
</script>

<template>
  <div
    class="overflow-hidden rounded-xl border border-border bg-card shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)]"
    @contextmenu.capture.stop
  >
    <div class="border-b border-border bg-muted/20">
      <MatchHeader :match="match">
        <template #actions><span></span></template>
        <template #veto>
          <MatchHeaderVeto :match="match" :picks="picks" />
        </template>
      </MatchHeader>
    </div>

    <Tabs v-model="tab" :scroll-floor="false">
      <div class="flex items-center gap-2 border-b border-border/60 px-2 md:px-4">
        <div class="min-w-0 flex-1 overflow-x-auto">
          <TabsList variant="underline" class="h-auto flex-nowrap">
            <TabsTrigger v-for="entry in tabs" :key="entry.value" :value="entry.value">
              {{ $t(entry.label) }}
            </TabsTrigger>
          </TabsList>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="shrink-0 gap-2 font-mono text-[0.7rem] uppercase leading-none tracking-[0.15em]"
              :class="
                tab === 'settings' &&
                'border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
              "
            >
              <MoreVertical class="size-4 shrink-0" />
              <span class="max-sm:sr-only">{{ $t("match.tabs.more") }}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="tab = 'settings'">
              {{ $t("match.tabs.settings") }}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              {{ $t("match.tabs.streams") }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        ref="panel"
        class="h-[30rem] overflow-y-auto px-3 py-4 md:h-[32rem] md:px-5"
      >
        <TabsContent value="scoreboard" class="tab-panel-in mt-0">
          <div
            class="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3"
          >
            <div class="lg:hidden">
              <Select v-model="lens">
                <SelectTrigger
                  class="w-full"
                  :aria-label="$t('ui.tooltips.match_section')"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="entry in lenses"
                    :key="entry.value"
                    :value="entry.value"
                  >
                    {{ $t(entry.labelKey) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div
              class="hidden items-center gap-0.5 rounded-md border border-border/60 bg-background/40 p-0.5 lg:inline-flex"
            >
              <button
                v-for="entry in lenses"
                :key="entry.value"
                type="button"
                class="shrink-0 rounded-sm px-2.5 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] transition-colors"
                :class="
                  lens === entry.value
                    ? 'bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="lens = entry.value"
              >
                {{ $t(entry.labelKey) }}
              </button>
            </div>
            <div class="flex items-center gap-2 lg:justify-end">
              <MatchSideFilter v-if="['general', 'opening'].includes(lens)" />
              <TableColumnPicker
                :key="columnPicker.key"
                :storage-key="columnPicker.key"
                :columns="columnPicker.columns"
              />
            </div>
          </div>

          <!-- Player cells link to profiles, and these players are made up. -->
          <Transition
            enter-active-class="transition-all duration-150 ease-out motion-reduce:transition-none"
            enter-from-class="translate-y-[2px] opacity-0"
            leave-active-class="hidden"
          >
            <Card
              :key="lens"
              class="overflow-x-auto overscroll-x-none bg-card/20"
            >
              <CardContent class="p-1 sm:p-2" inert>
                <LineupOverview
                  v-if="lens === 'general'"
                  :match="match"
                  :lineup="match.lineup_1"
                  :combine-with="match.lineup_2"
                />
                <LineupAimStats
                  v-else-if="lens === 'aim'"
                  :match="match"
                  :lineup="match.lineup_1"
                  :combine-with="match.lineup_2"
                />
                <LineupTradeStats
                  v-else-if="lens === 'trades'"
                  :match="match"
                  :lineup="match.lineup_1"
                  :combine-with="match.lineup_2"
                />
                <LineupUtility
                  v-else-if="lens === 'utility'"
                  :match="match"
                  :lineup="match.lineup_1"
                  :combine-with="match.lineup_2"
                />
                <LineupOpeningDuels
                  v-else
                  :match="match"
                  :lineup="match.lineup_1"
                  :combine-with="match.lineup_2"
                  :views="views"
                />
              </CardContent>
            </Card>
          </Transition>
        </TabsContent>

        <TabsContent value="economy" class="tab-panel-in mt-0">
          <div class="grid gap-4">
            <div class="flex justify-end">
              <MatchSideFilter />
            </div>
            <MatchEconomyTimeline :match="match" />
            <MatchTeamStats
              :match="match"
              :lineup="match.lineup_1"
              :combine-with="match.lineup_2"
              :views="views"
            />
            <div class="mt-2 grid gap-3">
              <div class="flex items-center gap-2">
                <span
                  class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
                />
                <span
                  class="font-sans text-sm font-semibold uppercase tracking-[0.14em]"
                >
                  {{ $t("match.buy_types.section_title") }}
                </span>
              </div>
              <LineupBuyTypes
                inert
                :match="match"
                :lineup="match.lineup_1"
                :combine-with="match.lineup_2"
                :views="views"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="clutches" class="tab-panel-in mt-0">
          <div class="mb-4 flex justify-end">
            <MatchSideFilter />
          </div>
          <LineupClutches
            :match="match"
            :lineup1="match.lineup_1"
            :lineup2="match.lineup_2"
            :views="views"
          />
        </TabsContent>

        <TabsContent value="head-to-head" class="tab-panel-in mt-0">
          <div class="grid gap-4">
            <HeadToHead
              v-model:selected-a="h2hA"
              v-model:selected-b="h2hB"
              :match="match"
              :views="views"
            />
            <LineupRadarComparison
              v-model:selected-a="h2hA"
              v-model:selected-b="h2hB"
              inert
              :match="match"
              :lineup="match.lineup_1"
              :combine-with="match.lineup_2"
              :hide-selectors="true"
              :loading="false"
              :views="views"
            />
          </div>
        </TabsContent>

        <TabsContent value="roles" class="tab-panel-in mt-0">
          <MatchRoles
            inert
            :match="match"
            :lineup="match.lineup_1"
            :combine-with="match.lineup_2"
            :views="views"
          />
        </TabsContent>

        <TabsContent value="utility" class="tab-panel-in mt-0">
          <MatchUtilityUtility :match="match" :views="views" />
        </TabsContent>

        <TabsContent value="settings" class="tab-panel-in mt-0">
          <div class="flex flex-col gap-4">
            <MatchOptionsDisplay
              :options="match.options"
              :show-details-by-default="true"
              :substitutes="0"
            />
          </div>
        </TabsContent>
      </div>
    </Tabs>
  </div>
</template>
