<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  Crosshair,
  Eye,
  PlugZap,
  Trash2,
  TriangleAlert,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { toast } from "~/components/ui/toast";
import NadeRadarBoard from "~/components/nades/NadeRadarBoard.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  checkNadeOneWayQuery,
  checkNadeSightlinesQuery,
} from "~/graphql/nadesGraphql";
import { normalizeMapName } from "~/utilities/mapAssets";
import {
  NADE_EYE_HEIGHT_UNITS,
  NADE_ONE_WAY_TONES,
  NADE_SIGHTLINE_COLORS,
  NADE_SIGHTLINE_MAX_PAIRS,
  NADE_SIGHTLINE_TONES,
  NADE_SIGHTLINE_UNCHECKED_COLOR,
  humanizeNadeToken,
  nadeOneWayConfidence,
  nadeOneWayFavorsKey,
  readNadeSightlineResult,
} from "~/utilities/nadeDisplay";
import type {
  NadeBoardMarker,
  NadeBoardSegment,
  NadeOneWayConfidence,
  NadeSightlineView,
} from "~/utilities/nadeDisplay";
import { readNadeAnalysisNotice } from "~/types/nade";
import type {
  NadeAnalysisNotice,
  NadeLineup,
  NadeOneWayOutput,
  NadeOneWayResult,
  NadeSightlineOutput,
  NadeSightlinePair,
  NadeSightlinePoint,
  NadeSightlineResult,
} from "~/types/nade";

const props = defineProps<{
  lineup: NadeLineup;
}>();

const { t } = useI18n();

const mapName = computed(() => normalizeMapName(props.lineup.map_name));

const pairs = ref<NadeSightlinePair[]>([]);
const pending = ref<NadeSightlinePoint | null>(null);
const selectedPairId = ref<string | null>(null);
const sightlineByPair = ref<Record<string, NadeSightlineResult>>({});
const oneWayByPair = ref<Record<string, NadeOneWayResult>>({});
const serverThreshold = ref<number | null>(null);
const sightlineNotice = ref<NadeAnalysisNotice | null>(null);
const oneWayNotice = ref<NadeAnalysisNotice | null>(null);

let pairCounter = 0;

// Eyes, not feet: a sightline is drawn between where two players are looking
// from, so the default is this lineup's own eye height rather than the floor.
const heightInput = ref(
  String(
    Math.round(
      props.lineup.eye_z ?? props.lineup.origin_z + NADE_EYE_HEIGHT_UNITS,
    ),
  ),
);

const pickHeight = computed(() => {
  const value = Number(heightInput.value);
  return Number.isFinite(value) ? value : 0;
});

function verdictOf(pairId: string) {
  const result = sightlineByPair.value[pairId];
  return result ? readNadeSightlineResult(result) : null;
}

function pairColor(pairId: string) {
  const view = verdictOf(pairId);
  return view
    ? NADE_SIGHTLINE_COLORS[view.verdict]
    : NADE_SIGHTLINE_UNCHECKED_COLOR;
}

const segments = computed<NadeBoardSegment[]>(() =>
  pairs.value.map((pair, index) => ({
    key: pair.id,
    from: pair.from,
    to: pair.to,
    color: pairColor(pair.id),
    label: String(index + 1),
    dashed: !sightlineByPair.value[pair.id],
  })),
);

const markers = computed<NadeBoardMarker[]>(() =>
  pending.value
    ? [
        {
          key: "pending",
          point: pending.value,
          color: NADE_SIGHTLINE_UNCHECKED_COLOR,
          shape: "cross" as const,
        },
      ]
    : [],
);

function onPick(point: NadeSightlinePoint) {
  if (!pending.value) {
    if (pairs.value.length >= NADE_SIGHTLINE_MAX_PAIRS) {
      toast({
        title: t("pages.nades.sightline.max_pairs", {
          count: NADE_SIGHTLINE_MAX_PAIRS,
        }),
      });
      return;
    }
    pending.value = point;
    return;
  }
  const pair: NadeSightlinePair = {
    id: `pair-${++pairCounter}`,
    from: pending.value,
    to: point,
  };
  pending.value = null;
  pairs.value = [...pairs.value, pair];
  selectedPairId.value = pair.id;
}

function removePair(id: string) {
  pairs.value = pairs.value.filter((pair) => pair.id !== id);
  const sightlines = { ...sightlineByPair.value };
  const oneWays = { ...oneWayByPair.value };
  delete sightlines[id];
  delete oneWays[id];
  sightlineByPair.value = sightlines;
  oneWayByPair.value = oneWays;
  if (selectedPairId.value === id) {
    selectedPairId.value = null;
  }
}

function clearAll() {
  pairs.value = [];
  pending.value = null;
  selectedPairId.value = null;
  sightlineByPair.value = {};
  oneWayByPair.value = {};
  serverThreshold.value = null;
  sightlineNotice.value = null;
  oneWayNotice.value = null;
}

function payload() {
  return pairs.value.map((pair) => ({
    from_x: pair.from.x,
    from_y: pair.from.y,
    from_z: pair.from.z,
    to_x: pair.to.x,
    to_y: pair.to.y,
    to_z: pair.to.z,
  }));
}

// Results come back keyed by their position in the request, so the ids that
// were sent are held onto and the answers are re-keyed by pair. Editing the
// list afterwards then drops stale answers instead of mislabelling them.
async function runSightlines() {
  if (!pairs.value.length) {
    return;
  }
  const sent = pairs.value.map((pair) => pair.id);
  try {
    const { data } = await getGraphqlClient().query({
      query: checkNadeSightlinesQuery,
      variables: {
        lineup_id: props.lineup.id,
        pairs: payload(),
        threshold: null,
      },
      fetchPolicy: "no-cache",
    });
    const output = (data as any)?.checkNadeSightlines as
      | NadeSightlineOutput
      | undefined;
    serverThreshold.value = output?.threshold ?? null;
    sightlineNotice.value = readNadeAnalysisNotice(output);
    const next: Record<string, NadeSightlineResult> = {};
    for (const result of output?.results ?? []) {
      const id = sent[result.index];
      if (id) {
        next[id] = result;
      }
    }
    sightlineByPair.value = next;
  } catch (error: any) {
    sightlineNotice.value = { degraded: true, message: error?.message ?? null };
    sightlineByPair.value = {};
    toast({
      title: t("pages.nades.sightline.failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

async function runOneWay() {
  if (!pairs.value.length) {
    return;
  }
  const sent = pairs.value.map((pair) => pair.id);
  try {
    const { data } = await getGraphqlClient().query({
      query: checkNadeOneWayQuery,
      variables: {
        lineup_id: props.lineup.id,
        pairs: payload(),
      },
      fetchPolicy: "no-cache",
    });
    const output = (data as any)?.checkNadeOneWay as
      | NadeOneWayOutput
      | undefined;
    oneWayNotice.value = readNadeAnalysisNotice(output);
    const next: Record<string, NadeOneWayResult> = {};
    for (const result of output?.results ?? []) {
      const id = sent[result.index];
      if (id) {
        next[id] = result;
      }
    }
    oneWayByPair.value = next;
  } catch (error: any) {
    oneWayNotice.value = { degraded: true, message: error?.message ?? null };
    oneWayByPair.value = {};
    toast({
      title: t("pages.nades.sightline.one_way_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}

type PairRow = {
  pair: NadeSightlinePair;
  index: number;
  color: string;
  view: NadeSightlineView | null;
  oneWay: NadeOneWayResult | null;
  confidence: NadeOneWayConfidence | null;
  favorsKey: string | null;
  favorsRaw: string;
  cause: string;
};

const rows = computed<PairRow[]>(() =>
  pairs.value.map((pair, index) => {
    const oneWay = oneWayByPair.value[pair.id] ?? null;
    return {
      pair,
      index,
      color: pairColor(pair.id),
      view: verdictOf(pair.id),
      oneWay,
      confidence: nadeOneWayConfidence(oneWay?.confidence),
      favorsKey: nadeOneWayFavorsKey(oneWay?.favors),
      favorsRaw: humanizeNadeToken(oneWay?.favors),
      cause: humanizeNadeToken(oneWay?.cause),
    };
  }),
);

const degradedNotices = computed(() => {
  const notices: Array<{ key: "coverage" | "one_way"; message: string | null }> =
    [];
  if (sightlineNotice.value?.degraded) {
    notices.push({ key: "coverage", message: sightlineNotice.value.message });
  }
  if (oneWayNotice.value?.degraded) {
    notices.push({ key: "one_way", message: oneWayNotice.value.message });
  }
  return notices;
});

const hasOneWayAnswers = computed(
  () => Object.keys(oneWayByPair.value).length > 0,
);

function coordinate(point: NadeSightlinePoint) {
  return `${Math.round(point.x)}, ${Math.round(point.y)}, ${Math.round(point.z)}`;
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
    <div class="flex flex-col gap-2">
      <NadeRadarBoard
        :map-name="mapName"
        :lineups="[lineup]"
        :selected-id="lineup.id"
        picking
        :pick-z="pickHeight"
        :segments="segments"
        :markers="markers"
        :selected-segment-key="selectedPairId"
        @pick="onPick"
        @select-segment="(key) => (selectedPairId = key)"
      />

      <p class="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Crosshair class="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {{
          pending
            ? $t("pages.nades.sightline.pending_hint")
            : $t("pages.nades.sightline.hint")
        }}
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <label
          class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.nades.sightline.height_label") }}
          <Input v-model="heightInput" type="number" class="h-8 w-24 text-xs" />
        </label>
        <span class="text-xs text-muted-foreground">
          {{ $t("pages.nades.sightline.height_hint") }}
        </span>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          class="tac-amber-cta"
          :disabled="!pairs.length"
          @click="runSightlines()"
        >
          <Eye class="mr-1 h-4 w-4" />
          {{ $t("pages.nades.sightline.check") }}
        </Button>
        <Button
          size="sm"
          variant="outline"
          :disabled="!pairs.length"
          @click="runOneWay()"
        >
          {{ $t("pages.nades.sightline.check_one_way") }}
        </Button>
        <Button
          v-if="pairs.length || pending"
          size="sm"
          variant="ghost"
          @click="clearAll()"
        >
          <Trash2 class="mr-1 h-4 w-4" />
          {{ $t("pages.nades.sightline.clear") }}
        </Button>
      </div>

      <!-- A degraded answer is not a negative answer: with the parser
           unreachable an empty result means "unknown", and letting that render
           as "nothing blocks it" would be a claim nobody made. -->
      <div
        v-for="notice of degradedNotices"
        :key="notice.key"
        class="flex items-start gap-1.5 rounded-sm border border-destructive/40 bg-destructive/10 px-2 py-1.5"
      >
        <PlugZap class="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        <div class="min-w-0 flex-1">
          <div
            class="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-destructive"
          >
            {{ $t(`pages.nades.sightline.degraded.${notice.key}`) }}
          </div>
          <p class="mt-0.5 text-[0.7rem] leading-snug text-muted-foreground">
            {{ $t("pages.nades.sightline.degraded.note") }}
          </p>
          <p
            v-if="notice.message"
            class="mt-0.5 whitespace-pre-wrap break-words font-mono text-[0.6rem] text-muted-foreground"
          >
            {{ notice.message }}
          </p>
        </div>
      </div>

      <p
        v-if="serverThreshold !== null"
        class="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{
          $t("pages.nades.sightline.threshold", { value: serverThreshold })
        }}
      </p>

      <p v-if="!pairs.length" class="text-xs text-muted-foreground">
        {{ $t("pages.nades.sightline.empty") }}
      </p>

      <div
        v-for="row of rows"
        :key="row.pair.id"
        role="button"
        tabindex="0"
        class="flex cursor-pointer flex-col gap-2 rounded-md border bg-card/40 p-3 [backdrop-filter:blur(6px)]"
        :class="
          selectedPairId === row.pair.id
            ? 'border-[hsl(var(--tac-amber)/0.6)]'
            : 'border-border'
        "
        @click="selectedPairId = row.pair.id"
        @keydown.enter="selectedPairId = row.pair.id"
      >
        <div class="flex items-center gap-2">
          <span
            aria-hidden="true"
            class="h-3 w-3 shrink-0 rounded-[2px]"
            :style="{ backgroundColor: row.color }"
          />
          <span class="font-mono text-xs font-bold uppercase tracking-[0.14em]">
            {{ $t("pages.nades.sightline.pair", { index: row.index + 1 }) }}
          </span>
          <button
            type="button"
            class="ml-auto shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            :title="$t('pages.nades.sightline.remove')"
            @click.stop="removePair(row.pair.id)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>

        <div
          class="font-mono text-[0.6rem] tabular-nums leading-relaxed text-muted-foreground"
        >
          {{ coordinate(row.pair.from) }} → {{ coordinate(row.pair.to) }}
        </div>

        <template v-if="row.view">
          <div
            class="rounded-sm border px-2 py-1.5"
            :class="NADE_SIGHTLINE_TONES[row.view.verdict]"
          >
            <div
              class="font-mono text-[0.62rem] uppercase tracking-[0.12em]"
            >
              {{ $t(`pages.nades.sightline.verdict.${row.view.verdict}`) }}
            </div>
            <p class="mt-0.5 text-[0.7rem] leading-snug opacity-90">
              {{ $t(`pages.nades.sightline.verdict_note.${row.view.verdict}`) }}
            </p>
          </div>

          <div
            class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.6rem] tabular-nums text-muted-foreground"
          >
            <span>
              {{
                $t("pages.nades.sightline.depth", { units: row.view.depth })
              }}
            </span>
            <span>
              {{
                $t("pages.nades.sightline.visible", {
                  percent: row.view.visiblePercent,
                })
              }}
            </span>
            <span v-if="row.view.blockedBy">
              {{
                $t("pages.nades.sightline.blocked_by", {
                  what: humanizeNadeToken(row.view.blockedBy),
                })
              }}
            </span>
          </div>
        </template>

        <p v-else class="text-xs text-muted-foreground">
          {{ $t("pages.nades.sightline.not_checked") }}
        </p>

        <template v-if="row.oneWay">
          <div
            v-if="row.oneWay.one_way"
            class="rounded-sm border px-2 py-1.5"
            :class="
              row.confidence
                ? NADE_ONE_WAY_TONES[row.confidence]
                : 'border-border bg-muted/40 text-muted-foreground'
            "
          >
            <div
              class="flex flex-wrap items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em]"
            >
              {{ $t("pages.nades.sightline.one_way.possible") }}
              <span class="opacity-80">
                {{
                  row.confidence
                    ? $t(
                        `pages.nades.sightline.one_way.confidence.${row.confidence}`,
                      )
                    : humanizeNadeToken(row.oneWay.confidence)
                }}
              </span>
              <span
                v-if="row.oneWay.contested"
                class="rounded-sm border border-current px-1 py-0.5 text-[0.55rem]"
              >
                {{ $t("pages.nades.sightline.one_way.contested") }}
              </span>
            </div>
            <p
              v-if="row.favorsKey || row.favorsRaw"
              class="mt-1 text-[0.7rem] leading-snug opacity-90"
            >
              {{
                $t("pages.nades.sightline.one_way.favors", {
                  who: row.favorsKey
                    ? $t(`pages.nades.sightline.one_way.side.${row.favorsKey}`)
                    : row.favorsRaw,
                })
              }}
            </p>
            <p v-if="row.cause" class="text-[0.7rem] leading-snug opacity-90">
              {{
                $t("pages.nades.sightline.one_way.cause", { cause: row.cause })
              }}
            </p>
            <p
              v-if="row.oneWay.contested"
              class="mt-1 text-[0.7rem] leading-snug opacity-90"
            >
              {{ $t("pages.nades.sightline.one_way.contested_note") }}
            </p>
          </div>

          <p v-else class="text-xs text-muted-foreground">
            {{ $t("pages.nades.sightline.one_way.none") }}
          </p>
        </template>
      </div>

      <div
        v-if="hasOneWayAnswers"
        class="flex items-start gap-1.5 rounded-sm border border-border bg-muted/30 px-2 py-1.5 text-[0.7rem] leading-snug text-muted-foreground"
      >
        <TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{{ $t("pages.nades.sightline.one_way.caveat") }}</span>
      </div>
    </div>
  </div>
</template>
