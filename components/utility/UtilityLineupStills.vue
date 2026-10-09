<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import ZoomableImage from "~/components/media/ZoomableImage.vue";
import { stillSwipeStep } from "~/utilities/stillZoom";
import { utilityStillZoom } from "~/utilities/utilityDisplay";

// The render pod films these in this order, and it is also the order a player
// works through: where to stand, where to aim, the lineup with the pin
// pulled, the exact pixel, the result.
const KINDS = [
  "stance",
  "stance_eyes",
  "aim",
  "aim_pin",
  "aim_close",
  "landing",
] as const;

type Kind = (typeof KINDS)[number];

// Where to point is what you open a lineup to learn, so the viewer starts on
// the closest look at the crosshair there is.
const LEAD: Kind[] = ["aim_close", "aim_pin", "aim"];

// The two crosshair shots open cropped in on the crosshair, and are the only
// ones that zoom: the rest are context, read at a glance.
const CROSSHAIR: ReadonlySet<Kind> = new Set<Kind>(["aim_pin", "aim_close"]);

const props = withDefaults(
  defineProps<{
    stills?: Record<string, string> | null;
    // Inside the hover peek, which takes no pointer: nothing to press.
    compact?: boolean;
  }>(),
  { stills: null, compact: false },
);

const emit = defineEmits<{ (e: "show", kind: string | null): void }>();

const { t } = useI18n();

const items = computed(() =>
  KINDS.flatMap((kind) => {
    const src = props.stills?.[kind];
    return typeof src === "string" && src.length > 0
      ? [
          {
            kind,
            src,
            label: t(`pages.utility.detail.stills.${kind}`),
            crosshair: CROSSHAIR.has(kind),
            zoom: CROSSHAIR.has(kind) ? utilityStillZoom(kind) : 1,
          },
        ]
      : [];
  }),
);

const picked = ref<Kind | null>(null);

const index = computed(() => {
  const at = items.value.findIndex((item) => item.kind === picked.value);
  if (at >= 0) {
    return at;
  }
  for (const kind of LEAD) {
    const lead = items.value.findIndex((item) => item.kind === kind);
    if (lead >= 0) {
      return lead;
    }
  }
  return 0;
});

const shown = computed(() => items.value[index.value] ?? null);
const previous = computed(() => items.value[index.value - 1] ?? null);
const next = computed(() => items.value[index.value + 1] ?? null);

watch(
  () => shown.value?.kind ?? null,
  (kind) => emit("show", kind),
  { immediate: true },
);

function go(at: number) {
  const item = items.value[at];
  if (item) {
    picked.value = item.kind;
  }
}

const zoomable = ref<InstanceType<typeof ZoomableImage> | null>(null);

function onKey(event: KeyboardEvent) {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    go(index.value - 1);
    return;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    go(index.value + 1);
    return;
  }
  if (props.compact || !shown.value?.crosshair) {
    return;
  }
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    zoomable.value?.zoomIn();
  } else if (event.key === "-") {
    event.preventDefault();
    zoomable.value?.zoomOut();
  } else if (event.key === "0") {
    event.preventDefault();
    zoomable.value?.reset();
  }
}

defineExpose({ step: (by: number) => go(index.value + by) });

const columns = computed(() => ({
  gridTemplateColumns: `repeat(${items.value.length}, minmax(0, 1fr))`,
}));

// A thin rail whose names are tooltips is something to point at. Under a
// finger there is no hover to read a name from and 6px is nothing to hit, so
// there the stills are named buttons, and a swipe across the picture steps
// through them.
const coarse = useMediaQuery("(pointer: coarse)");
const byTouch = computed(() => coarse.value && !props.compact);

// Three across at most, so a name has room to be read in full: six stills
// are two rows of three, four are two of two.
const touchColumns = computed(() => {
  const count = items.value.length;
  const across = count <= 3 ? count : count === 4 ? 2 : 3;
  return { gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))` };
});

let swipe: { id: number; x: number; y: number; t: number } | null = null;

function onSwipeStart(event: PointerEvent) {
  // A second finger makes it a pinch, and a still that is zoomed in is being
  // moved about, not passed.
  if (
    event.pointerType !== "touch" ||
    !event.isPrimary ||
    zoomable.value?.zoomed
  ) {
    swipe = null;
    return;
  }
  swipe = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    t: event.timeStamp,
  };
}

function onSwipeEnd(event: PointerEvent) {
  const start = swipe;
  swipe = null;
  if (
    !start ||
    start.id !== event.pointerId ||
    event.type === "pointercancel" ||
    zoomable.value?.zoomed
  ) {
    return;
  }
  go(
    index.value +
      stillSwipeStep(
        event.clientX - start.x,
        event.clientY - start.y,
        event.timeStamp - start.t,
      ),
  );
}

const STEPPER =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] disabled:pointer-events-none disabled:opacity-30";
</script>

<template>
  <section
    v-if="shown"
    class="flex flex-col"
    :class="compact ? 'gap-2' : 'gap-1.5'"
  >
    <div
      class="relative aspect-video overflow-hidden bg-black focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber))]"
      :class="[
        compact
          ? 'border-b border-white/[0.08]'
          : 'rounded-md border border-border',
        byTouch ? 'touch-pan-y' : '',
      ]"
      :tabindex="compact ? -1 : 0"
      role="group"
      :aria-label="$t('pages.utility.detail.stills.viewer')"
      @keydown="onKey"
      @pointerdown="onSwipeStart"
      @pointerup="onSwipeEnd"
      @pointercancel="onSwipeEnd"
    >
      <FadeSwap class="h-full">
        <ZoomableImage
          :key="shown.kind"
          ref="zoomable"
          class="h-full w-full"
          :src="shown.src"
          :alt="shown.label"
          :base-scale="shown.zoom"
          :interactive="!compact && shown.crosshair"
        />
      </FadeSwap>

      <!-- Not under a finger: the still's name is on its button there, and
           a phone's still is small enough that a caption across its foot is
           a seventh of the picture. -->
      <div
        v-if="!byTouch"
        class="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-1.5 pt-5"
      >
        <span
          class="truncate font-mono text-[0.6rem] uppercase tracking-[0.16em] text-white/90"
        >
          {{ shown.label }}
        </span>
        <span
          class="shrink-0 font-mono text-[0.6rem] tabular-nums text-white/60"
        >
          <span v-if="compact && items.length > 1" aria-hidden="true">
            ←
          </span>
          {{ index + 1 }} / {{ items.length }}
          <span v-if="compact && items.length > 1" aria-hidden="true">
            →
          </span>
        </span>
      </div>
    </div>

    <div
      v-if="items.length > 1 && byTouch"
      class="grid gap-1"
      :style="touchColumns"
      role="tablist"
      :aria-label="$t('pages.utility.detail.stills.title')"
    >
      <button
        v-for="(item, at) of items"
        :key="item.kind"
        type="button"
        role="tab"
        data-still-tab
        class="flex min-h-11 items-center justify-center rounded-md border px-2 py-1.5 text-center font-mono text-[0.65rem] font-bold uppercase leading-tight tracking-[0.06em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] motion-reduce:transition-none"
        :class="
          at === index
            ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
            : 'border-border/70 text-muted-foreground'
        "
        :aria-selected="at === index"
        @click="go(at)"
      >
        {{ item.label }}
      </button>
    </div>

    <div
      v-else-if="items.length > 1"
      class="flex items-center gap-1"
      :class="compact ? 'px-2.5' : ''"
    >
      <button
        v-if="!compact"
        type="button"
        :class="STEPPER"
        :disabled="!previous"
        :aria-label="
          previous
            ? $t('pages.utility.detail.stills.open', { still: previous.label })
            : $t('common.previous')
        "
        @click="go(index - 1)"
      >
        <ChevronLeft class="h-3.5 w-3.5" />
      </button>

      <div
        class="grid min-w-0 flex-1 gap-1"
        :style="columns"
        role="tablist"
        :aria-label="$t('pages.utility.detail.stills.title')"
      >
        <template v-for="(item, at) of items" :key="item.kind">
          <FiveStackToolTip
            v-if="!compact"
            as-child
            :delay-duration="120"
            :tap-toggle="false"
          >
            <template #trigger>
              <button
                type="button"
                role="tab"
                class="group/seg flex h-6 items-center focus-visible:outline-none"
                :aria-selected="at === index"
                :aria-label="item.label"
                @click="go(at)"
              >
                <span
                  class="h-1.5 w-full rounded-full transition-colors duration-150 ease-out group-focus-visible/seg:ring-2 group-focus-visible/seg:ring-[hsl(var(--tac-amber))] motion-reduce:transition-none"
                  :class="
                    at === index
                      ? 'bg-[hsl(var(--tac-amber))]'
                      : 'bg-border group-hover/seg:bg-[hsl(var(--tac-amber)/0.5)]'
                  "
                />
              </button>
            </template>
            {{ item.label }}
          </FiveStackToolTip>
          <button
            v-else
            type="button"
            role="tab"
            class="flex h-3 items-center"
            :aria-selected="at === index"
            :aria-label="item.label"
            @click="go(at)"
          >
            <span
              class="h-1.5 w-full rounded-full"
              :class="
                at === index ? 'bg-[hsl(var(--tac-amber))]' : 'bg-border'
              "
            />
          </button>
        </template>
      </div>

      <button
        v-if="!compact"
        type="button"
        :class="STEPPER"
        :disabled="!next"
        :aria-label="
          next
            ? $t('pages.utility.detail.stills.open', { still: next.label })
            : $t('common.next')
        "
        @click="go(index + 1)"
      >
        <ChevronRight class="h-3.5 w-3.5" />
      </button>
    </div>
  </section>
</template>
