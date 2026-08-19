<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Crosshair, Info } from "lucide-vue-next";
import { Skeleton } from "~/components/ui/skeleton";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { nadeLineupMissPatternQuery } from "~/graphql/nadesGraphql";
import {
  humanizeNadeToken,
  nadeMissAxisView,
  nadeMissBiasKey,
  nadeMissBiasTone,
} from "~/utilities/nadeDisplay";
import type { NadeMissAxis, NadeMissAxisView } from "~/utilities/nadeDisplay";
import { readNadeMissPattern } from "~/types/nade";
import type {
  NadeMissPatternOutput,
  NadeMissPatternView,
} from "~/types/nade";

const props = defineProps<{
  lineupId: string;
}>();

const { t } = useI18n();

const pattern = ref<NadeMissPatternView | null>(null);
const loading = ref(true);
const failed = ref(false);

let loadGen = 0;

async function load() {
  const id = props.lineupId;
  const gen = ++loadGen;
  loading.value = true;
  failed.value = false;
  try {
    const { data } = await getGraphqlClient().query({
      query: nadeLineupMissPatternQuery,
      variables: { nade_lineup_id: id },
      fetchPolicy: "no-cache",
    });
    if (gen !== loadGen) {
      return;
    }
    pattern.value = readNadeMissPattern(
      (data as any)?.nadeLineupMissPattern as
        | NadeMissPatternOutput
        | undefined,
    );
  } catch (error) {
    if (gen === loadGen) {
      console.error("[nades] miss pattern load error:", error);
      pattern.value = null;
      failed.value = true;
    }
  } finally {
    if (gen === loadGen) {
      loading.value = false;
    }
  }
}

watch(() => props.lineupId, () => void load(), { immediate: true });

const biasKey = computed(() => nadeMissBiasKey(pattern.value?.bias));

const biasLabel = computed(() => {
  if (biasKey.value) {
    return t(`pages.nades.miss.biases.${biasKey.value}`);
  }
  return humanizeNadeToken(pattern.value?.bias) || t("pages.nades.miss.biases.none");
});

const biasNote = computed(() => {
  if (biasKey.value) {
    return t(`pages.nades.miss.bias_notes.${biasKey.value}`);
  }
  return t("pages.nades.miss.bias_notes.unknown");
});

const axes = computed<Array<NadeMissAxisView & { key: NadeMissAxis }>>(() => {
  const view = pattern.value;
  if (!view) {
    return [];
  }
  const pairs: Array<[NadeMissAxis, number | null]> = [
    ["along", view.meanAlong],
    ["lateral", view.meanLateral],
    ["vertical", view.meanVertical],
  ];
  const out: Array<NadeMissAxisView & { key: NadeMissAxis }> = [];
  for (const [axis, mean] of pairs) {
    const measured = nadeMissAxisView(axis, mean);
    if (measured) {
      out.push({ ...measured, key: axis });
    }
  }
  return out;
});

function axisText(axis: NadeMissAxisView) {
  if (!axis.direction) {
    return t("pages.nades.miss.centred");
  }
  return t("pages.nades.miss.offset", {
    direction: t(`pages.nades.miss.directions.${axis.direction}`),
    units: axis.units,
  });
}
</script>

<template>
  <div
    class="rounded-md border border-border bg-card/40 p-3 [backdrop-filter:blur(6px)]"
  >
    <div
      class="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
    >
      <Crosshair class="h-3.5 w-3.5" />
      {{ $t("pages.nades.miss.eyebrow") }}
    </div>
    <h3 class="mt-0.5 text-sm font-semibold">
      {{ $t("pages.nades.miss.title") }}
    </h3>

    <Skeleton v-if="loading" class="mt-2 h-16 w-full rounded-md" />

    <p v-else-if="failed" class="mt-2 text-xs text-muted-foreground">
      {{ $t("pages.nades.miss.failed") }}
    </p>

    <!-- Below the sample floor the server nulls the bias and all three means,
         and this says nothing about direction either. `samples` still arrives,
         so how far off the floor it is can be said out loud. -->
    <div
      v-else-if="pattern && !pattern.analysed"
      class="mt-2 flex items-start gap-2 rounded-md border border-border bg-foreground/5 p-2.5"
    >
      <Info class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div class="min-w-0 text-xs leading-relaxed text-muted-foreground">
        <p
          v-if="pattern.samples > 0"
          class="font-mono tabular-nums text-foreground/80"
        >
          {{
            $t("pages.nades.miss.below_floor", { samples: pattern.samples })
          }}
        </p>
        <p class="whitespace-pre-wrap break-words">
          {{ pattern.message || $t("pages.nades.miss.not_analysed") }}
        </p>
      </div>
    </div>

    <template v-else-if="pattern">
      <div class="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          class="rounded-sm border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em]"
          :class="nadeMissBiasTone(pattern.bias)"
          :title="biasNote"
        >
          {{ biasLabel }}
        </span>
        <span
          class="font-mono text-[0.6rem] tabular-nums text-muted-foreground"
        >
          {{
            $t("pages.nades.miss.samples", {
              samples: pattern.samples,
              players: pattern.players,
            })
          }}
        </span>
      </div>

      <p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {{ biasNote }}
      </p>

      <!-- One player's throws are that player's habit. The aggregate framing
           only holds once more than one person has drilled it. -->
      <p
        v-if="pattern.singlePlayer"
        class="mt-1.5 text-[0.7rem] leading-snug text-[hsl(var(--tac-amber))]"
      >
        {{ $t("pages.nades.miss.single_player") }}
      </p>

      <!-- The evidence under the verdict, not a second opinion on it: the chip
           above is the server's answer to "is there a bias", and these are the
           measured means it was read from. -->
      <div
        v-if="axes.length"
        class="mt-2 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.nades.miss.means") }}
      </div>
      <div v-if="axes.length" class="mt-1 grid gap-1.5 sm:grid-cols-3">
        <div
          v-for="axis of axes"
          :key="axis.key"
          class="rounded-sm border border-border/60 bg-foreground/5 px-2 py-1.5"
        >
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t(`pages.nades.miss.axes.${axis.key}`) }}
          </div>
          <div class="mt-0.5 font-mono text-xs tabular-nums">
            {{ axisText(axis) }}
          </div>
        </div>
      </div>

      <p class="mt-2 text-[0.7rem] leading-snug text-muted-foreground">
        {{ $t("pages.nades.miss.caveat") }}
      </p>
    </template>
  </div>
</template>
