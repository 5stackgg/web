<script lang="ts" setup>
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent } from "~/components/ui/card";
import LineupOverview from "~/components/match/LineupOverview.vue";
import LineupUtility from "~/components/match/LineupUtility.vue";
import LineupTradeStats from "~/components/match/LineupTradeStats.vue";
import LineupAimStats from "~/components/match/LineupAimStats.vue";
import LineupOpeningDuels from "~/components/match/LineupOpeningDuels.vue";
import LineupBuyTypes from "~/components/match/LineupBuyTypes.vue";
import LineupClutches from "~/components/match/LineupClutches.vue";
import LineupRadarComparison from "~/components/match/LineupRadarComparison.vue";
import MatchTeamStats from "~/components/match/MatchTeamStats.vue";
import MatchMapAnalysis from "~/components/match/MatchMapAnalysis.vue";
import MatchEconomyTimeline from "~/components/match/MatchEconomyTimeline.vue";
import HeadToHead from "~/components/match/HeadToHead.vue";
import MatchRoles from "~/components/match/MatchRoles.vue";
import MatchSideFilter from "~/components/match/MatchSideFilter.vue";
import TableColumnPicker from "~/components/common/TableColumnPicker.vue";
import TeamUtilitySummary from "~/components/match/TeamUtilitySummary.vue";
import { provideMatchSide } from "~/composables/useMatchSide";
import {
  useOverviewColumns,
  useUtilityColumns,
  useAimColumns,
  useTradeColumns,
  useOpeningDuelsColumns,
} from "~/composables/useMatchTableColumns";

provideMatchSide("all");

// Head to Head selection (lineup_1 player / lineup_2 player) shared between
// the matrix picker and the radar comparison so one matchup drives both.
const h2hSelectedA = ref<string | null>(null);
const h2hSelectedB = ref<string | null>(null);

const { columnsRef: overviewColumnsRef } = useOverviewColumns();
const { columnsRef: utilityColumnsRef } = useUtilityColumns();
const { columnsRef: aimColumnsRef } = useAimColumns();
const { columnsRef: tradeColumnsRef } = useTradeColumns();
const { columnsRef: openingDuelsColumnsRef } = useOpeningDuelsColumns();
import RconCommander from "~/components/servers/RconCommander.vue";
import { provide, ref } from "vue";
import EventEmitter from "eventemitter3";
import { Button } from "~/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import MatchOptionsDisplay from "~/components/match//MatchOptionsDisplay.vue";
import MatchServerRebootControl from "~/components/match/MatchServerRebootControl.vue";
import { Cross2Icon } from "@radix-icons/vue";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import ServiceLogs from "~/components/ServiceLogs.vue";
import { e_match_types_enum } from "~/generated/zeus";
import MatchForm from "~/components/match/MatchForm.vue";
import MatchLiveStreams from "~/components/match/MatchLiveStreams.vue";
import cleanMapName from "~/utilities/cleanMapName";
import { MoreVertical, AlertTriangle, ExternalLink } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const commander = new EventEmitter();
provide("commander", commander);
</script>

<template>
  <Tabs v-model="activeTab" class="match-tabs">
    <div
      v-if="statsEligibleMaps.length > 1"
      class="map-filter-banner max-w-[1500px]"
      :class="{ 'is-active': !!activeMap }"
      aria-live="polite"
    >
      <div
        class="relative flex items-center justify-between gap-3 px-3 py-2 border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.08)]"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span
            class="shrink-0 inline-block w-[6px] h-[6px] rounded-full bg-[hsl(var(--tac-amber))]"
          ></span>
          <div class="flex flex-col gap-0.5 min-w-0">
            <span
              class="font-mono text-[0.6rem] font-bold tracking-[0.28em] uppercase text-[hsl(var(--tac-amber))]"
            >
              {{ $t("match.map_filter_active") }}
            </span>
            <div class="map-filter-flip relative min-w-0">
              <Transition name="map-flip" mode="out-in">
                <span
                  v-if="activeMap"
                  :key="activeMap.id"
                  class="block font-mono text-[0.75rem] tracking-[0.12em] uppercase text-foreground truncate"
                >
                  {{ cleanMapName(activeMap.map.name) }}
                  <span
                    v-if="typeof activeMap.lineup_1_score === 'number'"
                    class="text-muted-foreground ml-2"
                  >
                    {{ activeMap.lineup_1_score }} :
                    {{ activeMap.lineup_2_score }}
                  </span>
                </span>
              </Transition>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="shrink-0 font-mono text-[0.65rem] tracking-[0.2em] uppercase gap-2 border border-transparent hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))]"
          @click="$emit('clear-active-map')"
        >
          <Cross2Icon class="w-3 h-3" />
          {{ $t("common.close") }}
        </Button>
      </div>
    </div>
    <!-- Mobile: map filter selector -->
    <div
      v-if="statsEligibleMaps.length > 1"
      class="mb-3 lg:hidden flex flex-col gap-1"
    >
      <span
        class="font-mono text-[0.55rem] tracking-[0.28em] uppercase text-muted-foreground/70"
      >
        {{ $t("match.tabs.mobile_label_map") }}
      </span>
      <Select :model-value="mapSelectValue" @update:model-value="onMapSelect">
        <SelectTrigger
          class="w-full"
          :aria-label="$t('match.tabs.mobile_label_map')"
        >
          <SelectValue :placeholder="$t('match.all_maps') || 'All Maps'" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">
            {{ $t("match.all_maps") }}
          </SelectItem>
          <SelectItem v-for="m in statsEligibleMaps" :key="m.id" :value="m.id">
            {{ cleanMapName(m.map.name) }}
            <span
              v-if="typeof m.lineup_1_score === 'number'"
              class="text-muted-foreground ml-2"
            >
              {{ m.lineup_1_score }} : {{ m.lineup_2_score }}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
    <!-- Mobile: single dropdown + side filter row -->
    <div
      class="mb-4 lg:hidden flex flex-col gap-1"
      :class="
        statsEligibleMaps.length > 1 ? 'pt-3 border-t border-border/50' : ''
      "
    >
      <span
        class="font-mono text-[0.55rem] tracking-[0.28em] uppercase text-muted-foreground/70"
      >
        {{ $t("match.tabs.mobile_label_view") }}
      </span>
      <div class="flex items-center gap-2">
        <div class="min-w-0 flex-1">
          <Select v-model="activeTab">
            <SelectTrigger
              class="w-full"
              :aria-label="$t('ui.tooltips.match_section')"
            >
              <SelectValue :placeholder="$t('match.tabs.scoreboard')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scoreboard">
                {{ $t("match.tabs.scoreboard") }}
              </SelectItem>
              <template v-if="!disableStats">
                <SelectItem value="economy">
                  {{ $t("match.tabs.economy") }}
                </SelectItem>
                <SelectItem
                  v-if="match.options.type !== e_match_types_enum.Duel"
                  value="clutches"
                >
                  {{ $t("match.tabs.clutches") }}
                </SelectItem>
                <SelectItem value="head-to-head">
                  {{ $t("match.tabs.head_to_head") }}
                </SelectItem>
                <SelectItem value="roles">
                  {{ $t("match.tabs.roles") }}
                </SelectItem>
                <SelectItem value="map-analysis">
                  {{ $t("match.tabs.map_analysis") }}
                </SelectItem>
              </template>
              <SelectItem value="settings">
                {{ $t("match.tabs.settings") }}
              </SelectItem>
              <SelectItem value="streams" :disabled="!canConfigureStreams">
                {{ $t("match.tabs.streams") }}
              </SelectItem>
              <SelectItem v-if="canViewAdmin" value="server">
                {{ $t("match.tabs.admin") }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
    <div
      class="hidden lg:flex items-center gap-3 mb-4 max-w-full match-tabs__header"
    >
      <div class="min-w-0 flex-1 overflow-x-auto match-tabs__scroll">
        <TabsList variant="underline" class="h-auto flex-nowrap">
          <TabsTrigger value="scoreboard">
            {{ $t("match.tabs.scoreboard") }}
          </TabsTrigger>
          <template v-if="!disableStats">
            <TabsTrigger value="economy">
              {{ $t("match.tabs.economy") }}
            </TabsTrigger>
            <TabsTrigger
              value="clutches"
              v-if="match.options.type !== e_match_types_enum.Duel"
            >
              {{ $t("match.tabs.clutches") }}
            </TabsTrigger>
            <TabsTrigger value="head-to-head">
              {{ $t("match.tabs.head_to_head") }}
            </TabsTrigger>
            <TabsTrigger value="roles">
              {{ $t("match.tabs.roles") }}
            </TabsTrigger>
            <TabsTrigger value="map-analysis">
              {{ $t("match.tabs.map_analysis") }}
            </TabsTrigger>
          </template>
        </TabsList>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            class="shrink-0 inline-flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.15em] uppercase leading-none"
            :class="
              isOpsTabActive
                ? 'border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                : ''
            "
          >
            <MoreVertical class="w-4 h-4 shrink-0" />
            <span class="leading-none">{{ $t("match.tabs.more") }}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="activeTab = 'settings'">
            {{ $t("match.tabs.settings") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            :disabled="!canConfigureStreams"
            @click="canConfigureStreams && (activeTab = 'streams')"
          >
            {{ $t("match.tabs.streams") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="canViewAdmin" @click="activeTab = 'server'">
            {{ $t("match.tabs.admin") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <TabsContent value="scoreboard">
      <div
        v-if="!disableStats"
        class="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3"
      >
        <!-- Mobile / tablet: compact stat-category dropdown -->
        <div class="lg:hidden">
          <Select v-model="scoreboardLens">
            <SelectTrigger
              class="w-full"
              :aria-label="$t('ui.tooltips.match_section')"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="l in scoreboardLenses"
                :key="l.value"
                :value="l.value"
              >
                {{ $t(l.labelKey) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <!-- Desktop: stat-category button pill -->
        <div
          class="hidden items-center gap-0.5 rounded-md border border-border/60 bg-background/40 p-0.5 lg:inline-flex"
        >
          <button
            v-for="l in scoreboardLenses"
            :key="l.value"
            type="button"
            class="shrink-0 rounded px-2.5 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] transition-colors"
            :class="
              scoreboardLens === l.value
                ? 'bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                : 'text-muted-foreground hover:text-foreground'
            "
            @click="scoreboardLens = l.value"
          >
            {{ $t(l.labelKey) }}
          </button>
        </div>
        <div
          v-if="showStatsControls"
          class="flex items-center gap-2 lg:justify-end"
        >
          <Tooltip v-if="effectiveScoreboardLens === 'aim' && aimEstimated">
            <TooltipTrigger
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] font-mono text-[0.6rem] font-bold tracking-[0.18em] uppercase text-[hsl(var(--tac-amber))]"
            >
              <AlertTriangle class="w-3 h-3" />
              {{ $t("match.lineup.stats.estimated") }}
            </TooltipTrigger>
            <TooltipContent class="max-w-xs">
              {{ $t("match.lineup.stats.estimated_tooltip") }}
            </TooltipContent>
          </Tooltip>
          <MatchSideFilter
            v-if="['general', 'opening'].includes(effectiveScoreboardLens)"
          />
          <TableColumnPicker
            v-if="effectiveScoreboardLens === 'general'"
            storage-key="match-overview"
            :columns="overviewColumnsRef"
          />
          <TableColumnPicker
            v-else-if="effectiveScoreboardLens === 'aim'"
            storage-key="match-aim"
            :columns="aimColumnsRef"
          />
          <TableColumnPicker
            v-else-if="effectiveScoreboardLens === 'trades'"
            storage-key="match-trade"
            :columns="tradeColumnsRef"
          />
          <TableColumnPicker
            v-else-if="effectiveScoreboardLens === 'utility'"
            storage-key="match-utility"
            :columns="utilityColumnsRef"
          />
          <TableColumnPicker
            v-else-if="effectiveScoreboardLens === 'opening'"
            storage-key="match-opening-duels"
            :columns="openingDuelsColumnsRef"
          />
        </div>
      </div>

      <template v-if="effectiveScoreboardLens === 'general'">
        <div
          class="grid gap-4 max-w-[1500px] transition-opacity duration-200"
          :class="{ 'opacity-60': activeMap && !mapStats }"
        >
          <Card class="overflow-x-auto overscroll-x-none bg-card/20">
            <CardContent class="p-1 sm:p-2">
              <LineupOverview
                :match="mapScopedMatch"
                :lineup="activeLineup1"
                :combine-with="activeLineup2"
              ></LineupOverview>
            </CardContent>
          </Card>
        </div>

        <div
          v-if="canAdjustLineups"
          class="flex flex-wrap gap-2 mt-3 md:gap-3 md:justify-end container mx-auto px-4"
        >
          <Button variant="outline" class="px-4" @click="randomizeTeams">
            {{ $t("match.tabs.randomize_teams") }}
          </Button>
          <Button variant="outline" class="px-4" @click="swapLineups">
            {{ $t("match.tabs.swap_lineups") }}
          </Button>
        </div>
      </template>

      <div
        v-else-if="effectiveScoreboardLens === 'utility'"
        class="grid gap-4 max-w-[1500px] transition-opacity duration-200"
        :class="{ 'opacity-60': activeMap && !mapStats }"
      >
        <Card class="overflow-x-auto overscroll-x-none bg-card/20">
          <CardContent class="p-1 sm:p-2">
            <lineup-utility
              :match="mapScopedMatch"
              :lineup="activeLineup1"
              :combine-with="activeLineup2"
            ></lineup-utility>
          </CardContent>
        </Card>
      </div>

      <div
        v-else-if="effectiveScoreboardLens === 'trades'"
        class="grid gap-4 max-w-[1500px] transition-opacity duration-200"
        :class="{ 'opacity-60': activeMap && !mapStats }"
      >
        <Card class="overflow-x-auto overscroll-x-none bg-card/20">
          <CardContent class="p-1 sm:p-2">
            <lineup-trade-stats
              :match="mapScopedMatch"
              :lineup="activeLineup1"
              :combine-with="activeLineup2"
            ></lineup-trade-stats>
          </CardContent>
        </Card>
      </div>

      <div
        v-else-if="effectiveScoreboardLens === 'aim'"
        class="grid gap-4 max-w-[1500px] transition-opacity duration-200"
        :class="{ 'opacity-60': activeMap && !mapStats }"
      >
        <Card class="overflow-x-auto overscroll-x-none bg-card/20">
          <CardContent class="p-1 sm:p-2">
            <lineup-aim-stats
              :match="mapScopedMatch"
              :lineup="activeLineup1"
              :combine-with="activeLineup2"
            ></lineup-aim-stats>
          </CardContent>
        </Card>
      </div>

      <div
        v-else-if="effectiveScoreboardLens === 'opening'"
        class="grid gap-4 max-w-[1500px]"
      >
        <Card class="overflow-x-auto overscroll-x-none bg-card/20">
          <CardContent class="p-1 sm:p-2">
            <lineup-opening-duels
              :match="match"
              :lineup="match.lineup_1"
              :combine-with="match.lineup_2"
              :selected-map-id="activeMap?.id"
            ></lineup-opening-duels>
          </CardContent>
        </Card>
      </div>

    </TabsContent>
    <TabsContent value="economy">
      <div class="grid gap-4 max-w-[1500px]">
        <div v-if="showStatsControls" class="flex justify-end gap-2">
          <MatchSideFilter />
        </div>
        <MatchEconomyTimeline :match="match" :selected-map-id="activeMap?.id" />
        <MatchTeamStats
          :match="mapScopedMatch"
          :lineup="activeLineup1"
          :combine-with="activeLineup2"
          :selected-map-id="activeMap?.id"
        />
        <div class="grid gap-3 mt-2">
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
          <lineup-buy-types
            :match="match"
            :lineup="match.lineup_1"
            :combine-with="match.lineup_2"
            :selected-map-id="activeMap?.id"
          ></lineup-buy-types>
        </div>
      </div>
    </TabsContent>
    <TabsContent value="clutches">
      <div class="max-w-[1500px]">
        <div v-if="showStatsControls" class="flex justify-end gap-2 mb-4">
          <MatchSideFilter />
        </div>
        <lineup-clutches
          :match="match"
          :lineup1="match.lineup_1"
          :lineup2="match.lineup_2"
          :selected-map-id="activeMap?.id"
        ></lineup-clutches>
      </div>
    </TabsContent>
    <TabsContent value="head-to-head">
      <div
        class="grid gap-4 max-w-[1500px] transition-opacity duration-200"
        :class="{ 'opacity-60': activeMap && !mapStats }"
      >
        <HeadToHead
          :match="match"
          v-model:selected-a="h2hSelectedA"
          v-model:selected-b="h2hSelectedB"
        />
        <LineupRadarComparison
          :match="mapScopedMatch"
          :lineup="activeLineup1"
          :combine-with="activeLineup2"
          :selected-map-id="activeMap?.id"
          :hide-selectors="true"
          v-model:selected-a="h2hSelectedA"
          v-model:selected-b="h2hSelectedB"
        />
      </div>
    </TabsContent>
    <TabsContent value="roles">
      <div
        class="grid gap-4 max-w-[1500px] transition-opacity duration-200"
        :class="{ 'opacity-60': activeMap && !mapStats }"
      >
        <MatchRoles
          :match="mapScopedMatch"
          :lineup="activeLineup1"
          :combine-with="activeLineup2"
          :selected-map-id="activeMap?.id"
        />
      </div>
    </TabsContent>
    <TabsContent value="map-analysis">
      <div class="grid gap-4 max-w-[1500px]">
        <MatchMapAnalysis :match="match" :selected-map-id="activeMap?.id" />
      </div>
    </TabsContent>
    <TabsContent
      value="server"
      class="flex flex-col gap-4 max-w-[1500px] w-full overflow-x-auto"
    >
      <AlertDialog :open="showConfirmDialog">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ $t("common.confirm") }}</AlertDialogTitle>
            <AlertDialogDescription class="flex flex-col gap-2">
              <span>{{ $t("common.are_you_sure") }}</span>
              <Badge variant="secondary" class="w-fit">
                {{ pendingCommand?.display ? $t(pendingCommand.display) : "" }}
              </Badge>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel @click="showConfirmDialog = false">
              {{ $t("common.cancel") }}
            </AlertDialogCancel>
            <AlertDialogAction
              @click="
                executePending && executePending();
                showConfirmDialog = false;
              "
            >
              {{ $t("common.confirm") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <!-- Reboot confirm lives here (not in the RCON dropdown) so it survives
           the dropdown unmounting when the menu closes. -->
      <MatchServerRebootControl
        :match="match"
        variant="dialog"
        v-model:open="showRebootDialog"
      />

      <RconCommander
        :server-id="match.server_id"
        :online="!!match.is_server_online"
        :match-id="match.id"
        v-if="canSendRCONCommands"
      >
        <template #default="{ commander: send }">
          <template v-for="command of availableCommands">
            <DropdownMenuItem
              :disabled="!match.is_server_online"
              @click="
                command.confirm
                  ? confirmCommand(command, send)
                  : send(command.value, '')
              "
            >
              {{ $t(command.display) }}
            </DropdownMenuItem>
          </template>

          <form
            @submit.prevent="send('restore_round', form.values.round)"
            v-if="backupRounds.length > 0"
          >
          <FormField v-slot="{ componentField }" name="round">
            <FormItem>
              <FormLabel>{{ $t("match.tabs.restore_round") }}</FormLabel>
              <Select
                v-bind="componentField"
                @update:model-value="
                  (value) => form.setFieldValue('round', value)
                "
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      :placeholder="$t('match.tabs.select_round_to_restore')"
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectGroup>
                    <template v-for="round of backupRounds">
                      <SelectItem
                        v-if="round.has_backup_file && round.round > 0"
                        :key="round.round"
                        :value="round.round.toString()"
                      >
                        {{
                          $t("common.round", {
                            number: round.round.toString(),
                          })
                        }}
                      </SelectItem>
                    </template>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <Button type="submit">{{ $t("match.tabs.restore_round") }}</Button>
          </form>
        </template>

        <template #footer>
          <MatchServerRebootControl
            :match="match"
            variant="menu-item"
            v-model:open="showRebootDialog"
          />
        </template>
      </RconCommander>

      <div
        v-if="!hasLogs"
        class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-8 text-center"
      >
        <h3 class="font-semibold">{{ $t("match.tabs.no_logs_title") }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ $t("match.tabs.no_logs_description") }}
        </p>
      </div>
      <div v-if="canViewMatchServerLogs" v-show="hasLogs">
        <ServiceLogs
          :service="`m-${match.id}`"
          :compact="true"
          :disable-retry="isMatchTerminal"
          @has-logs="hasLogs = $event"
        />
      </div>
    </TabsContent>
    <TabsContent value="settings" class="flex flex-col gap-4 max-w-[1500px]">
      <MatchOptionsDisplay
        :options="match.options"
        :show-details-by-default="true"
      ></MatchOptionsDisplay>

      <section v-if="displayServerInformation" class="server-info-panel">
        <header class="server-info-panel__head">
          <span class="server-info-panel__tick"></span>
          {{ $t("match.tabs.server_information") }}
        </header>
        <dl class="server-info-panel__list">
          <div class="server-info-row">
            <dt class="server-info-row__label">{{ $t("match.tabs.type") }}</dt>
            <dd class="server-info-row__value">
              {{ match.server_type || $t("common.tbd") }}
            </dd>
          </div>
          <div class="server-info-row">
            <dt class="server-info-row__label">{{
              $t("match.tabs.region")
            }}</dt>
            <dd class="server-info-row__value">
              <span v-if="match.server_region">{{ match.server_region }}</span>
              <span v-else-if="match.e_region">{{
                match.e_region.description || match.e_region.value
              }}</span>
            </dd>
          </div>
        </dl>
      </section>
      <MatchForm
        v-if="match.is_organizer && showMatchSettingsForm"
        :match="match"
        class="!max-w-none"
      />
    </TabsContent>
    <TabsContent value="streams" class="max-w-[1500px]">
      <MatchLiveStreams :match="match" />
    </TabsContent>
    <div
      v-if="!disableStats && !isOpsTabActive"
      class="mt-0.5 flex justify-end max-w-[1500px]"
    >
      <button
        type="button"
        class="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground"
        @click="openStatsGuide"
      >
        {{ $t("glossary.guide_link") }}
        <ExternalLink class="h-3 w-3" />
      </button>
    </div>
  </Tabs>
</template>

<style scoped>
.map-filter-banner {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  margin-bottom: 0;
  transition:
    grid-template-rows 220ms ease,
    opacity 180ms ease,
    margin-bottom 220ms ease;
}

.map-filter-banner > * {
  min-height: 0;
  overflow: hidden;
}

.map-filter-banner.is-active {
  grid-template-rows: 1fr;
  opacity: 1;
  margin-bottom: 1rem;
}

.map-filter-flip {
  perspective: 600px;
}

.map-flip-enter-active,
.map-flip-leave-active {
  transition:
    transform 240ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity 160ms ease;
  transform-style: preserve-3d;
  backface-visibility: hidden;
  will-change: transform, opacity;
}

.map-flip-enter-from {
  transform: rotateX(-90deg);
  opacity: 0;
}

.map-flip-leave-to {
  transform: rotateX(90deg);
  opacity: 0;
}

.server-info-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid hsl(var(--border) / 0.6);
  border-radius: var(--radius);
  background: linear-gradient(
    180deg,
    hsl(var(--card) / 0.35),
    hsl(var(--card) / 0.1)
  );
  padding: 0.875rem 1rem 0.5rem;
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.server-info-panel:hover {
  border-color: hsl(var(--tac-amber) / 0.35);
}

.server-info-panel__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: hsl(var(--foreground));
}

.server-info-panel__tick {
  width: 2px;
  height: 0.7rem;
  background: hsl(var(--tac-amber));
}

.server-info-panel__list {
  display: flex;
  flex-direction: column;
}

.server-info-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid hsl(var(--border) / 0.3);
}

.server-info-row:last-child {
  border-bottom: 0;
}

.server-info-row__label {
  flex: 1 1 auto;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  line-height: 1.3;
  color: hsl(var(--muted-foreground) / 0.85);
}

.server-info-row__value {
  flex: 0 0 auto;
  text-align: right;
  font-size: 0.8rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}
</style>

<script lang="ts">
import {
  $,
  order_by,
  e_match_map_status_enum,
  e_match_status_enum,
  e_player_roles_enum,
} from "~/generated/zeus";
import {
  generateMutation,
  generateQuery,
  generateSubscription,
} from "~/graphql/graphqlGen";
import { matchMapStats } from "~/graphql/matchMapStatsGraphql";
import { matchAllMapsStats } from "~/graphql/matchAllMapsStatsGraphql";
import { trackMatchBackupRounds } from "~/composables/useMatchBackupRounds";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import * as z from "zod";
import {
  getRouteTabValue,
  normalizeRouteTab,
  replaceRouteTab,
} from "~/composables/useRouteTab";

// Hasura subscriptions require one top-level field, so we query the
// match_lineups list and split by id client-side.
const allMapsStatsSubscription = generateSubscription({
  match_lineups: [
    { where: { id: { _in: $("lineup_ids", "[uuid!]!") } } },
    matchAllMapsStats,
  ],
});

const allMapsStatsQuery = generateQuery({
  match_lineups: [
    { where: { id: { _in: $("lineup_ids", "[uuid!]!") } } },
    matchAllMapsStats,
  ],
});

enum AvailableCommands {
  Pause = "css_pause",
  Resume = "css_resume",
  SkipKnife = "skip_knife",
  ForceReady = "force_ready",
  Knife = "match_state Knife",
  Warmup = "match_state Warmup",
}

const CommandDetails = {
  [AvailableCommands.Pause]: {
    display: "match.commands.pause_match",
    value: AvailableCommands.Pause,
  },
  [AvailableCommands.Resume]: {
    display: "match.commands.resume_match",
    value: AvailableCommands.Resume,
  },
  [AvailableCommands.SkipKnife]: {
    display: "match.commands.skip_knife",
    value: AvailableCommands.SkipKnife,
  },
  [AvailableCommands.ForceReady]: {
    display: "match.commands.force_ready",
    value: AvailableCommands.ForceReady,
  },
  [AvailableCommands.Knife]: {
    display: "match.commands.reset_to_knife",
    value: AvailableCommands.Knife,
    confirm: true,
  },
  [AvailableCommands.Warmup]: {
    display: "match.commands.reset_to_warmup",
    value: AvailableCommands.Warmup,
    confirm: true,
  },
};

export default {
  emits: ["clear-active-map", "select-map"],
  props: {
    match: {
      type: Object,
      required: true,
    },
    activeMap: {
      type: Object as () => {
        id: string;
        map: { name: string };
        lineup_1_score?: number;
        lineup_2_score?: number;
      } | null,
      default: null,
    },
  },
  data() {
    return {
      activeTab: "scoreboard",
      scoreboardLens: "general",
      mapStats: null as null | { lineup_1: any; lineup_2: any },
      mapStatsLoading: false,
      allMapsStats: null as null | { lineup_1: any; lineup_2: any },
      hasLogs: false,
      showConfirmDialog: false,
      showRebootDialog: false,
      pendingCommand: null as
        | undefined
        | { value: string; display: string; confirm: boolean },
      executePending: undefined as undefined | (() => void),
      cleanMapName,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            round: z.string(),
          }),
        ),
      }),
    };
  },
  apollo: {
    $subscribe: {
      allMapsStats: {
        variables() {
          return {
            matchId: this.match.id,
            lineup_ids: [this.match.lineup_1_id, this.match.lineup_2_id],
            order_by_name: order_by.asc,
          };
        },
        skip() {
          // Per-map view uses mapStats; terminal matches use a one-shot query.
          return (
            !!this.activeMap ||
            this.isMatchTerminal ||
            !this.match.lineup_1_id ||
            !this.match.lineup_2_id
          );
        },
        query: allMapsStatsSubscription,
        result({ data }) {
          if (!data) return;
          const rows = data.match_lineups ?? [];
          this.allMapsStats = {
            lineup_1:
              rows.find((r: any) => r.id === this.match.lineup_1_id) ?? null,
            lineup_2:
              rows.find((r: any) => r.id === this.match.lineup_2_id) ?? null,
          };
        },
      },
    },
  },
  watch: {
    activeMap: {
      immediate: true,
      handler(map, prev) {
        if (map) {
          void this.fetchMapStats();
          const statsTabs = [
            "scoreboard",
            "economy",
            "clutches",
            "head-to-head",
            "roles",
            "map-analysis",
          ];
          if (!prev && !statsTabs.includes(this.activeTab)) {
            this.activeTab = "scoreboard";
          }
        } else {
          this.mapStats = null;
          if (this.isMatchTerminal) {
            void this.fetchAllMapsStats();
          }
        }
      },
    },
    isMatchTerminal: {
      immediate: true,
      handler(terminal) {
        if (terminal && !this.activeMap) {
          void this.fetchAllMapsStats();
        }
      },
    },
    "activeMap.id"() {
      if (this.activeMap) {
        void this.fetchMapStats();
      }
    },
    activeTab(newTab) {
      if (!this.availableMatchTabs.includes(newTab)) {
        return;
      }

      void replaceRouteTab(this.$router, this.$route, newTab, "scoreboard");
    },
    "$route.query.tab": {
      immediate: true,
      handler() {
        this.syncActiveTabFromRoute();
      },
    },
    availableMatchTabs: {
      immediate: true,
      handler() {
        this.syncActiveTabFromRoute();
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    scoreboardLenses() {
      return [
        { value: "general", labelKey: "match.tabs.general" },
        { value: "aim", labelKey: "match.tabs.aim_stats" },
        { value: "trades", labelKey: "match.tabs.trade_stats" },
        { value: "utility", labelKey: "match.tabs.utility" },
        { value: "opening", labelKey: "match.tabs.opening_duels" },
      ];
    },
    effectiveScoreboardLens() {
      return this.disableStats ? "general" : this.scoreboardLens;
    },
    isOpsTabActive() {
      return ["settings", "streams", "server"].includes(this.activeTab);
    },
    mapScopedMatch() {
      if (!this.activeMap) return this.match;
      const scopedMap = this.match.match_maps?.find(
        (m: any) => m.id === this.activeMap!.id,
      );
      return {
        ...this.match,
        match_maps: scopedMap ? [scopedMap] : [this.activeMap],
      };
    },
    activeLineup1() {
      if (this.activeMap && this.mapStats?.lineup_1) {
        return this.mapStats.lineup_1;
      }
      if (!this.activeMap && this.allMapsStats?.lineup_1) {
        // Keep shell fields (team, captain flags, is_ready); add stats players.
        return {
          ...this.match.lineup_1,
          ...this.allMapsStats.lineup_1,
        };
      }
      return this.match.lineup_1;
    },
    activeLineup2() {
      if (this.activeMap && this.mapStats?.lineup_2) {
        return this.mapStats.lineup_2;
      }
      if (!this.activeMap && this.allMapsStats?.lineup_2) {
        return {
          ...this.match.lineup_2,
          ...this.allMapsStats.lineup_2,
        };
      }
      return this.match.lineup_2;
    },
    statsEligibleMaps() {
      return (this.match.match_maps ?? []).filter(
        (m: any) => m.status !== e_match_status_enum.Scheduled,
      );
    },
    // True when the aim stats in view come from a map whose demo could not be
    // line-of-sight validated (no collision mesh) — drives the "Estimated"
    // badge. Only flags an explicit false; null (not yet reparsed) is left
    // unflagged to avoid noise.
    aimEstimated() {
      const relevant = this.activeMap
        ? (this.match.match_maps ?? []).filter(
            (m: any) => m.id === this.activeMap!.id,
          )
        : this.statsEligibleMaps;
      return relevant.some((m: any) =>
        (m.demos ?? []).some((d: any) => d.geometry_validated === false),
      );
    },
    showStatsControls() {
      return !this.disableStats;
    },
    mapSelectValue() {
      return this.activeMap?.id ?? "__all__";
    },
    isMatchTerminal() {
      return [
        e_match_status_enum.Finished,
        e_match_status_enum.Forfeit,
        e_match_status_enum.Surrendered,
        e_match_status_enum.Tie,
        e_match_status_enum.Canceled,
      ].includes(this.match.status);
    },
    canConfigureStreams() {
      if (this.isMatchTerminal) {
        return false;
      }

      return (
        this.match.is_organizer ||
        useAuthStore().isRoleAbove(e_player_roles_enum.streamer)
      );
    },
    disableStats() {
      if (
        [
          e_match_status_enum.PickingPlayers,
          e_match_status_enum.Scheduled,
          e_match_status_enum.Veto,
          e_match_status_enum.WaitingForCheckIn,
        ].includes(this.match.status)
      ) {
        return true;
      }
      // The detail tabs read per-event/economy data that's hidden (anti-cheat)
      // until a map is finished — so until at least one map is over there's
      // nothing to show; only Overview/Settings/Streams/Admin remain. Per-map,
      // so a finished map in a live Bo3 already unlocks them.
      const hasFinishedMap = (this.match.match_maps ?? []).some((m: any) =>
        [
          e_match_map_status_enum.Finished,
          e_match_map_status_enum.Surrendered,
        ].includes(m.status),
      );
      return !hasFinishedMap;
    },
    showMatchSettingsForm() {
      return ![
        e_match_status_enum.Finished,
        e_match_status_enum.Forfeit,
        e_match_status_enum.Surrendered,
        e_match_status_enum.Tie,
      ].includes(this.match.status);
    },
    displayServerInformation() {
      return [
        e_match_status_enum.Live,
        e_match_status_enum.Veto,
        e_match_status_enum.Scheduled,
        e_match_status_enum.WaitingForServer,
        e_match_status_enum.WaitingForCheckIn,
        e_match_status_enum.PickingPlayers,
      ].includes(this.match.status);
    },
    currentMap() {
      return this.match.match_maps.find((match_map) => {
        return match_map.is_current_map;
      });
    },
    backupRounds() {
      return this.backupRoundsTracker?.rounds.value ?? [];
    },
    availableCommands() {
      const commands = [];

      switch (this.currentMap?.status) {
        case e_match_map_status_enum.Warmup:
        case e_match_map_status_enum.Scheduled:
          commands.push(CommandDetails[AvailableCommands.ForceReady]);
          break;
        case e_match_map_status_enum.Knife:
          commands.push(CommandDetails[AvailableCommands.SkipKnife]);
          commands.push(CommandDetails[AvailableCommands.Warmup]);
          break;
        case e_match_map_status_enum.Paused:
          commands.push(CommandDetails[AvailableCommands.Resume]);
          commands.push(CommandDetails[AvailableCommands.Warmup]);
          commands.push(CommandDetails[AvailableCommands.Knife]);
          break;
        case e_match_map_status_enum.Live:
        case e_match_map_status_enum.Overtime:
          commands.push(CommandDetails[AvailableCommands.Pause]);
          break;
      }

      return commands;
    },
    canViewAdmin() {
      return this.match.is_organizer;
    },
    canViewMatchServerLogs() {
      return [
        e_match_status_enum.Live,
        e_match_status_enum.Finished,
        e_match_status_enum.Forfeit,
        e_match_status_enum.Surrendered,
        e_match_status_enum.Tie,
        e_match_status_enum.Canceled,
      ].includes(this.match.status);
    },
    canSendRCONCommands() {
      return [
        e_match_status_enum.Live,
        e_match_status_enum.PickingPlayers,
        e_match_status_enum.Scheduled,
        e_match_status_enum.Veto,
        e_match_status_enum.WaitingForCheckIn,
        e_match_status_enum.WaitingForServer,
      ].includes(this.match.status)
        ? !!this.match.server_id
        : false;
    },
    canAdjustLineups() {
      if (
        this.match.status !== e_match_status_enum.PickingPlayers ||
        !this.match.is_organizer
      ) {
        return false;
      }

      if (
        this.match.lineup_1.lineup_players.length <
          this.match.min_players_per_lineup ||
        this.match.lineup_2.lineup_players.length <
          this.match.min_players_per_lineup
      ) {
        return false;
      }

      return true;
    },
    availableMatchTabs() {
      const tabs = ["scoreboard"];

      if (!this.disableStats) {
        tabs.push("economy");

        if (this.match.options.type !== e_match_types_enum.Duel) {
          tabs.push("clutches");
        }

        tabs.push("head-to-head", "roles", "map-analysis");
      }

      tabs.push("settings");

      if (this.canConfigureStreams) {
        tabs.push("streams");
      }

      if (this.canViewAdmin) {
        tabs.push("server");
      }

      return tabs;
    },
  },
  created() {
    // Shared with MatchAdminBottomBar so we don't open two identical
    // v_match_map_backup_rounds websockets for the same current map.
    this.backupRoundsTracker = trackMatchBackupRounds(
      () => this.currentMap?.id,
    );
  },
  beforeUnmount() {
    this.backupRoundsTracker?.stop();
  },
  methods: {
    openStatsGuide() {
      window.open(
        "/stats-guide",
        "5stack-stats-guide",
        "popup,width=900,height=850",
      );
    },
    onMapSelect(value: string) {
      if (!value || value === "__all__") {
        this.$emit("clear-active-map");
        return;
      }
      const map = this.match.match_maps?.find((m: any) => m.id === value);
      if (map) {
        this.$emit("select-map", map);
      }
    },
    async fetchAllMapsStats() {
      if (!this.match.lineup_1_id || !this.match.lineup_2_id) return;
      const { data } = await this.$apollo.query({
        variables: {
          matchId: this.match.id,
          lineup_ids: [this.match.lineup_1_id, this.match.lineup_2_id],
          order_by_name: order_by.asc,
        },
        fetchPolicy: "network-only",
        query: allMapsStatsQuery,
      });
      if (!data) return;
      const rows = data.match_lineups ?? [];
      this.allMapsStats = {
        lineup_1:
          rows.find((r: any) => r.id === this.match.lineup_1_id) ?? null,
        lineup_2:
          rows.find((r: any) => r.id === this.match.lineup_2_id) ?? null,
      };
    },
    async fetchMapStats() {
      if (!this.activeMap) return;
      const requestedMapId = this.activeMap.id;
      this.mapStatsLoading = true;
      try {
        const { data } = await this.$apollo.query({
          variables: {
            matchId: this.match.id,
            matchMapId: requestedMapId,
            order_by_name: order_by.asc,
          },
          fetchPolicy: "network-only",
          query: generateQuery({
            matches_by_pk: [
              { id: $("matchId", "uuid!") },
              {
                lineup_1: [{}, matchMapStats],
                lineup_2: [{}, matchMapStats],
              },
            ],
          }),
        });
        if (this.activeMap?.id !== requestedMapId) return;
        this.mapStats = data?.matches_by_pk ?? null;
      } finally {
        this.mapStatsLoading = false;
      }
    },
    syncActiveTabFromRoute() {
      // Legacy URLs pointed at the per-view tabs now folded into Scoreboard —
      // map them to the matching lens so old bookmarks don't dead-end.
      const legacyLensMap: Record<string, string> = {
        overview: "general",
        utility: "utility",
        "aim-stats": "aim",
        "trade-stats": "trades",
        "opening-duels": "opening",
      };
      const rawTab = this.$route.query.tab;
      if (typeof rawTab === "string" && rawTab in legacyLensMap) {
        this.scoreboardLens = legacyLensMap[rawTab];
        this.activeTab = "scoreboard";
        void replaceRouteTab(
          this.$router,
          this.$route,
          "scoreboard",
          "scoreboard",
        );
        return;
      }

      const activeTab = getRouteTabValue(
        this.$route,
        this.availableMatchTabs,
        "scoreboard",
      );

      if (this.activeTab !== activeTab) {
        this.activeTab = activeTab;
      }

      void normalizeRouteTab(
        this.$router,
        this.$route,
        this.availableMatchTabs,
        "scoreboard",
      );
    },
    confirmCommand(
      command: {
        value: string;
        display: string;
        confirm: boolean;
      },
      send,
    ) {
      this.pendingCommand = command;
      this.executePending = () => send(command.value, "");
      this.showConfirmDialog = true;
    },
    async swapLineups() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          swapLineups: [
            {
              match_id: this.match.id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
    async randomizeTeams() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          randomizeTeams: [
            {
              match_id: this.match.id,
            },
            {
              success: true,
            },
          ],
        }),
      });
    },
  },
};
</script>
