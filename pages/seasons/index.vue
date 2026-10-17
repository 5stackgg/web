<script setup lang="ts">
import {
  CalendarIcon,
  CirclePause,
  CircleStop,
  History,
  Infinity as InfinityIcon,
  Medal,
  Plus,
  RotateCcw,
  Swords,
  Trash2,
  TriangleAlert,
  Trophy,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import HeightGlide from "~/components/ui/transitions/HeightGlide.vue";
import ManageSection from "~/components/common/ManageSection.vue";
import StatTile from "~/components/admin/StatTile.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import { TONE_BORDER, TONE_TEXT } from "~/components/admin/tone";
import SectionEmpty from "~/components/common/SectionEmpty.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import AwardComposer from "~/components/award/AwardComposer.vue";
import SeasonRebuildProgress from "~/components/seasons/SeasonRebuildProgress.vue";
import SeasonRebuildButton from "~/components/seasons/SeasonRebuildButton.vue";
import SeasonCountdown from "~/components/seasons/SeasonCountdown.vue";
import SeasonCreateForm from "~/components/seasons/SeasonCreateForm.vue";
import { useSeasonBackfill } from "~/composables/useSeasonBackfill";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

definePageMeta({
  middleware: "admin",
});

// Shared singleton; also used from the Options API block via useSeasonBackfill().
const backfill = useSeasonBackfill();
const { isRebuilding } = backfill;

const awardComposerSeasonId = ref<string | null>(null);
function openAwardComposer(seasonId: string) {
  awardComposerSeasonId.value = seasonId;
}

const pillClasses =
  "inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-[5px] border px-1.5 text-[11px] font-semibold";
const warnPillClasses = [
  pillClasses,
  TONE_BORDER.warn,
  TONE_TEXT.warn,
  "bg-warning/10",
];
const warnBannerClasses = [
  "flex flex-wrap items-center gap-3 rounded-lg border bg-warning/[0.06] px-3.5 py-2.5 text-[0.8rem]",
  TONE_BORDER.warn,
];
// Quiet danger rows, the way Regions and Alerts end: a hairline, what it
// does, and a ghost red button that confirms in a dialog.
const dangerRowClasses =
  "flex items-center justify-between gap-4 border-t border-border/60 pt-4";
const dangerButtonClasses =
  "h-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive";
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.seasons.title") }}</h1>

  <PageTransition :delay="0">
    <div v-if="loaded" class="grid w-full max-w-[880px] gap-5">
      <Transition name="season-fade">
        <div v-if="staleOthers.length" :class="warnBannerClasses">
          <TriangleAlert class="h-4 w-4 shrink-0" :class="TONE_TEXT.warn" />
          <span class="min-w-0 flex-1">
            {{
              $t(
                "pages.seasons.banner.stale",
                {
                  seasons: listNames(staleOthers),
                  count: staleOthers.length,
                },
                staleOthers.length,
              )
            }}
            <template v-if="rebuildingSeason">
              {{
                $t("pages.seasons.banner.rebuilding_now", {
                  season: seasonTitle(rebuildingSeason),
                })
              }}
            </template>
          </span>
          <SeasonRebuildButton
            v-if="staleOthers.length === 1"
            :season-id="staleOthers[0].id"
            :label="$t('pages.seasons.rebuild_elo')"
            @rebuild="confirmRebuild(staleOthers[0].id)"
          />
        </div>
      </Transition>

      <!-- What a season is for, before what this one is doing. -->
      <section
        class="grid gap-x-6 gap-y-3 border-b border-border/60 pb-5 sm:grid-cols-2"
        :aria-label="$t('pages.seasons.about.label')"
      >
        <div
          v-for="point in [
            { icon: RotateCcw, key: 'reset' },
            { icon: Swords, key: 'counts' },
            { icon: Trophy, key: 'awards' },
            { icon: History, key: 'history' },
          ]"
          :key="point.key"
          class="flex gap-3"
        >
          <component
            :is="point.icon"
            class="mt-0.5 size-4 shrink-0 text-[hsl(var(--tac-amber))]"
          />
          <div class="min-w-0">
            <div class="text-sm font-medium">
              {{ $t(`pages.seasons.about.${point.key}_title`) }}
            </div>
            <p class="text-[0.8rem] leading-snug text-muted-foreground">
              {{ $t(`pages.seasons.about.${point.key}_body`) }}
            </p>
          </div>
        </div>
      </section>

      <div class="grid gap-8">
        <div>
          <HeightGlide>
            <div class="season-swap">
              <Transition name="season-swap">
                <div
                  v-if="activeSeason"
                  :key="activeSeason.id"
                  class="grid gap-4"
                >
                  <div class="flex flex-wrap items-center gap-2.5">
                    <h2 class="m-0 text-[26px] font-bold leading-tight">
                      {{ seasonTitle(activeSeason) }}
                    </h2>
                    <!-- Active for weeks, not happening this second: a still
                         dot, no ping. -->
                    <span
                      :class="[
                        pillClasses,
                        TONE_BORDER.ok,
                        TONE_TEXT.ok,
                        'bg-success/10',
                      ]"
                    >
                      <StatusDot tone="ok" size="sm" />
                      {{ $t("pages.seasons.active") }}
                    </span>
                    <span
                      v-if="
                        activeSeason.needs_rebuild &&
                        !isRebuilding(activeSeason.id)
                      "
                      :class="warnPillClasses"
                    >
                      <TriangleAlert class="h-3 w-3" />
                      {{ $t("pages.seasons.hero.rebuild_required") }}
                    </span>
                  </div>

                  <p
                    v-if="activeSeason.description"
                    class="-mt-2 max-w-[70ch] text-sm text-muted-foreground"
                  >
                    {{ activeSeason.description }}
                  </p>

                  <div class="grid gap-2 sm:grid-cols-3">
                    <StatTile
                      :label="
                        activeSeason.ends_at
                          ? $t('pages.seasons.hero.ends_in')
                          : $t('pages.seasons.hero.running_for')
                      "
                    >
                      <SeasonCountdown
                        v-if="activeSeason.ends_at"
                        :ends-at="activeSeason.ends_at"
                        @elapsed="now = Date.now()"
                      />
                      <template v-else>{{
                        $t(
                          "pages.seasons.hero.days",
                          { count: dayOf(activeSeason) },
                          dayOf(activeSeason),
                        )
                      }}</template>
                    </StatTile>
                    <StatTile
                      :label="$t('pages.seasons.hero.started')"
                      :value="formatDate(activeSeason.starts_at)"
                    />
                    <StatTile :label="$t('pages.seasons.hero.ends')">
                      <template v-if="activeSeason.ends_at">{{
                        formatDate(activeSeason.ends_at)
                      }}</template>
                      <span v-else class="text-muted-foreground">{{
                        $t("pages.seasons.ongoing")
                      }}</span>
                    </StatTile>
                  </div>

                  <div v-if="activeSeason.ends_at" class="grid gap-1.5">
                    <div class="h-1.5 overflow-hidden rounded-full bg-muted/50">
                      <div
                        class="h-full origin-left rounded-full bg-[hsl(var(--tac-amber))] transition-transform duration-500 ease-out motion-reduce:transition-none"
                        :style="{
                          transform: `scaleX(${(progressOf(activeSeason) ?? 0) / 100})`,
                        }"
                      ></div>
                    </div>
                    <div
                      class="flex justify-between text-xs tabular-nums text-muted-foreground"
                    >
                      <span>{{
                        $t("pages.seasons.hero.day_of", {
                          day: dayOf(activeSeason),
                          total: lengthOf(activeSeason),
                        })
                      }}</span>
                      <span>{{
                        $t("pages.seasons.hero.percent_through", {
                          percent: Math.round(progressOf(activeSeason) ?? 0),
                        })
                      }}</span>
                    </div>
                  </div>

                  <Transition name="season-fade">
                    <div
                      v-if="
                        activeSeason.needs_rebuild &&
                        !isRebuilding(activeSeason.id)
                      "
                      :class="warnBannerClasses"
                    >
                      <TriangleAlert
                        class="h-4 w-4 shrink-0"
                        :class="TONE_TEXT.warn"
                      />
                      <span class="min-w-0 flex-1">{{
                        $t("pages.seasons.needs_rebuild_notice")
                      }}</span>
                      <SeasonRebuildButton
                        :season-id="activeSeason.id"
                        :label="$t('pages.seasons.rebuild_elo')"
                        @rebuild="confirmRebuild(activeSeason.id)"
                      />
                    </div>
                  </Transition>

                  <SeasonRebuildProgress :season-id="activeSeason.id" />

                  <div class="flex flex-wrap gap-2">
                    <Popover v-model:open="startPickerOpen">
                      <PopoverTrigger as-child>
                        <Button variant="outline" size="sm">
                          <CalendarIcon />
                          {{ $t("pages.seasons.hero.change_start") }}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent class="w-auto p-0">
                        <p class="px-3 pt-3 text-xs text-muted-foreground">
                          {{ $t("pages.seasons.hero.start_caption") }}
                        </p>
                        <Calendar
                          :model-value="editStartDate"
                          :is-date-disabled="editStartDisabled"
                          initial-focus
                          @update:model-value="onEditStartDate"
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover v-model:open="endPickerOpen">
                      <PopoverTrigger as-child>
                        <Button variant="outline" size="sm">
                          <CalendarIcon />
                          {{
                            activeSeason.ends_at
                              ? $t("pages.seasons.hero.change_end")
                              : $t("pages.seasons.hero.set_end")
                          }}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent class="w-auto p-0">
                        <p class="px-3 pt-3 text-xs text-muted-foreground">
                          {{ $t("pages.seasons.hero.end_caption") }}
                        </p>
                        <Calendar
                          :model-value="editEndDate"
                          :is-date-disabled="editEndDisabled"
                          initial-focus
                          @update:model-value="onEditEndDate"
                        />
                      </PopoverContent>
                    </Popover>
                    <Button
                      v-if="activeSeason.ends_at"
                      variant="outline"
                      size="sm"
                      @click="makeOngoing(activeSeason.id)"
                    >
                      <InfinityIcon />
                      {{ $t("pages.seasons.hero.make_ongoing") }}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      @click="openAwardComposer(activeSeason.id)"
                    >
                      <Medal />
                      {{ $t("pages.seasons.hero.grant_award") }}
                    </Button>
                    <SeasonRebuildButton
                      v-if="!activeSeason.needs_rebuild"
                      variant="ghost"
                      :season-id="activeSeason.id"
                      :label="$t('pages.seasons.rebuild_elo')"
                      @rebuild="confirmRebuild(activeSeason.id)"
                    />
                  </div>

                  <div class="grid gap-4 pt-1">
                    <div :class="dangerRowClasses">
                      <p
                        class="min-w-0 max-w-[64ch] text-xs text-muted-foreground"
                      >
                        {{ $t("pages.seasons.danger.end_description") }}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        :class="dangerButtonClasses"
                        @click="openEndNow(activeSeason)"
                      >
                        <CircleStop class="size-3.5" />
                        {{ $t("pages.seasons.danger.end_button") }}
                      </Button>
                    </div>
                    <div :class="dangerRowClasses">
                      <p
                        class="min-w-0 max-w-[64ch] text-xs text-muted-foreground"
                      >
                        {{ $t("pages.seasons.danger.delete_description") }}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        :class="dangerButtonClasses"
                        @click="confirmDelete(activeSeason)"
                      >
                        <Trash2 class="size-3.5" />
                        {{ $t("pages.seasons.danger.delete_button") }}
                      </Button>
                    </div>
                  </div>
                </div>

                <div v-else-if="seasons.length" key="off" class="grid gap-3">
                  <div class="flex flex-wrap items-center gap-2.5">
                    <h2 class="m-0 text-[26px] font-bold leading-tight">
                      {{ $t("pages.seasons.off.title") }}
                    </h2>
                    <span :class="warnPillClasses">
                      <CirclePause class="h-3 w-3" />
                      {{ $t("pages.seasons.off.pill") }}
                    </span>
                  </div>
                  <p class="max-w-[66ch] text-sm text-muted-foreground">
                    {{ offSeasonText }}
                  </p>
                </div>

                <SectionEmpty
                  v-else
                  key="empty"
                  :title="$t('pages.seasons.empty_state.title')"
                  :description="$t('pages.seasons.empty_state.description')"
                />
              </Transition>
            </div>
          </HeightGlide>
        </div>

        <!-- ===== Next season ===== -->
        <ManageSection>
          <div>
            <div class="flex min-h-8 items-end justify-between gap-4">
              <div class="grid gap-1">
                <div :class="[tacticalSectionLabelClasses, 'mb-0']">
                  <span :class="tacticalSectionTickClasses"></span>
                  {{
                    seasons.length
                      ? $t("pages.seasons.next.label")
                      : $t("pages.seasons.next.first_label")
                  }}
                </div>
                <p
                  v-if="!nextOpen && nextHintText"
                  class="text-xs text-muted-foreground/70"
                >
                  {{ nextHintText }}
                </p>
              </div>
              <Button
                v-if="!nextOpen"
                variant="outline"
                size="sm"
                class="shrink-0"
                @click="scheduleOpen = true"
              >
                <Plus />
                {{
                  $t("pages.seasons.next.schedule", {
                    season: $t("pages.seasons.season_number", {
                      number: seasons.length + 1,
                    }),
                  })
                }}
              </Button>
            </div>
            <Fold :open="nextOpen">
              <div class="pt-4">
                <SeasonCreateForm
                  :seasons="seasons"
                  :now="now"
                  :cancelable="!mustPlan"
                  @created="scheduleOpen = false"
                  @cancel="scheduleOpen = false"
                />
              </div>
            </Fold>
          </div>
        </ManageSection>

        <!-- ===== Ledger (upcoming + past) ===== -->
        <ManageSection
          v-if="ledgerSeasons.length"
          :label="$t('pages.seasons.ledger.label')"
        >
          <TransitionGroup tag="div" name="season-row" class="grid">
            <div
              v-for="season in ledgerSeasons"
              :key="season.id"
              class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-border/60 py-3 last:border-b-0"
            >
              <span
                class="grid h-10 w-10 place-items-center rounded-lg border border-border bg-muted/40 text-[12.5px] font-bold tabular-nums text-muted-foreground"
                :class="{ 'border-dashed': season.__upcoming }"
                >S{{ season.number ?? "?" }}</span
              >
              <div class="grid min-w-0 gap-0.5">
                <span class="flex flex-wrap items-center gap-2 font-semibold">
                  {{ seasonTitle(season) }}
                  <span
                    class="text-xs font-medium"
                    :class="
                      season.__upcoming
                        ? TONE_TEXT.amber
                        : 'text-muted-foreground/70'
                    "
                    >{{
                      season.__upcoming
                        ? $t("pages.seasons.upcoming")
                        : $t("pages.seasons.ended")
                    }}</span
                  >
                  <span
                    v-if="season.needs_rebuild && !isRebuilding(season.id)"
                    :class="warnPillClasses"
                  >
                    <TriangleAlert class="h-3 w-3" />
                    {{ $t("pages.seasons.hero.rebuild_required") }}
                  </span>
                </span>
                <span
                  class="truncate text-[0.8rem] tabular-nums text-muted-foreground"
                >
                  {{ formatDate(season.starts_at) }} →
                  {{
                    season.ends_at
                      ? formatDate(season.ends_at)
                      : $t("pages.seasons.ongoing")
                  }}
                  <template v-if="season.ends_at">
                    · {{ lengthText(season) }}</template
                  ><template v-if="season.description">
                    · {{ season.description }}</template
                  >
                </span>
                <div class="empty:hidden [&>*]:mt-2">
                  <SeasonRebuildProgress :season-id="season.id" />
                </div>
              </div>
              <div class="flex items-center gap-1">
                <SeasonRebuildButton
                  v-if="season.needs_rebuild"
                  size="xs"
                  :season-id="season.id"
                  :label="$t('pages.seasons.rebuild')"
                  @rebuild="confirmRebuild(season.id)"
                />
                <SeasonRebuildButton
                  v-else
                  icon-only
                  variant="ghost"
                  size="icon-sm"
                  :season-id="season.id"
                  :label="$t('pages.seasons.rebuild_elo')"
                  @rebuild="confirmRebuild(season.id)"
                />
                <FiveStackToolTip as-child :tap-toggle="false">
                  <template #trigger>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-muted-foreground hover:text-destructive"
                      :aria-label="$t('common.delete')"
                      @click="confirmDelete(season)"
                    >
                      <Trash2 />
                    </Button>
                  </template>
                  {{ $t("common.delete") }}
                </FiveStackToolTip>
              </div>
            </div>
          </TransitionGroup>
        </ManageSection>
      </div>
    </div>
  </PageTransition>

  <!-- ===== Rebuild confirm ===== -->
  <AlertDialog v-model:open="showRebuildConfirm">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ $t("pages.seasons.rebuild_confirm_title") }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.seasons.rebuild_confirm_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <AlertDialogAction @click="doRebuild">
          {{ $t("pages.seasons.rebuild_elo") }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- ===== Delete confirm ===== -->
  <AlertDialog v-model:open="deleteOpen">
    <AlertDialogContent v-if="deleteSeason">
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{
            $t("pages.seasons.danger.delete_confirm_title", {
              season: seasonTitle(deleteSeason),
            })
          }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.seasons.delete_confirm_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <!-- Plain Button: AlertDialogAction closes before the delete lands. -->
        <Button variant="destructive" @click="doDelete">
          {{
            $t("pages.seasons.danger.delete_confirm_button", {
              season: seasonTitle(deleteSeason),
            })
          }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- ===== End now confirm ===== -->
  <AlertDialog v-model:open="endOpen">
    <AlertDialogContent v-if="endSeason">
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{
            $t("pages.seasons.danger.end_confirm_title", {
              season: seasonTitle(endSeason),
            })
          }}
        </AlertDialogTitle>
        <AlertDialogDescription as-child>
          <div class="grid gap-2.5 text-sm text-muted-foreground">
            <p>
              {{
                endSeason.ends_at
                  ? $t("pages.seasons.danger.end_confirm_instead", {
                      today: formatDate(new Date(now).toISOString()),
                      date: formatDate(endSeason.ends_at),
                    })
                  : $t("pages.seasons.danger.end_confirm_today", {
                      today: formatDate(new Date(now).toISOString()),
                    })
              }}
            </p>
            <ul class="m-0 grid list-disc gap-1 pl-[18px]">
              <li>{{ $t("pages.seasons.danger.end_confirm_awards") }}</li>
              <li>
                {{
                  seasonAfterEnd
                    ? $t("pages.seasons.danger.end_confirm_gap_next", {
                        season: seasonTitle(seasonAfterEnd),
                        date: formatDate(seasonAfterEnd.starts_at),
                      })
                    : $t("pages.seasons.danger.end_confirm_gap_none")
                }}
              </li>
              <li>{{ $t("pages.seasons.danger.end_confirm_elo") }}</li>
            </ul>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <label class="grid gap-1.5 text-xs text-muted-foreground">
        <i18n-t keypath="pages.seasons.danger.type_to_confirm" tag="span">
          <template #phrase>
            <b class="font-semibold text-foreground">{{
              seasonTitle(endSeason)
            }}</b>
          </template>
        </i18n-t>
        <Input
          v-model="endTyped"
          spellcheck="false"
          :placeholder="seasonTitle(endSeason)"
          @keydown.enter.prevent="endTypedMatches && endNow()"
        />
      </label>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
        <Button
          variant="destructive"
          :disabled="!endTypedMatches"
          @click="endNow"
        >
          {{
            $t("pages.seasons.danger.end_confirm_button", {
              season: seasonTitle(endSeason),
            })
          }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <AwardComposer
    v-if="awardComposerSeasonId"
    :open="!!awardComposerSeasonId"
    :season-id="awardComposerSeasonId"
    @update:open="
      (v) => (awardComposerSeasonId = v ? awardComposerSeasonId : null)
    "
  />
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { order_by } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { CalendarDate } from "@internationalized/date";
import { useSeasonBackfill } from "~/composables/useSeasonBackfill";
import { dateLocale } from "~/utilities/dateLocale";
import {
  activeSeason as findActiveSeason,
  daysUntil,
  mustPlanNext,
  nextSeasonHint,
  overlapsSeason,
  pastSeasons,
  seasonDay,
  seasonLengthDays,
  seasonProgress,
  upcomingSeasons,
} from "~/components/seasons/seasonPhase";

type Season = {
  id: string;
  number: number | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  needs_rebuild: boolean;
};

type DateValue = { year: number; month: number; day: number };

const toMs = (d: DateValue) => Date.UTC(d.year, d.month - 1, d.day);

function cdFromIso(iso: string): CalendarDate {
  const d = new Date(iso);
  return new CalendarDate(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
  );
}

export default {
  apollo: {
    $subscribe: {
      seasons: {
        query: typedGql("subscription")({
          seasons: [
            {
              order_by: [{ starts_at: order_by.desc }],
            },
            {
              id: true,
              number: true,
              description: true,
              starts_at: true,
              ends_at: true,
              created_at: true,
              needs_rebuild: true,
            },
          ],
        }),
        result: function ({ data }: { data: any }) {
          this.seasons = data.seasons || [];
          this.loaded = true;
        },
      },
    },
  },
  data() {
    return {
      seasons: [] as Season[],
      loaded: false,
      // Day-level clock for status, progress and "day N"; the countdown keeps
      // its own second-level clock and nudges this one when it runs out.
      now: Date.now(),
      nowTimer: null as ReturnType<typeof setInterval> | null,
      scheduleOpen: false,
      startPickerOpen: false,
      endPickerOpen: false,
      showRebuildConfirm: false,
      rebuildSeasonId: null as string | null,
      // Snapshots, so a dialog keeps its text while it animates shut.
      deleteSeason: null as Season | null,
      deleteOpen: false,
      endSeason: null as Season | null,
      endOpen: false,
      endTyped: "",
    };
  },
  computed: {
    activeSeason(): Season | null {
      return findActiveSeason(this.seasons, this.now);
    },
    ledgerSeasons(): Array<Season & { __upcoming: boolean }> {
      return [
        ...upcomingSeasons(this.seasons, this.now)
          .reverse()
          .map((s) => ({ ...s, __upcoming: true })),
        ...pastSeasons(this.seasons, this.now).map((s) => ({
          ...s,
          __upcoming: false,
        })),
      ];
    },
    mustPlan(): boolean {
      return mustPlanNext(this.seasons, this.now);
    },
    nextOpen(): boolean {
      return this.scheduleOpen || this.mustPlan;
    },
    nextHintText(): string {
      const hint = nextSeasonHint(this.seasons, this.now);
      if (!hint) {
        return "";
      }
      const season = this.seasonTitle(hint.season);
      if (hint.kind === "scheduled") {
        return this.$t("pages.seasons.next.hint_scheduled", {
          season,
          date: this.formatDate(hint.season.starts_at),
        });
      }
      if (hint.kind === "after") {
        return this.$t("pages.seasons.next.hint_after", {
          season,
          date: this.formatDate(hint.season.ends_at as string),
        });
      }
      return this.$t("pages.seasons.next.hint_open_ended", { season });
    },
    offSeasonText(): string {
      const last = pastSeasons(this.seasons, this.now)[0];
      const next = upcomingSeasons(this.seasons, this.now)[0];
      const parts: string[] = [];
      if (last?.ends_at) {
        parts.push(
          this.$t("pages.seasons.off.last_ended", {
            season: this.seasonTitle(last),
            date: this.formatDate(last.ends_at),
          }),
        );
      }
      parts.push(this.$t("pages.seasons.off.no_season"));
      if (next) {
        const days = daysUntil(next.starts_at, this.now);
        parts.push(
          this.$t(
            "pages.seasons.off.next",
            {
              season: this.seasonTitle(next),
              date: this.formatDate(next.starts_at),
              count: days,
            },
            days,
          ),
        );
      } else {
        parts.push(this.$t("pages.seasons.off.nothing"));
      }
      return parts.join(" ");
    },
    staleOthers(): Season[] {
      return this.seasons.filter(
        (s) =>
          s.needs_rebuild &&
          s.id !== this.activeSeason?.id &&
          !useSeasonBackfill().isRebuilding(s.id),
      );
    },
    rebuildingSeason(): Season | null {
      const backfill = useSeasonBackfill();
      if (!backfill.running.value) {
        return null;
      }
      return (
        this.seasons.find((s) => s.id === backfill.status.value?.season_id) ||
        null
      );
    },
    seasonAfterEnd(): Season | null {
      const season = this.endSeason;
      if (!season) {
        return null;
      }
      const start = new Date(season.starts_at).getTime();
      return (
        [...this.seasons]
          .filter((s) => new Date(s.starts_at).getTime() > start)
          .sort(
            (a, b) =>
              new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
          )[0] || null
      );
    },
    endTypedMatches(): boolean {
      return (
        !!this.endSeason &&
        this.endTyped.trim().toLowerCase() ===
          this.seasonTitle(this.endSeason).toLowerCase()
      );
    },
    editEndDate(): CalendarDate | undefined {
      const ends = this.activeSeason?.ends_at;
      return ends ? cdFromIso(ends) : undefined;
    },
    editStartDate(): CalendarDate | undefined {
      const starts = this.activeSeason?.starts_at;
      return starts ? cdFromIso(starts) : undefined;
    },
  },
  mounted() {
    this.nowTimer = setInterval(() => {
      this.now = Date.now();
    }, 30_000);
    void useSeasonBackfill().ensureLoaded();
  },
  beforeUnmount() {
    if (this.nowTimer) {
      clearInterval(this.nowTimer);
    }
  },
  methods: {
    seasonTitle(season: { number: number | null }): string {
      return this.$t("pages.seasons.season_number", {
        number: season.number ?? "?",
      }) as string;
    },
    listNames(seasons: Season[]): string {
      const names = seasons.map((s) => this.seasonTitle(s));
      try {
        return new Intl.ListFormat(dateLocale(), {
          style: "long",
          type: "conjunction",
        }).format(names);
      } catch {
        return names.join(", ");
      }
    },
    formatDate(date: string | null): string {
      if (!date) return "";
      return new Date(date).toLocaleDateString(dateLocale(), {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    },
    progressOf(season: Season): number | null {
      return seasonProgress(season, this.now);
    },
    dayOf(season: Season): number {
      return seasonDay(season, this.now);
    },
    lengthOf(season: Season): number | null {
      return seasonLengthDays(season);
    },
    lengthText(season: Season): string {
      const days = seasonLengthDays(season);
      return days === null
        ? this.$t("pages.seasons.ongoing")
        : this.$t("pages.seasons.hero.days", { count: days }, days);
    },
    // The DB exclusion constraint is the backstop; these just guide the pickers.
    editStartDisabled(dv: DateValue) {
      if (!this.activeSeason) return false;
      const value = toMs(dv);
      const endMs = this.activeSeason.ends_at
        ? new Date(this.activeSeason.ends_at).getTime()
        : Infinity;
      if (value >= endMs) return true;
      return overlapsSeason(this.seasons, value, endMs, this.activeSeason.id);
    },
    editEndDisabled(dv: DateValue) {
      if (!this.activeSeason) return false;
      const value = toMs(dv);
      const startMs = new Date(this.activeSeason.starts_at).getTime();
      if (value <= startMs) return true;
      return overlapsSeason(this.seasons, startMs, value, this.activeSeason.id);
    },
    async updateSeason(
      seasonId: string,
      set: { starts_at?: string; ends_at?: string | null },
    ): Promise<boolean> {
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_seasons_by_pk: [
              { pk_columns: { id: seasonId }, _set: set },
              { id: true },
            ],
          }),
        });
        return true;
      } catch {
        // The app already toasts GraphQL errors.
        return false;
      }
    },
    async onEditStartDate(cd: CalendarDate | undefined) {
      this.startPickerOpen = false;
      if (!cd || !this.activeSeason) return;
      const iso = new Date(toMs(cd)).toISOString();
      if (await this.updateSeason(this.activeSeason.id, { starts_at: iso })) {
        toast({ title: this.$t("pages.seasons.updated") });
      }
    },
    async onEditEndDate(cd: CalendarDate | undefined) {
      this.endPickerOpen = false;
      if (!cd || !this.activeSeason) return;
      const iso = new Date(toMs(cd)).toISOString();
      if (await this.updateSeason(this.activeSeason.id, { ends_at: iso })) {
        toast({ title: this.$t("pages.seasons.updated") });
      }
    },
    async makeOngoing(seasonId: string) {
      if (await this.updateSeason(seasonId, { ends_at: null })) {
        toast({ title: this.$t("pages.seasons.updated") });
      }
    },
    openEndNow(season: Season) {
      this.endTyped = "";
      this.endSeason = season;
      this.endOpen = true;
    },
    async endNow() {
      const season = this.endSeason;
      if (!season || !this.endTypedMatches) return;
      const ended = await this.updateSeason(season.id, {
        ends_at: new Date().toISOString(),
      });
      if (!ended) return;
      this.endOpen = false;
      this.now = Date.now();
      toast({
        title: this.$t("pages.seasons.danger.ended_toast", {
          season: this.seasonTitle(season),
        }),
      });
    },
    confirmDelete(season: Season) {
      this.deleteSeason = season;
      this.deleteOpen = true;
    },
    async doDelete() {
      const seasonId = this.deleteSeason?.id;
      if (!seasonId) return;
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            delete_seasons_by_pk: [{ id: seasonId }, { id: true }],
          }),
        });
      } catch {
        return;
      }
      this.deleteOpen = false;
      toast({ title: this.$t("pages.seasons.deleted") });
    },
    confirmRebuild(seasonId: string) {
      this.rebuildSeasonId = seasonId;
      this.showRebuildConfirm = true;
    },
    doRebuild() {
      if (this.rebuildSeasonId) {
        void useSeasonBackfill().startBackfill(this.rebuildSeasonId);
      }
      this.showRebuildConfirm = false;
    },
  },
};
</script>

<style scoped>
/* Running season <-> off-season trade places in one cell: a cross-fade with a
   4px rise, not a stack. */
.season-swap {
  display: grid;
  min-width: 0;
}
.season-swap > * {
  grid-area: 1 / 1;
  min-width: 0;
}
.season-swap-enter-active,
.season-fade-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.season-swap-leave-active,
.season-fade-leave-active {
  transition: opacity 110ms ease-in;
  pointer-events: none;
}
.season-swap-enter-from,
.season-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.season-swap-leave-to,
.season-fade-leave-to {
  opacity: 0;
}

.season-row-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.season-row-leave-active {
  transition:
    opacity 110ms ease-in,
    transform 110ms ease-in;
}
.season-row-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.season-row-leave-to {
  opacity: 0;
  transform: translateX(8px);
}

@media (prefers-reduced-motion: reduce) {
  .season-swap-enter-active,
  .season-swap-leave-active,
  .season-fade-enter-active,
  .season-fade-leave-active,
  .season-row-enter-active,
  .season-row-leave-active {
    transition-duration: 1ms;
  }
}
</style>
