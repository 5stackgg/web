<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import {
  ClipboardCheck,
  Library,
  ListOrdered,
  Maximize2,
  Minus,
  Plus,
  Rows3,
  Tags,
  Telescope,
} from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { Button } from "~/components/ui/button";
import UtilityLineupDetail from "~/components/utility/UtilityLineupDetail.vue";
import UtilityMapRail from "~/components/utility/UtilityMapRail.vue";
import UtilityMetaIcon from "~/components/utility/UtilityMetaIcon.vue";
import UtilityPracticeBar from "~/components/utility/UtilityPracticeBar.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import {
  DEMO_UTILITY_FEATURED,
  DEMO_UTILITY_LINEUPS,
  DEMO_UTILITY_MAP,
  DEMO_UTILITY_MAPS,
  DEMO_UTILITY_SNAPSHOT,
} from "~/utilities/landing/demoUtility";

// /utility/de_mirage as rawr sees it, with the Window smoke open: the maps
// rail, the board, and the card with its tabs over the lineup.
const { t } = useI18n();

const tabs = computed(() => [
  { key: "lineups", label: t("pages.utility.lineups"), icon: Rows3 },
  {
    key: "meta",
    label: t("pages.utility.views.meta_tab"),
    icon: UtilityMetaIcon,
  },
  {
    key: "collections",
    label: t("pages.utility.collections.tab"),
    icon: Library,
  },
  {
    key: "executes",
    label: t("pages.utility.views.playbooks_tab"),
    icon: ListOrdered,
  },
  { key: "plan", label: t("pages.utility.plan.tab"), icon: ClipboardCheck },
  { key: "discover", label: t("pages.utility.discover.tab"), icon: Telescope },
]);

const board = ref<InstanceType<typeof UtilityRadarBoard> | null>(null);
// Stacked under the map (below lg) the card is as tall as the lineup, so a
// thumb scrolling the page never gets caught in a scroller inside it.
const stacked = useMediaQuery("(max-width: 1023px)");
const card = ref<HTMLElement | null>(null);

const zoom = computed(() => [
  {
    icon: Minus,
    label: "zoom_out",
    disabled: !board.value?.canZoomOut,
    run: () => board.value?.zoomOut(),
  },
  {
    icon: Plus,
    label: "zoom_in",
    disabled: !board.value?.canZoomIn,
    run: () => board.value?.zoomIn(),
  },
  {
    icon: Maximize2,
    label: "zoom_reset",
    disabled: !board.value?.canZoomOut,
    run: () => board.value?.resetZoom(),
  },
]);

function toggleCallouts() {
  if (board.value) {
    board.value.showCallouts = !board.value.showCallouts;
  }
}

// Any marker opens; only the Window smoke has a render and a recorded
// approach to show with it.
const selectedId = ref(DEMO_UTILITY_FEATURED.id);
const hoveredId = ref<string | null>(null);
function select(id: string | null) {
  selectedId.value = id ?? DEMO_UTILITY_FEATURED.id;
}
const snapshot = computed(() =>
  selectedId.value === DEMO_UTILITY_FEATURED.id
    ? DEMO_UTILITY_SNAPSHOT
    : { viewer: DEMO_UTILITY_SNAPSHOT.viewer, runUp: null, missPattern: null },
);

// The clip pauses whenever it leaves the screen, and this mounts far below
// the fold, so it is started again each time it comes into view.
let observer: IntersectionObserver | undefined;

onMounted(() => {
  const video = card.value?.querySelector("video");
  if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  observer = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      video.play().catch(() => {});
    }
  });
  observer.observe(video);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_25rem]">
    <div inert class="hidden items-center lg:flex">
      <UtilityMapRail :map-name="DEMO_UTILITY_MAP" :maps="DEMO_UTILITY_MAPS" />
    </div>

    <!-- Wide, the board is as wide as its column and the card is as tall as
         it, up to 700px: what that cuts is the radar's empty margin above and
         below. Its controls ride the empty corner. -->
    <div
      class="relative mx-auto w-full min-w-0 max-w-[700px] lg:flex lg:aspect-square lg:max-h-[700px] lg:max-w-none lg:items-center lg:overflow-hidden"
    >
      <div
        class="flex min-h-11 items-center justify-end gap-2 px-1 pb-2 lg:absolute lg:right-2 lg:top-2 lg:z-10 lg:min-h-0 lg:p-0"
      >
        <Button
          v-if="board?.hasCallouts"
          size="icon-sm"
          variant="outline"
          class="border-white/10"
          :class="{
            'border-[hsl(var(--tac-amber)/0.5)] text-[hsl(var(--tac-amber))]':
              board?.showCallouts,
          }"
          :aria-label="$t('pages.utility.board.callouts_tip')"
          :aria-pressed="board?.showCallouts"
          @click="toggleCallouts"
        >
          <Tags class="h-4 w-4" />
        </Button>
        <div
          class="flex h-8 items-center overflow-hidden rounded-md border border-white/10"
        >
          <button
            v-for="(control, index) of zoom"
            :key="control.label"
            type="button"
            class="grid h-full w-8 place-items-center text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            :class="index > 0 ? 'border-l border-white/10' : ''"
            :disabled="control.disabled"
            :aria-label="$t(`pages.utility.board.${control.label}`)"
            @click="control.run"
          >
            <component :is="control.icon" class="h-4 w-4" />
          </button>
        </div>
      </div>
      <UtilityRadarBoard
        ref="board"
        class="!max-w-none !rounded-none !border-0 !bg-transparent"
        :controls="false"
        :touch="false"
        :map-name="DEMO_UTILITY_MAP"
        :lineups="DEMO_UTILITY_LINEUPS"
        :selected-id="selectedId"
        :hovered-id="hoveredId"
        @select="select"
        @hover="(id) => (hoveredId = id)"
      />
    </div>

    <div ref="card" class="flex min-w-0">
      <div
        class="utility-card flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-sidebar shadow-[0_24px_48px_-16px_rgba(0,0,0,0.85)] max-md:bg-background"
      >
        <div class="shrink-0 px-3 pt-3">
          <AnimatedFilters
            model-value="lineups"
            :options="tabs"
            square
            block
            collapse
          />
        </div>
        <div class="relative min-h-0 flex-1">
          <UtilityLineupDetail
            open
            :lineup-id="selectedId"
            :lineups="DEMO_UTILITY_LINEUPS"
            can-react
            can-practice
            :snapshot="snapshot"
            :flow="stacked"
          />
        </div>
        <UtilityPracticeBar
          :map-name="DEMO_UTILITY_MAP"
          :open="false"
          :live="false"
        />
      </div>
    </div>
  </div>
</template>
