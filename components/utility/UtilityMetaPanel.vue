<script setup lang="ts">
import { computed, watch } from "vue";
import { Copy, PencilLine, Users } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { Button } from "~/components/ui/button";
import TimeAgo from "~/components/TimeAgo.vue";
import { toast } from "~/components/ui/toast";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import UtilityLineupCard from "~/components/utility/UtilityLineupCard.vue";
import UtilityRadarThumb from "~/components/utility/UtilityRadarThumb.vue";
import {
  UTILITY_TYPE_COLORS,
  matchUtilityMetaSpot,
} from "~/utilities/utilityDisplay";
import type { UtilityMetaSpot } from "~/utilities/utilityDisplay";
import type {
  UtilityLineup,
  UtilitySide,
  UtilityType,
} from "~/types/utility";

const props = defineProps<{
  mapName: string;
  spots: UtilityMetaSpot[];
  lineups: UtilityLineup[];
  selectedKey: string | null;
  hoveredKey: string | null;
  canAuthor: boolean;
  threshold: string;
  thresholdOptions: Array<{ key: string; label: string }>;
  types: UtilityType[];
  sides: UtilitySide[];
}>();

const emit = defineEmits<{
  (event: "update:selectedKey", value: string | null): void;
  (event: "update:hoveredKey", value: string | null): void;
  (event: "update:threshold", value: string): void;
  (event: "open", id: string): void;
  (event: "write-up", spot: UtilityMetaSpot): void;
}>();

const { t } = useI18n();

const thresholdModel = computed<string>({
  get: () => props.threshold,
  set: (value) => emit("update:threshold", value),
});

const visibleSpots = computed(() =>
  props.spots.filter((spot) => {
    if (props.types.length && !props.types.includes(spot.utilityType)) {
      return false;
    }
    if (
      props.sides.length &&
      (!spot.side || !props.sides.includes(spot.side as UtilitySide))
    ) {
      return false;
    }
    return true;
  }),
);

// Which saved lineups sit in a cluster. The count comes from the row's own
// `lineups` column; this only names the ones the page happens to have loaded.
const lineupsBySpot = computed(() => {
  const grouped: Record<string, UtilityLineup[]> = {};
  for (const lineup of props.lineups) {
    const spot = matchUtilityMetaSpot(lineup, props.spots);
    if (spot) {
      (grouped[spot.key] ??= []).push(lineup);
    }
  }
  return grouped;
});

// Printing "SMOKE" on all eight rows of a list filtered to smokes is not a
// label, it is wallpaper. The pills come back the moment the set is mixed.
const mixedTypes = computed(
  () => new Set(visibleSpots.value.map((spot) => spot.utilityType)).size > 1,
);
const mixedSides = computed(
  () => new Set(visibleSpots.value.map((spot) => spot.side)).size > 1,
);

// Every bar is read against the busiest spot on the map, so the column shows
// the shape of the distribution rather than eight bars all pinned full.
const busiest = computed(() =>
  Math.max(1, ...visibleSpots.value.map((spot) => spot.throwers)),
);

const rows = computed(() =>
  visibleSpots.value.map((spot) => {
    const matched = lineupsBySpot.value[spot.key] ?? [];
    return {
      spot,
      color: UTILITY_TYPE_COLORS[spot.utilityType] ?? "#ffffff",
      typeKey: `pages.utility.types.${spot.utilityType}`,
      sideKey: spot.side ? `pages.utility.sides.${spot.side}` : "",
      matched,
      // The server's count wins; the page can only see the lineups it fetched.
      saved: spot.lineups || matched.length,
      // A cluster people throw and nobody has written down is the one thing
      // this panel exists to surface, so it is the one thing it colours.
      unwritten: (spot.lineups || matched.length) === 0,
      // The name can only come from a lineup the page has actually loaded, and
      // the list is scoped -- a spot with three public write-ups has none of
      // them in hand while you are looking at "Mine". Saying "nobody has
      // written this up" there would be a flat lie, so the count answers
      // instead until one of them is on the page to name it.
      name: matched[0]?.name ?? null,
      share: Math.round((spot.throwers / busiest.value) * 100),
    };
  }),
);

// Throws add up across clusters; throwers do not — the same player shows up in
// every spot they throw, so summing `throwers` would invent a player count.
const totalThrows = computed(() =>
  visibleSpots.value.reduce((sum, spot) => sum + spot.throws, 0),
);

const unwrittenCount = computed(
  () => rows.value.filter((row) => row.unwritten).length,
);

const refreshedAt = computed(() => {
  let newest: string | null = null;
  for (const spot of props.spots) {
    if (spot.refreshedAt && (!newest || spot.refreshedAt > newest)) {
      newest = spot.refreshedAt;
    }
  }
  return newest;
});

function aimText(spot: UtilityMetaSpot) {
  if (spot.viewYaw === null && spot.viewPitch === null) {
    return null;
  }
  return `${Number(spot.viewYaw ?? 0).toFixed(1)} / ${Number(spot.viewPitch ?? 0).toFixed(1)}`;
}

// `setang` takes pitch first. Copying the console form rather than the two bare
// numbers is the difference between a readout and something you can use.
async function copyAim(spot: UtilityMetaSpot) {
  const command = `setang ${Number(spot.viewPitch ?? 0).toFixed(1)} ${Number(spot.viewYaw ?? 0).toFixed(1)} 0`;
  try {
    await navigator.clipboard.writeText(command);
    toast({ title: t("pages.utility.meta.aim_copied"), description: command });
  } catch {
    toast({
      title: t("pages.utility.meta.aim_copy_failed"),
      variant: "destructive",
    });
  }
}

// Picking a ring on the board has to bring its row over, or the panel is just
// a list you have to hunt through for the thing you already pointed at.
watch(
  () => props.selectedKey,
  (key) => {
    if (!key || typeof document === "undefined") {
      return;
    }
    document
      .getElementById(`utility-meta-${key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
);

function toggle(key: string) {
  emit("update:selectedKey", props.selectedKey === key ? null : key);
}

// A spot filtered out from under the selection would otherwise stay highlighted
// on the board with nothing in the list pointing at it.
watch(visibleSpots, (list) => {
  if (
    props.selectedKey &&
    !list.some((spot) => spot.key === props.selectedKey)
  ) {
    emit("update:selectedKey", null);
  }
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Distinct players, so the floor cannot be met by one person throwing
         the same spot over and over. -->
    <div class="flex items-center gap-2">
      <span
        class="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.utility.meta.min_throwers") }}
      </span>
      <AnimatedFilters
        v-model="thresholdModel"
        :options="thresholdOptions"
        square
        class="ml-auto"
      />
    </div>

    <div
      class="flex items-center justify-between gap-2 px-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
    >
      <span>
        {{
          $t("pages.utility.meta.summary", {
            spots: visibleSpots.length,
            throws: totalThrows,
          })
        }}
        <span
          v-if="unwrittenCount"
          class="ml-1 text-[hsl(var(--tac-amber))]"
        >
          · {{ $t("pages.utility.meta.unwritten_count", { count: unwrittenCount }) }}
        </span>
      </span>
      <span v-if="refreshedAt" class="flex shrink-0 items-center gap-1">
        <TimeAgo :date="refreshedAt" hide-icon />
      </span>
    </div>

    <Empty v-if="!rows.length">
      <EmptyTitle>{{ $t("pages.utility.meta.empty") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("pages.utility.meta.empty_description") }}
      </EmptyDescription>
    </Empty>

    <div v-else class="flex flex-col">
      <div
        v-for="row of rows"
        :id="`utility-meta-${row.spot.key}`"
        :key="row.spot.key"
        class="border-b border-border/50 transition-colors last:border-b-0"
        :class="
          selectedKey === row.spot.key
            ? 'bg-[hsl(var(--tac-amber))]/[0.06] shadow-[inset_2px_0_0_hsl(var(--tac-amber))]'
            : hoveredKey === row.spot.key
              ? 'bg-[hsl(var(--tac-amber))]/[0.035]'
              : ''
        "
        @mouseenter="emit('update:hoveredKey', row.spot.key)"
        @mouseleave="emit('update:hoveredKey', null)"
      >
        <button
          type="button"
          class="grid w-full grid-cols-[auto_minmax(0,1fr)_5.5rem] items-center gap-2.5 px-2 py-2 text-left"
          @click="toggle(row.spot.key)"
        >
          <!-- The tile is what makes one row distinguishable from the next.
               Eight rows of the same three words never were. -->
          <UtilityRadarThumb
            :map-name="mapName"
            :origin="row.spot.origin"
            :landing="row.spot.landing"
            :color="row.color"
          />

          <span class="min-w-0">
            <span class="flex items-center gap-1.5">
              <span
                v-if="row.name"
                class="truncate text-[0.8rem] font-semibold leading-tight"
              >
                {{ row.name }}
              </span>
              <span
                v-else-if="row.unwritten"
                class="truncate text-[0.8rem] font-medium leading-tight text-muted-foreground"
              >
                {{ $t("pages.utility.meta.unwritten") }}
              </span>
              <span
                v-else
                class="truncate text-[0.8rem] font-medium leading-tight text-muted-foreground"
              >
                {{ $t("pages.utility.meta.saved_lineups", { count: row.saved }) }}
              </span>
              <!-- A plain span, not <Badge>: this sits inside the row's own
                   <button>, and Badge's root is a div. -->
              <span
                v-if="mixedTypes"
                class="shrink-0 rounded-full border border-border px-1.5 py-px font-mono text-[0.55rem] uppercase tracking-[0.1em] text-muted-foreground"
              >
                {{ $t(row.typeKey) }}
              </span>
            </span>
            <span
              class="mt-0.5 flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground"
            >
              <span v-if="mixedSides && row.sideKey">{{ $t(row.sideKey) }}</span>
              <span v-if="row.spot.technique">
                {{ $t(`pages.utility.techniques.${row.spot.technique}`) }}
              </span>
              <span v-if="row.spot.throwStrength">
                {{ $t(`pages.utility.strengths.${row.spot.throwStrength}`) }}
              </span>
              <span v-if="row.saved && row.name" class="text-success">
                {{ $t("pages.utility.meta.saved_count", { count: row.saved }) }}
              </span>
            </span>
          </span>

          <!-- Rank was the sort order printed twice. The bar is the thing the
               digit never said: how far ahead the top of the list actually is. -->
          <span class="flex flex-col items-end gap-1">
            <span
              class="flex items-center gap-1 font-mono text-[0.7rem] font-semibold tabular-nums"
            >
              <Users class="h-3 w-3 text-muted-foreground" />
              {{ row.spot.throwers }}
            </span>
            <span class="h-[3px] w-full overflow-hidden rounded-sm bg-border">
              <span
                class="block h-full rounded-sm"
                :class="row.unwritten ? 'bg-[hsl(var(--tac-amber))]' : ''"
                :style="{
                  width: `${row.share}%`,
                  backgroundColor: row.unwritten ? undefined : row.color,
                }"
              />
            </span>
          </span>
        </button>

        <div
          v-if="selectedKey === row.spot.key"
          class="flex flex-col gap-2.5 px-2 pb-2.5 pl-[3.25rem]"
        >
          <!-- People first. The angles are what you take away; the usage is
               what tells you whether to bother. -->
          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.62rem] tabular-nums text-muted-foreground"
          >
            <span>
              <span class="font-semibold text-foreground">
                {{ row.spot.throwers }}
              </span>
              {{ $t("pages.utility.meta.players") }}
            </span>
            <span>
              <span class="font-semibold text-foreground">
                {{ row.spot.throws }}
              </span>
              {{ $t("pages.utility.meta.throws") }}
            </span>
            <span>
              <span class="font-semibold text-foreground">
                {{ row.spot.matches }}
              </span>
              {{ $t("pages.utility.meta.matches") }}
            </span>
            <span v-if="row.spot.lastSeenAt" class="flex items-center gap-1">
              {{ $t("pages.utility.meta.last_seen") }}
              <TimeAgo :date="row.spot.lastSeenAt" hide-icon />
            </span>
          </div>

          <div
            v-if="aimText(row.spot)"
            class="flex items-center gap-2 font-mono text-[0.62rem] tabular-nums"
          >
            <span
              class="uppercase tracking-[0.14em] text-muted-foreground"
              :title="$t('pages.utility.meta.aim_hint')"
            >
              {{ $t("pages.utility.meta.aim") }}
            </span>
            <span>{{ aimText(row.spot) }}</span>
            <Button
              size="sm"
              variant="ghost"
              class="ml-auto h-6 px-2 text-[0.6rem]"
              @click.stop="copyAim(row.spot)"
            >
              <Copy class="mr-1 h-3 w-3" />
              {{ $t("pages.utility.meta.copy_aim") }}
            </Button>
          </div>

          <Button
            v-if="row.unwritten && canAuthor"
            size="sm"
            variant="outline"
            class="w-full justify-start border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.14)]"
            @click.stop="emit('write-up', row.spot)"
          >
            <PencilLine class="mr-1.5 h-3.5 w-3.5" />
            {{ $t("pages.utility.meta.write_up") }}
            <span class="ml-auto text-[0.55rem] uppercase tracking-[0.12em] opacity-70">
              {{ $t("pages.utility.meta.write_up_hint") }}
            </span>
          </Button>

          <p
            v-else-if="row.unwritten"
            class="text-[0.68rem] text-muted-foreground"
          >
            {{ $t("pages.utility.meta.no_lineups_description") }}
          </p>

          <div v-if="row.matched.length" class="flex flex-col gap-2">
            <UtilityLineupCard
              v-for="lineup of row.matched"
              :key="lineup.id"
              :lineup="lineup"
              :meta-throwers="row.spot.throwers"
              open-in-place
              @open="(id: string) => emit('open', id)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
