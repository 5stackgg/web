<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  GitFork,
  Rocket,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import UtilityCollectionPicker from "~/components/utility/UtilityCollectionPicker.vue";
import UtilityConfidenceNote from "~/components/utility/UtilityConfidenceNote.vue";
import UtilityLineupPreview from "~/components/utility/UtilityLineupPreview.vue";
import UtilityMissPatternPanel from "~/components/utility/UtilityMissPatternPanel.vue";
import UtilityProgressPanel from "~/components/utility/UtilityProgressPanel.vue";
import UtilityReactions from "~/components/utility/UtilityReactions.vue";
import UtilitySightlinePanel from "~/components/utility/UtilitySightlinePanel.vue";
import UtilitySpecLine from "~/components/utility/UtilitySpecLine.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilityLineupQuery } from "~/graphql/utilityGraphql";
import cleanMapName from "~/utilities/cleanMapName";
import { aimPrecisionFor, aimTolerance } from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

const props = defineProps<{
  /** The list as filtered on the page, so stepping matches what you can see. */
  lineups: UtilityLineup[];
  lineupId: string | null;
  canReact?: boolean;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
  (e: "update:lineupId", id: string): void;
  (e: "practice", id: string): void;
  (e: "vote", id: string, value: 1 | -1): void;
  (e: "favorite", id: string): void;
  // Carries the name because the page may never have loaded this lineup --
  // it can arrive by link alone -- and both dialogs put the name in their copy.
  (e: "fork", id: string, name: string): void;
  (e: "archive", id: string, name: string): void;
}>();

const { t } = useI18n();

const index = computed(() =>
  props.lineups.findIndex((entry) => entry.id === props.lineupId),
);

/**
 * A lineup the page never loaded. This is what makes `?lineup=<id>` a shareable
 * address rather than only a pointer into whatever the current filters happen
 * to hold: follow a link to a lineup on another scope, or on page four, and it
 * is fetched instead of reported missing.
 */
const fetched = ref<UtilityLineup | null>(null);
const fetching = ref(false);

const lineup = computed(() =>
  index.value >= 0 ? props.lineups[index.value] : fetched.value,
);

let fetchToken = 0;
watch(
  () => [props.lineupId, index.value, open.value] as const,
  async ([id, inList, isOpen]) => {
    if (!isOpen || !id || inList >= 0 || fetched.value?.id === id) {
      return;
    }
    const token = ++fetchToken;
    fetching.value = true;
    fetched.value = null;
    try {
      const { data } = await getGraphqlClient().query({
        query: utilityLineupQuery,
        variables: { id },
        fetchPolicy: "cache-first",
      });
      if (token === fetchToken) {
        fetched.value = (data as any)?.utility_lineups_by_pk ?? null;
      }
    } catch (error) {
      console.error("[utility] lineup fetch error:", error);
      if (token === fetchToken) {
        fetched.value = null;
      }
    } finally {
      if (token === fetchToken) {
        fetching.value = false;
      }
    }
  },
  { immediate: true },
);

// Stepping only means something inside the list you were reading. A lineup that
// arrived by link is a set of one until you go back to the board.
const steppable = computed(() => index.value >= 0 && props.lineups.length > 1);

const position = computed(() => ({
  current: index.value + 1,
  total: props.lineups.length,
}));

function step(delta: number) {
  if (!steppable.value) {
    return;
  }
  // Wraps: flipping through a filtered set is a loop, and hitting a dead end at
  // the last one just means reaching for the mouse.
  const next =
    (index.value + delta + props.lineups.length) % props.lineups.length;
  emit("update:lineupId", props.lineups[next].id);
}

function onKey(event: KeyboardEvent) {
  if (!open.value) {
    return;
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    step(-1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    step(1);
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

const sightlineOpen = ref(false);
watch(
  () => props.lineupId,
  () => {
    sightlineOpen.value = false;
  },
);

function coords(x: unknown, y: unknown, z: unknown) {
  return `${Math.round(Number(x))}, ${Math.round(Number(y))}, ${Math.round(Number(z))}`;
}

// How far the utility actually travels, which is the number that says whether a
// lineup is a long-range setup or a step-and-throw.
const throwDistance = computed(() => {
  const value = lineup.value;
  if (!value) {
    return null;
  }
  const dx = Number(value.land_x) - Number(value.origin_x);
  const dy = Number(value.land_y) - Number(value.origin_y);
  return Number.isFinite(dx) && Number.isFinite(dy)
    ? `${Math.round(Math.hypot(dx, dy))}u`
    : null;
});

// Stored eye minus stored feet. Not a constant: the feet are the standstill a
// throw was set up from and the eye is the release, so a jump throw reads
// higher than a standing 64.
const eyeOverFeet = computed(() => {
  const value = lineup.value;
  if (!value || value.eye_z == null) {
    return null;
  }
  const over = Number(value.eye_z) - Number(value.origin_z);
  return Number.isFinite(over) ? Math.round(over * 10) / 10 : null;
});

const flightSeconds = computed(() => {
  const ms = lineup.value?.flight_time_ms;
  return ms ? (ms / 1000).toFixed(2) : null;
});

const aimToleranceDegrees = computed(() =>
  aimTolerance(lineup.value?.aim_tolerance),
);
const aimPrecision = computed(() =>
  aimPrecisionFor(lineup.value?.aim_tolerance),
);

const stats = computed(() => {
  const value = lineup.value;
  if (!value) {
    return [];
  }
  return [
    {
      key: "flight_time",
      value: flightSeconds.value
        ? t("pages.utility.card.flight_time", { seconds: flightSeconds.value })
        : t("common.na"),
    },
    {
      key: "view_angles",
      value: `${Number(value.view_yaw ?? 0).toFixed(1)} / ${Number(value.view_pitch ?? 0).toFixed(1)}`,
    },
    {
      key: "precision",
      value: `${t(`pages.utility.precisions.${aimPrecision.value}`)} (${aimToleranceDegrees.value.toFixed(2)}°)`,
    },
    {
      key: "origin_source",
      value: t(`pages.utility.origin_sources.${value.origin_source}`),
    },
    {
      key: "stand",
      value: coords(value.origin_x, value.origin_y, value.origin_z),
    },
    { key: "lands", value: coords(value.land_x, value.land_y, value.land_z) },
    { key: "distance", value: throwDistance.value ?? t("common.na") },
    {
      key: "eye_height",
      value:
        eyeOverFeet.value === null ? t("common.na") : `${eyeOverFeet.value}u`,
    },
  ];
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-5xl gap-0 p-0">
      <DialogHeader class="border-b border-border px-4 py-3">
        <div class="flex items-start justify-between gap-3 pr-6">
          <div class="min-w-0">
            <DialogTitle class="truncate text-base">
              {{ lineup?.name ?? $t("pages.utility.detail.not_found") }}
            </DialogTitle>
            <DialogDescription
              class="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.16em]"
            >
              <template v-if="lineup">
                {{ cleanMapName(lineup.map_name) }} ·
                {{ $t(`pages.utility.types.${lineup.utility_type}`) }} ·
                {{ $t(`pages.utility.visibility.${lineup.visibility}`) }}
              </template>
            </DialogDescription>
          </div>

          <!-- Stepping through the set is the reason this is a dialog and not a
               page, so the controls sit in the title bar rather than buried. -->
          <div v-if="steppable" class="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              :title="$t('pages.utility.detail.previous')"
              @click="step(-1)"
            >
              <ChevronLeft class="h-4 w-4" />
            </Button>
            <span
              class="min-w-[3.5rem] text-center font-mono text-[0.62rem] tabular-nums text-muted-foreground"
            >
              {{ position.current }} / {{ position.total }}
            </span>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              :title="$t('pages.utility.detail.next')"
              @click="step(1)"
            >
              <ChevronRight class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogHeader>

      <div
        v-if="lineup"
        class="grid max-h-[75vh] gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div class="flex min-w-0 flex-col gap-3">
          <UtilityLineupPreview :lineup="lineup" />

          <p
            v-if="lineup.description"
            class="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground"
          >
            {{ lineup.description }}
          </p>

          <!-- Folded away until asked for: it is a second analysis of the same
               throw, not something you need on the way to practising it. -->
          <div class="rounded-md border border-border">
            <button
              type="button"
              class="flex w-full items-center gap-2 p-2.5 text-left transition-colors hover:bg-muted/30"
              @click="sightlineOpen = !sightlineOpen"
            >
              <Crosshair class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span class="min-w-0 flex-1">
                <span class="block text-xs font-semibold">
                  {{ $t("pages.utility.sightline.title") }}
                </span>
                <span class="block text-[0.68rem] text-muted-foreground">
                  {{ $t("pages.utility.sightline.description") }}
                </span>
              </span>
              <span
                class="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {{
                  sightlineOpen
                    ? $t("pages.utility.sightline.hide")
                    : $t("pages.utility.sightline.open")
                }}
              </span>
            </button>
            <div v-if="sightlineOpen" class="border-t border-border p-2.5">
              <UtilitySightlinePanel :lineup="lineup" />
            </div>
          </div>
        </div>

        <div class="flex min-w-0 flex-col gap-3">
          <UtilityConfidenceNote :lineup="lineup" />

          <UtilitySpecLine :lineup="lineup" />

          <dl
            class="grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border border-border bg-card/40 p-3 text-xs [backdrop-filter:blur(6px)]"
          >
            <div v-for="stat of stats" :key="stat.key" class="min-w-0">
              <dt
                class="truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground"
              >
                {{ $t(`pages.utility.detail.${stat.key}`) }}
              </dt>
              <dd class="truncate font-mono tabular-nums">{{ stat.value }}</dd>
            </div>
          </dl>

          <div class="flex items-center justify-between gap-2">
            <PlayerDisplay
              v-if="lineup.author"
              :player="lineup.author"
              size="xs"
              compact
              truncate-name
              :show-elo="false"
              :show-role="false"
              :show-online="false"
              class="min-w-0"
            />
            <span v-else class="text-xs text-muted-foreground">
              {{ $t("pages.utility.card.unknown_author") }}
            </span>
            <span
              v-if="lineup.team"
              class="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              {{ lineup.team.short_name || lineup.team.name }}
            </span>
          </div>

          <UtilityProgressPanel :progress="lineup.progress" />

          <UtilityMissPatternPanel :lineup-id="lineup.id" />

          <div class="mt-auto flex flex-col gap-2 pt-1">
            <div class="flex items-center gap-2">
              <Button
                class="tac-amber-cta flex-1"
                @click="emit('practice', lineup.id)"
              >
                <Rocket class="mr-1 h-4 w-4" />
                {{ $t("pages.utility.detail.practice_this") }}
              </Button>
              <UtilityReactions
                :lineup="lineup"
                :can-react="canReact"
                size="md"
                show-downvote
                @vote="(id, value) => emit('vote', id, value)"
                @favorite="(id) => emit('favorite', id)"
              />
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <UtilityCollectionPicker :lineup-id="lineup.id" />
              <Button
                variant="outline"
                size="sm"
                :disabled="!canReact"
                @click="emit('fork', lineup.id, lineup.name)"
              >
                <GitFork class="mr-1 h-4 w-4" />
                {{ $t("pages.utility.fork.action") }}
              </Button>
              <Button
                v-if="lineup.can_edit && !lineup.archived_at"
                variant="outline"
                size="sm"
                class="ml-auto text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                @click="emit('archive', lineup.id, lineup.name)"
              >
                <Archive class="mr-1 h-4 w-4" />
                {{ $t("pages.utility.archive.action") }}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="fetching"
        class="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <Skeleton class="aspect-video w-full rounded-md" />
        <div class="space-y-2">
          <Skeleton class="h-16 w-full rounded-md" />
          <Skeleton class="h-8 w-2/3 rounded-md" />
        </div>
      </div>

      <div v-else class="p-8 text-center">
        <p class="text-sm font-semibold">
          {{ $t("pages.utility.detail.not_found") }}
        </p>
        <p class="mx-auto mt-1 max-w-[40ch] text-xs text-muted-foreground">
          {{ $t("pages.utility.detail.not_found_description") }}
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>
