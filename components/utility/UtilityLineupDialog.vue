<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  ArrowUpRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Heart,
  Rocket,
  ThumbsUp,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import UtilityConfidenceNote from "~/components/utility/UtilityConfidenceNote.vue";
import UtilityDifficultyChip from "~/components/utility/UtilityDifficultyChip.vue";
import UtilityLineupViewer3D from "~/components/utility/UtilityLineupViewer3D.vue";
import UtilityProgressPanel from "~/components/utility/UtilityProgressPanel.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import { hasMeshForMap } from "~/utilities/mapAssets";
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
}>();

const { t } = useI18n();
const meshCdn = useRuntimeConfig().public.mapMeshCdn as string;

const hasMesh = ref(false);

const index = computed(() =>
  props.lineups.findIndex((entry) => entry.id === props.lineupId),
);

const lineup = computed(() =>
  index.value >= 0 ? props.lineups[index.value] : null,
);

const position = computed(() => ({
  current: index.value + 1,
  total: props.lineups.length,
}));

function step(delta: number) {
  if (!props.lineups.length || index.value < 0) {
    return;
  }
  // Wraps: flipping through a filtered set is a loop, and hitting a dead end at
  // the last one just means reaching for the mouse.
  const next =
    (index.value + delta + props.lineups.length) % props.lineups.length;
  emit("update:lineupId", props.lineups[next].id);
}

// The renderer decides its mesh mode once on mount, so the 3D view must not
// appear until the probe has answered -- otherwise a map with no mesh shows an
// empty scene rather than falling back to the radar.
watch(
  () => lineup.value?.map_name,
  async (name) => {
    hasMesh.value = false;
    if (!name || !import.meta.client) {
      return;
    }
    hasMesh.value = await hasMeshForMap(meshCdn, name);
  },
  { immediate: true },
);

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

const myVote = computed(() => Number(lineup.value?.my_vote ?? 0));
const isFavorited = computed(() => lineup.value?.is_favorited === true);
const score = computed(
  () =>
    Number(lineup.value?.upvotes ?? 0) - Number(lineup.value?.downvotes ?? 0),
);

const flightSeconds = computed(() => {
  const ms = lineup.value?.flight_time_ms;
  return ms ? (ms / 1000).toFixed(1) : null;
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
                {{ $t(`pages.utility.types.${lineup.utility_type}`) }} ·
                {{ $t(`pages.utility.sides.${lineup.side}`) }}
              </template>
            </DialogDescription>
          </div>

          <!-- Stepping through the set is the reason this is a dialog and not a
               page, so the controls sit in the title bar rather than buried. -->
          <div class="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              :disabled="lineups.length < 2"
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
              :disabled="lineups.length < 2"
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
        class="grid max-h-[70vh] gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        <!-- Keyed on the lineup so switching remounts the scene rather than
             leaving the previous throw's camera behind. -->
        <div :key="lineup.id" class="flex min-w-0 flex-col gap-2">
          <UtilityLineupViewer3D v-if="hasMesh" :lineup="lineup" />
          <template v-else>
            <UtilityRadarBoard
              :map-name="lineup.map_name"
              :lineups="[lineup]"
              :selected-id="lineup.id"
            />
            <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Boxes class="h-3.5 w-3.5 shrink-0" />
              {{ $t("pages.utility.detail.no_mesh") }}
            </p>
          </template>
        </div>

        <div class="flex min-w-0 flex-col gap-3">
          <UtilityConfidenceNote :lineup="lineup" />

          <div class="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" class="font-mono text-[0.62rem] uppercase">
              {{ $t(`pages.utility.techniques.${lineup.technique}`) }}
            </Badge>
            <Badge variant="outline" class="font-mono text-[0.62rem] uppercase">
              {{ $t(`pages.utility.strengths.${lineup.throw_strength}`) }}
            </Badge>
            <UtilityDifficultyChip :difficulty="lineup.difficulty" compact />
            <Badge
              v-if="flightSeconds"
              variant="outline"
              class="font-mono text-[0.62rem] uppercase tabular-nums"
            >
              {{ flightSeconds }}s
            </Badge>
          </div>

          <UtilityProgressPanel :progress="lineup.progress" />

          <div class="mt-auto flex flex-wrap items-center gap-2 pt-1">
            <Button class="tac-amber-cta flex-1" @click="emit('practice', lineup.id)">
              <Rocket class="mr-1 h-4 w-4" />
              {{ $t("pages.utility.detail.practice_this") }}
            </Button>

            <Button
              variant="outline"
              size="icon"
              :disabled="!canReact"
              :class="myVote === 1 ? 'text-[hsl(var(--tac-amber))]' : ''"
              :title="$t('pages.utility.card.upvote')"
              @click="emit('vote', lineup.id, 1)"
            >
              <ThumbsUp
                class="h-4 w-4"
                :class="myVote === 1 ? 'fill-current' : ''"
              />
            </Button>

            <Button
              variant="outline"
              size="icon"
              :disabled="!canReact"
              :class="isFavorited ? 'text-destructive' : ''"
              :title="$t('pages.utility.card.favorite')"
              @click="emit('favorite', lineup.id)"
            >
              <Heart
                class="h-4 w-4"
                :class="isFavorited ? 'fill-current' : ''"
              />
            </Button>
          </div>

          <NuxtLink
            :to="{ name: 'utility-lineup-id', params: { id: lineup.id } }"
            class="inline-flex items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {{ $t("pages.utility.detail.open_full") }}
            <ArrowUpRight class="h-3 w-3" />
          </NuxtLink>
        </div>
      </div>

      <div v-else class="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Skeleton class="aspect-video w-full rounded-md" />
        <div class="space-y-2">
          <Skeleton class="h-16 w-full rounded-md" />
          <Skeleton class="h-8 w-2/3 rounded-md" />
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
