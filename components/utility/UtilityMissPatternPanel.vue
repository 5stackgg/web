<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Info } from "lucide-vue-next";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { Skeleton } from "~/components/ui/skeleton";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { utilityLineupMissPatternQuery } from "~/graphql/utilityGraphql";
import {
  humanizeUtilityToken,
  utilityMissAxisView,
  utilityMissBiasKey,
} from "~/utilities/utilityDisplay";
import type { UtilityMissAxis, UtilityMissAxisView } from "~/utilities/utilityDisplay";
import { readUtilityMissPattern } from "~/types/utility";
import type {
  UtilityMissPatternOutput,
  UtilityMissPatternView,
} from "~/types/utility";

const props = defineProps<{
  lineupId: string;
}>();

const { t } = useI18n();

const pattern = ref<UtilityMissPatternView | null>(null);
const loading = ref(true);

let loadGen = 0;

async function load() {
  const id = props.lineupId;
  const gen = ++loadGen;
  loading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupMissPatternQuery,
      variables: { utility_lineup_id: id },
      fetchPolicy: "no-cache",
    });
    if (gen !== loadGen) {
      return;
    }
    pattern.value = readUtilityMissPattern(
      (data as any)?.utilityLineupMissPattern as
        | UtilityMissPatternOutput
        | undefined,
    );
  } catch (error) {
    if (gen === loadGen) {
      console.error("[utility] miss pattern load error:", error);
      pattern.value = null;
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(() => props.lineupId, () => void load(), { immediate: true });

const biasKey = computed(() => utilityMissBiasKey(pattern.value?.bias));

const biasLabel = computed(() => {
  if (biasKey.value) {
    return t(`pages.utility.miss.biases.${biasKey.value}`);
  }
  return humanizeUtilityToken(pattern.value?.bias) || t("pages.utility.miss.biases.none");
});

const biasNote = computed(() => {
  if (biasKey.value) {
    return t(`pages.utility.miss.bias_notes.${biasKey.value}`);
  }
  return t("pages.utility.miss.bias_notes.unknown");
});

// A direction is the only verdict a player can act on, so it is the only one
// that takes the accent. "No pattern" is good news; "scattered" is no news.
const tone = computed<"aim" | "good" | "quiet">(() => {
  if (!pattern.value?.analysed) {
    return "quiet";
  }
  if (biasKey.value === "none") {
    return "good";
  }
  return !biasKey.value || biasKey.value === "scattered" ? "quiet" : "aim";
});

const axes = computed<Array<UtilityMissAxisView & { key: UtilityMissAxis }>>(() => {
  const view = pattern.value;
  if (!view) {
    return [];
  }
  const pairs: Array<[UtilityMissAxis, number | null]> = [
    ["along", view.meanAlong],
    ["lateral", view.meanLateral],
    ["vertical", view.meanVertical],
  ];
  const out: Array<UtilityMissAxisView & { key: UtilityMissAxis }> = [];
  for (const [axis, mean] of pairs) {
    const measured = utilityMissAxisView(axis, mean);
    if (measured) {
      out.push({ ...measured, key: axis });
    }
  }
  return out;
});

// "Short by 34u · Left by 12u": only the axes that are actually off.
const offsets = computed(() =>
  axes.value
    .filter((axis) => axis.direction)
    .map((axis) =>
      t("pages.utility.miss.offset", {
        direction: t(`pages.utility.miss.directions.${axis.direction}`),
        units: axis.units,
      }),
    ),
);

// The picture: the target seen from above with the throw coming up from the
// bottom, so long is up, short is down, and left and right are the thrower's
// own. The amber dot is where the average throw lands; height, which a top-down
// view cannot show, rides a gauge beside it. One scale for all three axes,
// sized so the furthest mean sits inside the outer ring. The rings are a frame,
// not a threshold: whether an offset counts as a bias is the server's call.
const TARGET = { x: 28, y: 28, r: 23 };

const plot = computed(() => {
  const view = pattern.value;
  if (!view?.analysed) {
    return null;
  }
  const along = view.meanAlong ?? 0;
  const lateral = view.meanLateral ?? 0;
  const vertical = view.meanVertical ?? 0;
  const reach = Math.max(
    60,
    Math.max(Math.hypot(along, lateral), Math.abs(vertical)) * 1.25,
  );
  const scale = (TARGET.r - 3) / reach;
  return {
    x: TARGET.x + lateral * scale,
    y: TARGET.y - along * scale,
    off: Math.hypot(along, lateral) * scale > 1.5,
    height: view.meanVertical === null ? null : TARGET.y - vertical * scale,
    tall: Math.abs(vertical) * scale > 1.5,
  };
});
</script>

<template>
  <!-- One shape in every state, so the panel does not jump as the answer
       arrives: a target on the left, the verdict in a few words beside it.
       With a verdict it is a card; without one it is the same row with no
       frame, because a box around "not yet" is weight spent on nothing. A
       failed load says nothing at all -- the insight is optional, and the app
       already reports the error. The loader dissolves into the answer rather
       than being swapped for it. -->
  <FadeSwap v-if="loading || pattern">
  <Skeleton v-if="loading" key="loading" class="h-16 w-full rounded-md" />

  <div
    v-else-if="pattern"
    key="pattern"
    class="flex items-center gap-3"
    :class="
      pattern.analysed
        ? 'rounded-md border border-border bg-background/50 px-3 py-2.5'
        : 'px-1'
    "
  >
    <svg
      viewBox="0 0 72 56"
      aria-hidden="true"
      class="h-16 w-[5.125rem] shrink-0"
      fill="none"
      stroke-linecap="round"
    >
      <circle
        :cx="TARGET.x"
        :cy="TARGET.y"
        :r="TARGET.r"
        class="stroke-white/15"
        stroke-width="1.25"
        :stroke-dasharray="pattern.analysed && biasKey !== 'scattered' ? undefined : '3 4'"
      />
      <circle
        :cx="TARGET.x"
        :cy="TARGET.y"
        :r="TARGET.r / 2"
        class="stroke-white/10"
        stroke-width="1.25"
        :stroke-dasharray="pattern.analysed ? undefined : '3 4'"
      />
      <!-- Where the throw comes from. -->
      <path
        :d="`M${TARGET.x - 4} 55l4-4l4 4`"
        class="stroke-white/30"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <!-- Where it is meant to land. -->
      <circle
        :cx="TARGET.x"
        :cy="TARGET.y"
        r="2"
        :class="tone === 'good' ? 'fill-success' : 'fill-white/45'"
      />
      <template v-if="plot && tone !== 'quiet'">
        <template v-if="plot.off">
          <line
            :x1="TARGET.x"
            :y1="TARGET.y"
            :x2="plot.x"
            :y2="plot.y"
            class="stroke-[hsl(var(--tac-amber))]"
            stroke-width="1.5"
          />
          <circle
            :cx="plot.x"
            :cy="plot.y"
            r="4"
            class="fill-[hsl(var(--tac-amber))] stroke-[#05070b]"
            stroke-width="1.5"
          />
        </template>
        <circle
          v-else-if="tone === 'good'"
          :cx="TARGET.x"
          :cy="TARGET.y"
          r="5.5"
          class="stroke-success"
          stroke-width="1.5"
        />
      </template>
      <!-- Height, off to the side: above the tick is high, below it is low. -->
      <template v-if="plot && plot.height !== null">
        <line x1="64" y1="6" x2="64" y2="50" class="stroke-white/10" stroke-width="2" />
        <line x1="60" :y1="TARGET.y" x2="68" :y2="TARGET.y" class="stroke-white/30" stroke-width="1.25" />
        <circle
          cx="64"
          :cy="plot.height"
          r="3"
          :class="
            plot.tall && tone === 'aim'
              ? 'fill-[hsl(var(--tac-amber))] stroke-[#05070b]'
              : 'fill-white/45 stroke-[#05070b]'
          "
          stroke-width="1.25"
        />
      </template>
    </svg>

    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="flex items-center gap-1.5">
        <span
          class="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground/70"
        >
          {{ $t("pages.utility.miss.eyebrow") }}
        </span>
        <!-- What the picture is and is not, for whoever wants it. -->
        <FiveStackToolTip v-if="pattern.analysed" as-child :delay-duration="120">
          <template #trigger>
            <button
              type="button"
              class="grid size-4 place-items-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              :aria-label="$t('pages.utility.miss.title')"
            >
              <Info class="h-3 w-3" />
            </button>
          </template>
          {{ $t("pages.utility.miss.caveat") }}
        </FiveStackToolTip>
        <span
          v-if="pattern.samples > 0"
          class="ml-auto shrink-0 font-mono text-[0.58rem] uppercase tabular-nums tracking-[0.1em] text-muted-foreground/70"
        >
          {{
            $t("pages.utility.miss.samples", {
              samples: pattern.samples,
              players: pattern.players,
            })
          }}
        </span>
      </div>

      <template v-if="pattern.analysed">
        <p
          class="text-base font-bold leading-tight"
          :class="
            tone === 'aim'
              ? 'text-[hsl(var(--tac-amber))]'
              : tone === 'good'
                ? 'text-success'
                : ''
          "
        >
          {{ biasLabel }}
        </p>
        <p
          v-if="offsets.length"
          class="font-mono text-[0.66rem] tabular-nums leading-snug text-muted-foreground"
        >
          {{ offsets.join(" · ") }}
        </p>
        <!-- One player's throws are that player's habit. The aggregate framing
             only holds once more than one person has drilled it. -->
        <p
          v-if="pattern.singlePlayer"
          class="text-[0.7rem] leading-snug text-[hsl(var(--tac-amber))]"
        >
          {{ $t("pages.utility.miss.single_player") }}
        </p>
        <p v-else class="text-[0.7rem] leading-snug text-muted-foreground">
          {{ biasNote }}
        </p>
      </template>

      <!-- Below the sample floor the server nulls the bias and all three
           means. `samples` still arrives, so how far off the floor it is can
           be said out loud. -->
      <template v-else>
        <p class="text-sm font-semibold leading-tight text-muted-foreground">
          {{ $t("pages.utility.miss.waiting") }}
        </p>
        <p
          class="line-clamp-2 text-[0.7rem] leading-snug text-muted-foreground/80 first-letter:uppercase"
        >
          {{ pattern.message || $t("pages.utility.miss.not_analysed") }}
        </p>
      </template>
    </div>
  </div>
  </FadeSwap>
</template>
