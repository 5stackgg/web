<script setup lang="ts">
import { Input } from "~/components/ui/input";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import {
  Leaf,
  CalendarIcon,
  Plus,
  RotateCcw,
  Ban,
  Infinity as InfinityIcon,
  AlertTriangle,
  ArrowRight,
  X,
  Trash2,
} from "lucide-vue-next";
import {
  tacticalCtaButtonClasses,
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  filterTriggerBase,
  filterTriggerIdle,
} from "~/utilities/tacticalClasses";
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
import { useSeasonBackfill } from "~/composables/useSeasonBackfill";

definePageMeta({
  middleware: "admin",
});

// Shared singleton; also used from the Options API block via useSeasonBackfill().
const backfill = useSeasonBackfill();

const actionBtn = [filterTriggerBase, filterTriggerIdle, "h-8"];
const dangerBtn = [
  filterTriggerBase,
  "h-8 border-[hsl(var(--destructive)/0.5)] bg-[hsl(var(--destructive)/0.12)] text-destructive hover:bg-[hsl(var(--destructive)/0.2)]",
];
</script>

<template>
  <PageTransition :delay="0">
    <div class="container mx-auto max-w-4xl space-y-5 py-6">
      <!-- ===== Header ===== -->
      <TacticalPageHeader>
        <template #description>{{
          $t("layouts.app_nav.administration.title")
        }}</template>
        <template #title>{{ $t("pages.seasons.title") }}</template>
        <template #subtitle>{{ $t("pages.seasons.description") }}</template>
        <template #actions>
          <div
            class="flex items-center gap-2.5 self-start rounded-md border border-border bg-muted/20 px-3 py-2 [backdrop-filter:blur(6px)]"
          >
            <Leaf class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
            <div class="leading-tight">
              <div
                class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                {{ $t("pages.seasons.current") }}
              </div>
              <div
                class="font-sans text-sm font-bold uppercase tracking-[0.08em]"
                :class="
                  activeSeason
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
              >
                {{
                  activeSeason
                    ? "S" + pad2(activeSeason.number)
                    : $t("pages.seasons.off_season")
                }}
              </div>
            </div>
          </div>
        </template>
      </TacticalPageHeader>

      <!-- ===== Backfill progress ===== -->
      <div
        v-if="backfill.running.value"
        class="relative overflow-hidden rounded-lg border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)] p-4 [backdrop-filter:blur(6px)]"
      >
        <div class="mb-3 flex items-center justify-between">
          <span :class="tacticalSectionLabelClasses" class="!mb-0">
            <span
              :class="tacticalSectionTickClasses"
              class="animate-pulse"
            ></span>
            {{ $t("pages.seasons.backfill_running") }}
          </span>
          <button
            type="button"
            :class="actionBtn"
            :disabled="backfill.canceling.value"
            @click="backfill.cancelBackfill()"
          >
            {{ $t("common.cancel") }}
          </button>
        </div>
        <div class="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
          <div
            class="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--tac-amber))] transition-[width] duration-500"
            :style="{ width: (backfill.progress.value || 0) + '%' }"
          ></div>
        </div>
        <div
          class="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{ backfill.status.value?.completed || 0 }} /
          {{ backfill.status.value?.total || 0 }}
          {{ $t("pages.seasons.matches_label") }}
        </div>
      </div>

      <!-- ===== Create Season ===== -->
      <section
        class="relative overflow-hidden rounded-lg border border-border bg-[linear-gradient(180deg,hsl(var(--card)/0.55)_0%,hsl(var(--card)/0.2)_100%)] p-5 sm:p-6 [backdrop-filter:blur(6px)]"
      >
        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-2 top-2 h-[12px] w-[12px] border-l-2 border-t-2 border-[hsl(var(--tac-amber))]"
        ></span>

        <div class="mb-5 flex items-start justify-between gap-4">
          <span :class="tacticalSectionLabelClasses" class="!mb-0">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("pages.seasons.create_title") }}
          </span>
          <!-- Live season-number preview -->
          <div
            class="flex h-11 min-w-[3.25rem] flex-col items-center justify-center rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] px-2 leading-none"
          >
            <span
              class="font-mono text-[0.5rem] uppercase tracking-[0.2em] text-[hsl(var(--tac-amber)/0.7)]"
              >NEXT</span
            >
            <span
              class="font-sans text-lg font-bold text-[hsl(var(--tac-amber))] [font-stretch:80%]"
              >S{{ pad2(previewNumber) }}</span
            >
          </div>
        </div>

        <form @submit.prevent="createSeason" class="space-y-4">
          <div class="space-y-1.5">
            <label
              for="season-desc"
              class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
              >{{ $t("pages.seasons.description_label") }}</label
            >
            <Input
              id="season-desc"
              v-model="newSeasonDescription"
              :placeholder="$t('pages.seasons.description_placeholder')"
            />
          </div>

          <!-- Connected from → to range control -->
          <div class="flex items-stretch gap-2">
            <div
              class="flex flex-1 items-stretch overflow-hidden rounded-md border border-border bg-muted/20"
            >
              <!-- Start half -->
              <div class="flex-1">
                <Popover>
                  <PopoverTrigger as-child>
                    <button
                      type="button"
                      class="flex w-full flex-col items-start gap-1 px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--tac-amber)/0.06)]"
                    >
                      <span
                        class="font-mono text-[0.52rem] uppercase tracking-[0.22em] text-muted-foreground"
                        >{{ $t("pages.seasons.start_label") }}</span
                      >
                      <span
                        class="flex items-center gap-1.5 font-mono text-[0.82rem] leading-none"
                      >
                        <CalendarIcon
                          class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
                        />
                        <span
                          :class="{ 'text-muted-foreground': !newSeasonStart }"
                          >{{
                            newSeasonStart
                              ? formatCalendarDate(newSeasonStart)
                              : $t("pages.seasons.pick_date")
                          }}</span
                        >
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0">
                    <Calendar
                      v-model="newSeasonStart"
                      :is-date-disabled="createStartDisabled"
                      initial-focus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <!-- Divider arrow -->
              <div
                class="flex items-center border-x border-border bg-muted/20 px-2 text-[hsl(var(--tac-amber)/0.7)]"
              >
                <ArrowRight class="h-3.5 w-3.5" />
              </div>

              <!-- End half -->
              <div class="flex-1">
                <Popover>
                  <PopoverTrigger as-child>
                    <button
                      type="button"
                      class="flex w-full flex-col items-start gap-1 px-3 py-2 text-left transition-colors hover:bg-[hsl(var(--tac-amber)/0.06)]"
                    >
                      <span
                        class="font-mono text-[0.52rem] uppercase tracking-[0.22em] text-muted-foreground"
                        >{{ $t("pages.seasons.end_label") }}</span
                      >
                      <span
                        class="flex items-center gap-1.5 font-mono text-[0.82rem] leading-none"
                      >
                        <InfinityIcon
                          v-if="!newSeasonEnd"
                          class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        />
                        <CalendarIcon
                          v-else
                          class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
                        />
                        <span
                          :class="{ 'text-muted-foreground': !newSeasonEnd }"
                          >{{
                            newSeasonEnd
                              ? formatCalendarDate(newSeasonEnd)
                              : $t("pages.seasons.ongoing")
                          }}</span
                        >
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0">
                    <Calendar
                      v-model="newSeasonEnd"
                      :is-date-disabled="createEndDisabled"
                      initial-focus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <!-- Clear end -->
            <button
              v-if="newSeasonEnd"
              type="button"
              :title="$t('common.clear')"
              class="flex w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/20 text-muted-foreground transition-colors hover:border-[hsl(var(--destructive)/0.5)] hover:text-destructive"
              @click="newSeasonEnd = undefined"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <p
            class="flex items-start gap-2 font-mono text-[0.62rem] leading-relaxed tracking-[0.02em] text-muted-foreground"
          >
            <span
              class="mt-[3px] inline-block h-[2px] w-[10px] shrink-0 bg-[hsl(var(--tac-amber)/0.6)]"
            ></span>
            {{ $t("pages.seasons.utc_hint") }}
          </p>

          <p
            v-if="createError"
            class="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertTriangle class="h-4 w-4 shrink-0" />
            {{ createError }}
          </p>

          <button
            type="submit"
            :class="tacticalCtaButtonClasses"
            :disabled="!newSeasonStart || creating"
            class="disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus class="h-4 w-4" />
            {{ createButtonLabel }}
          </button>
        </form>
      </section>

      <!-- ===== Active Season (hero) ===== -->
      <section
        v-if="activeSeason"
        class="relative overflow-hidden rounded-lg border border-[hsl(var(--tac-amber)/0.35)] bg-[linear-gradient(180deg,hsl(var(--tac-amber)/0.07)_0%,hsl(var(--card)/0.25)_100%)] p-5 sm:p-6 [backdrop-filter:blur(6px)]"
      >
        <!-- Recovery-only rebuild (top-right), confirm-gated -->
        <button
          type="button"
          :title="$t('pages.seasons.rebuild')"
          :disabled="backfill.running.value"
          class="absolute right-3 top-3 z-[1] flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/20 text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))] disabled:opacity-40"
          @click="confirmRebuild(activeSeason.id)"
        >
          <RotateCcw class="h-3.5 w-3.5" />
        </button>

        <span
          aria-hidden="true"
          class="pointer-events-none absolute left-2 top-2 h-[14px] w-[14px] border-l-2 border-t-2 border-[hsl(var(--tac-amber))]"
        ></span>
        <span
          aria-hidden="true"
          class="pointer-events-none absolute bottom-2 right-2 h-[14px] w-[14px] border-b-2 border-r-2 border-[hsl(var(--tac-amber))]"
        ></span>

        <div class="flex flex-col gap-5 sm:flex-row sm:items-start">
          <!-- Monogram -->
          <div
            class="relative flex h-[4.5rem] w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)]"
          >
            <span
              class="font-mono text-[0.5rem] uppercase tracking-[0.22em] text-[hsl(var(--tac-amber)/0.75)]"
              >SEASON</span
            >
            <span
              class="font-sans text-3xl font-bold leading-none text-[hsl(var(--tac-amber))] [font-stretch:80%]"
              >{{ pad2(activeSeason.number) }}</span
            >
          </div>

          <div class="min-w-0 flex-1 space-y-4">
            <div class="flex flex-wrap items-center gap-2.5">
              <h2
                class="m-0 font-sans text-xl font-bold uppercase tracking-[0.03em] [font-stretch:85%]"
              >
                {{ seasonTitle(activeSeason) }}
              </h2>
              <span
                class="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.14)] px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]"
              >
                <span
                  class="inline-block h-[7px] w-[7px] rotate-45 animate-pulse bg-[hsl(var(--tac-amber))]"
                ></span>
                {{ $t("pages.seasons.active") }}
              </span>
            </div>

            <p
              v-if="activeSeason.description"
              class="text-sm text-muted-foreground"
            >
              {{ activeSeason.description }}
            </p>

            <!-- Timeline -->
            <div class="space-y-1.5">
              <div
                class="flex items-center justify-between font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                <span>{{ formatDate(activeSeason.starts_at) }}</span>
                <span :class="{ 'text-[hsl(var(--tac-amber))]': activeSeason.ends_at }">{{
                  activeSeason.ends_at
                    ? formatDate(activeSeason.ends_at)
                    : $t("pages.seasons.ongoing")
                }}</span>
              </div>
              <div
                class="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/40"
              >
                <div
                  v-if="activeSeason.ends_at"
                  class="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--tac-amber))] transition-[width] duration-500"
                  :style="{ width: (seasonProgress(activeSeason) ?? 0) + '%' }"
                ></div>
                <div
                  v-else
                  class="absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,hsl(var(--tac-amber)/0.5)_0%,hsl(var(--tac-amber)/0.12)_100%)]"
                ></div>
              </div>
            </div>

            <!-- Countdown -->
            <div
              v-if="activeSeason.ends_at"
              class="flex items-baseline gap-2.5"
            >
              <span
                class="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground"
                >{{ $t("pages.seasons.ends_in_label") }}</span
              >
              <span
                class="font-mono text-2xl font-bold tabular-nums leading-none text-[hsl(var(--tac-amber))]"
                >{{ countdown(activeSeason.ends_at) }}</span
              >
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <Popover>
                <PopoverTrigger as-child>
                  <button type="button" :class="actionBtn">
                    <CalendarIcon class="h-3.5 w-3.5" />
                    {{ $t("pages.seasons.change_start") }}
                  </button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0">
                  <Calendar
                    :model-value="editStartDate"
                    :is-date-disabled="editStartDisabled"
                    @update:model-value="onEditStartDate(activeSeason.id, $event)"
                    initial-focus
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger as-child>
                  <button type="button" :class="actionBtn">
                    <CalendarIcon class="h-3.5 w-3.5" />
                    {{
                      activeSeason.ends_at
                        ? $t("pages.seasons.change_end")
                        : $t("pages.seasons.set_end")
                    }}
                  </button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0">
                  <Calendar
                    :model-value="editEndDate"
                    :is-date-disabled="editEndDisabled"
                    @update:model-value="onEditEndDate(activeSeason.id, $event)"
                    initial-focus
                  />
                </PopoverContent>
              </Popover>
              <button
                v-if="activeSeason.ends_at"
                type="button"
                :class="actionBtn"
                @click="makeOngoing(activeSeason.id)"
              >
                <InfinityIcon class="h-3.5 w-3.5" />
                {{ $t("pages.seasons.make_ongoing") }}
              </button>
              <button
                type="button"
                :class="dangerBtn"
                @click="endNow(activeSeason.id)"
              >
                <Ban class="h-3.5 w-3.5" />
                {{ $t("pages.seasons.end_now") }}
              </button>
              <button
                type="button"
                :class="dangerBtn"
                @click="confirmDelete(activeSeason.id)"
              >
                <Trash2 class="h-3.5 w-3.5" />
                {{ $t("pages.seasons.delete") }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Ledger (upcoming + past) ===== -->
      <section
        v-if="upcomingSeasons.length > 0 || pastSeasons.length > 0"
        class="relative overflow-hidden rounded-lg border border-border bg-[linear-gradient(180deg,hsl(var(--card)/0.5)_0%,hsl(var(--card)/0.2)_100%)] p-5 sm:p-6 [backdrop-filter:blur(6px)]"
      >
        <span :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.seasons.ledger_title") }}
        </span>

        <div class="divide-y divide-border/50">
          <div
            v-for="season in ledgerSeasons"
            :key="season.id"
            class="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <!-- Mini monogram -->
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-muted/30 font-sans text-xs font-bold text-muted-foreground [font-stretch:85%]"
            >
              S{{ pad2(season.number) }}
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-sans text-sm font-semibold uppercase tracking-[0.04em]">{{
                  seasonTitle(season)
                }}</span>
                <span
                  class="inline-flex items-center gap-1 font-mono text-[0.55rem] uppercase tracking-[0.16em]"
                  :class="
                    season.__upcoming
                      ? 'text-[hsl(var(--tac-amber))]'
                      : 'text-muted-foreground'
                  "
                >
                  <span
                    class="inline-block h-[6px] w-[6px] rotate-45"
                    :class="
                      season.__upcoming
                        ? 'bg-[hsl(var(--tac-amber))]'
                        : 'bg-muted-foreground/50'
                    "
                  ></span>
                  {{
                    season.__upcoming
                      ? $t("pages.seasons.upcoming")
                      : $t("pages.seasons.ended")
                  }}
                </span>
              </div>
              <p
                class="truncate font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted-foreground"
              >
                {{ formatDate(season.starts_at) }} —
                {{
                  season.ends_at
                    ? formatDate(season.ends_at)
                    : $t("pages.seasons.ongoing")
                }}<template v-if="season.description">
                  · {{ season.description }}</template
                >
              </p>
            </div>
            <button
              type="button"
              :title="$t('pages.seasons.delete')"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/20 text-muted-foreground transition-colors hover:border-[hsl(var(--destructive)/0.5)] hover:text-destructive"
              @click="confirmDelete(season.id)"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      <!-- ===== Empty ===== -->
      <div
        v-if="!activeSeason && upcomingSeasons.length === 0 && pastSeasons.length === 0"
        class="relative overflow-hidden rounded-lg border border-dashed border-border/70 bg-muted/10 px-6 py-10 text-center"
      >
        <p
          class="font-mono text-[0.72rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.seasons.empty") }}
        </p>
      </div>

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
              {{ $t("pages.seasons.rebuild") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog v-model:open="showDeleteConfirm">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {{ $t("pages.seasons.delete_confirm_title") }}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {{ $t("pages.seasons.delete_confirm_description") }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              @click="doDelete"
            >
              {{ $t("pages.seasons.delete") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </PageTransition>
</template>

<script lang="ts">
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { order_by } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { CalendarDate } from "@internationalized/date";
import { useSeasonBackfill } from "~/composables/useSeasonBackfill";

type Season = {
  id: string;
  number: number | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
};

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
            },
          ],
        }),
        result: function ({ data }: { data: any }) {
          this.seasons = data.seasons || [];
          this.updateCreateDefault();
        },
      },
    },
  },
  data() {
    return {
      seasons: [] as Season[],
      newSeasonDescription: "",
      newSeasonStart: undefined as CalendarDate | undefined,
      newSeasonEnd: undefined as CalendarDate | undefined,
      creating: false,
      createError: "",
      now: Date.now(),
      nowTimer: null as ReturnType<typeof setInterval> | null,
      earliestMatchMs: null as number | null,
      showRebuildConfirm: false,
      rebuildSeasonId: null as string | null,
      showDeleteConfirm: false,
      deleteSeasonId: null as string | null,
    };
  },
  computed: {
    activeSeason(): Season | null {
      return (
        this.seasons.find(
          (s) =>
            new Date(s.starts_at).getTime() <= this.now &&
            (!s.ends_at || new Date(s.ends_at).getTime() > this.now),
        ) || null
      );
    },
    upcomingSeasons(): Season[] {
      return this.seasons.filter(
        (s) => new Date(s.starts_at).getTime() > this.now,
      );
    },
    pastSeasons(): Season[] {
      return this.seasons.filter(
        (s) => s.ends_at && new Date(s.ends_at).getTime() <= this.now,
      );
    },
    ledgerSeasons(): Array<Season & { __upcoming: boolean }> {
      return [
        ...this.upcomingSeasons.map((s) => ({ ...s, __upcoming: true })),
        ...this.pastSeasons.map((s) => ({ ...s, __upcoming: false })),
      ];
    },
    editEndDate(): CalendarDate | undefined {
      const ends = this.activeSeason?.ends_at;
      if (!ends) return undefined;
      const d = new Date(ends);
      return new CalendarDate(
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
      );
    },
    editStartDate(): CalendarDate | undefined {
      const starts = this.activeSeason?.starts_at;
      if (!starts) return undefined;
      const d = new Date(starts);
      return new CalendarDate(
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
      );
    },
    previewNumber(): number {
      if (!this.newSeasonStart) return this.seasons.length + 1;
      const startMs = this.calendarDateToUtcMs(this.newSeasonStart);
      return (
        this.seasons.filter((s) => new Date(s.starts_at).getTime() < startMs)
          .length + 1
      );
    },
    createButtonLabel(): string {
      return this.$t("pages.seasons.create_button", {
        number: this.previewNumber,
      }) as string;
    },
  },
  mounted() {
    this.nowTimer = setInterval(() => {
      this.now = Date.now();
    }, 1000);
    void useSeasonBackfill().ensureLoaded();
    void this.fetchEarliestMatch();
  },
  beforeUnmount() {
    if (this.nowTimer) {
      clearInterval(this.nowTimer);
    }
  },
  methods: {
    pad2(n: number | null): string {
      return n == null ? "—" : String(n).padStart(2, "0");
    },
    seasonTitle(season: Season): string {
      return this.$t("pages.seasons.season_number", {
        number: season.number ?? "?",
      }) as string;
    },
    // Percent of the active season elapsed (null when ongoing / open-ended).
    seasonProgress(season: Season): number | null {
      if (!season.ends_at) return null;
      const start = new Date(season.starts_at).getTime();
      const end = new Date(season.ends_at).getTime();
      if (end <= start) return 100;
      return Math.min(
        100,
        Math.max(0, ((this.now - start) / (end - start)) * 100),
      );
    },
    formatDate(date: string | null): string {
      if (!date) return "";
      return new Date(date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
    },
    formatCalendarDate(cd: CalendarDate): string {
      return this.formatDate(this.calendarDateToUtcIso(cd));
    },
    // Date-only, midnight UTC — "no time associated" per the season model.
    calendarDateToUtcMs(cd: CalendarDate): number {
      return Date.UTC(cd.year, cd.month - 1, cd.day);
    },
    calendarDateToUtcIso(cd: CalendarDate): string {
      return new Date(this.calendarDateToUtcMs(cd)).toISOString();
    },
    countdown(endsAt: string): string {
      const diff = Math.max(
        0,
        Math.floor((new Date(endsAt).getTime() - this.now) / 1000),
      );
      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      const pad = (n: number) => n.toString().padStart(2, "0");
      const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      return days > 0 ? `${days}d ${hms}` : hms;
    },
    rangeConflicts(startMs: number, endMs: number): boolean {
      return this.overlapsOtherSeason(startMs, endMs, null);
    },
    dvMs(dv: { year: number; month: number; day: number }): number {
      return Date.UTC(dv.year, dv.month - 1, dv.day);
    },
    // Does [startMs, endMs) overlap any season other than excludeId?
    overlapsOtherSeason(
      startMs: number,
      endMs: number,
      excludeId: string | null,
    ): boolean {
      return this.seasons.some((s) => {
        if (excludeId && s.id === excludeId) return false;
        const sStart = new Date(s.starts_at).getTime();
        const sEnd = s.ends_at ? new Date(s.ends_at).getTime() : Infinity;
        return startMs < sEnd && sStart < endMs;
      });
    },
    // Calendar is-date-disabled guards — block picking any date that would make
    // the season overlap another. The DB exclusion constraint is the backstop.
    createStartDisabled(dv: { year: number; month: number; day: number }) {
      const ms = this.dvMs(dv);
      const endMs = this.newSeasonEnd
        ? this.calendarDateToUtcMs(this.newSeasonEnd)
        : ms + 86_400_000;
      return this.overlapsOtherSeason(ms, endMs, null);
    },
    createEndDisabled(dv: { year: number; month: number; day: number }) {
      if (!this.newSeasonStart) return false;
      const ms = this.dvMs(dv);
      const startMs = this.calendarDateToUtcMs(this.newSeasonStart);
      if (ms <= startMs) return true;
      return this.overlapsOtherSeason(startMs, ms, null);
    },
    editStartDisabled(dv: { year: number; month: number; day: number }) {
      if (!this.activeSeason) return false;
      const ms = this.dvMs(dv);
      const endMs = this.activeSeason.ends_at
        ? new Date(this.activeSeason.ends_at).getTime()
        : Infinity;
      if (ms >= endMs) return true;
      return this.overlapsOtherSeason(ms, endMs, this.activeSeason.id);
    },
    editEndDisabled(dv: { year: number; month: number; day: number }) {
      if (!this.activeSeason) return false;
      const ms = this.dvMs(dv);
      const startMs = new Date(this.activeSeason.starts_at).getTime();
      if (ms <= startMs) return true;
      return this.overlapsOtherSeason(startMs, ms, this.activeSeason.id);
    },
    async deleteSeason(seasonId: string) {
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            delete_seasons_by_pk: [{ id: seasonId }, { id: true }],
          }),
        });
        toast({ title: this.$t("pages.seasons.deleted") });
      } catch (error) {
        toast({
          title:
            (error as Error)?.message || this.$t("pages.seasons.error_generic"),
          variant: "destructive",
        });
      }
    },
    confirmDelete(seasonId: string) {
      this.deleteSeasonId = seasonId;
      this.showDeleteConfirm = true;
    },
    doDelete() {
      if (this.deleteSeasonId) {
        void this.deleteSeason(this.deleteSeasonId);
      }
      this.showDeleteConfirm = false;
    },
    // First season defaults to the earliest match (covers history); later ones
    // start where the latest ended. Ongoing latest → left empty.
    cdFromMs(ms: number): CalendarDate {
      const d = new Date(ms);
      return new CalendarDate(
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
      );
    },
    updateCreateDefault() {
      if (this.seasons.length === 0) {
        if (this.earliestMatchMs) {
          this.newSeasonStart = this.cdFromMs(this.earliestMatchMs);
        }
        return;
      }
      const latest = this.seasons[0];
      this.newSeasonStart = latest?.ends_at
        ? this.cdFromMs(new Date(latest.ends_at).getTime())
        : undefined;
    },
    async fetchEarliestMatch() {
      try {
        const { data } = await (this as any).$apollo.query({
          query: typedGql("query")({
            matches: [
              {
                where: { ended_at: { _is_null: false } },
                order_by: [{ ended_at: order_by.asc }],
                limit: 1,
              },
              { ended_at: true },
            ],
          }),
          fetchPolicy: "no-cache",
        });
        const ended = data?.matches?.[0]?.ended_at;
        this.earliestMatchMs = ended ? new Date(ended).getTime() : null;
        this.updateCreateDefault();
      } catch {
        this.earliestMatchMs = null;
      }
    },
    async createSeason() {
      this.createError = "";
      if (!this.newSeasonStart || this.creating) {
        return;
      }

      let startMs = this.calendarDateToUtcMs(this.newSeasonStart);
      const endMs = this.newSeasonEnd
        ? this.calendarDateToUtcMs(this.newSeasonEnd)
        : Infinity;

      // The very first season must cover all history: clamp its start to (before)
      // the earliest recorded match so no past match is left off-season.
      if (!this.seasons.length && this.earliestMatchMs !== null) {
        const d = new Date(this.earliestMatchMs);
        const earliestMidnight = Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
        );
        if (startMs > earliestMidnight) {
          startMs = earliestMidnight;
        }
      }

      if (endMs <= startMs) {
        this.createError = this.$t("pages.seasons.error_end_before_start");
        return;
      }
      if (this.rangeConflicts(startMs, endMs)) {
        this.createError = this.$t("pages.seasons.error_overlap");
        return;
      }

      this.creating = true;
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_seasons_one: [
              {
                object: {
                  description: this.newSeasonDescription || null,
                  starts_at: new Date(startMs).toISOString(),
                  ends_at: this.newSeasonEnd
                    ? new Date(endMs).toISOString()
                    : null,
                },
              },
              { id: true },
            ],
          }),
        });

        this.newSeasonDescription = "";
        this.newSeasonStart = undefined;
        this.newSeasonEnd = undefined;

        toast({ title: this.$t("pages.seasons.created") });
      } catch (error) {
        this.createError =
          (error as Error)?.message || this.$t("pages.seasons.error_generic");
      } finally {
        this.creating = false;
      }
    },
    async updateEnds(seasonId: string, endsAt: string | null) {
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_seasons_by_pk: [
              {
                pk_columns: { id: seasonId },
                _set: { ends_at: endsAt },
              },
              { id: true },
            ],
          }),
        });
        toast({ title: this.$t("pages.seasons.updated") });
      } catch (error) {
        toast({
          title:
            (error as Error)?.message || this.$t("pages.seasons.error_generic"),
          variant: "destructive",
        });
      }
    },
    onEditEndDate(seasonId: string, cd: CalendarDate | undefined) {
      if (!cd) return;
      void this.updateEnds(seasonId, this.calendarDateToUtcIso(cd));
    },
    async updateStarts(seasonId: string, startsAt: string) {
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            update_seasons_by_pk: [
              {
                pk_columns: { id: seasonId },
                _set: { starts_at: startsAt },
              },
              { id: true },
            ],
          }),
        });
        toast({ title: this.$t("pages.seasons.updated") });
      } catch (error) {
        toast({
          title:
            (error as Error)?.message || this.$t("pages.seasons.error_generic"),
          variant: "destructive",
        });
      }
    },
    onEditStartDate(seasonId: string, cd: CalendarDate | undefined) {
      if (!cd) return;
      void this.updateStarts(seasonId, this.calendarDateToUtcIso(cd));
    },
    endNow(seasonId: string) {
      void this.updateEnds(seasonId, new Date().toISOString());
    },
    makeOngoing(seasonId: string) {
      void this.updateEnds(seasonId, null);
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
