<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowRight } from "lucide-vue-next";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery } from "~/graphql/graphqlGen";
import { matchClipFields, topPlayOrderBy } from "~/graphql/matchClip";
import { $ } from "~/generated/zeus";
import ClipTile from "~/components/clips/ClipTile.vue";
import WatchSegmented from "~/components/watch/WatchSegmented.vue";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Clip } from "~/types/clip";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const props = defineProps<{
  // The stream stage is the page's hero, so plays drop to one equal row.
  compact?: boolean;
  // Fresh install: placeholder tiles that say what lands here.
  ghost?: boolean;
}>();

const { t } = useI18n();

type Range = "today" | "week" | "all";

const kind = ref("all");
const range = ref<Range>("week");

const kindOptions = computed(() => [
  { key: "all", label: t("pages.watch.highlights.kinds.all") },
  { key: "ace", label: t("pages.watch.highlights.kinds.aces") },
  { key: "4k", label: t("pages.watch.highlights.kinds.fourks") },
]);

const rangeOptions = computed(() => [
  { key: "today", label: t("pages.watch.highlights.range.today") },
  { key: "week", label: t("pages.watch.highlights.range.week") },
  { key: "all", label: t("pages.watch.highlights.range.all") },
]);

const clips = ref<Clip[]>([]);
const loading = ref(true);

// Hero layout shows the lead play plus up to six; compact is one row of four.
const limit = computed(() => (props.compact ? 4 : 7));

function rangeStart(value: Range): string | null {
  if (value === "all") return null;
  const start = new Date();
  if (value === "today") {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 7);
  }
  return start.toISOString();
}

function clipsWhere() {
  const where: Record<string, any> = { visibility: { _eq: "public" } };
  const since = rangeStart(range.value);
  if (since) where.created_at = { _gte: since };
  // kills_count is the clip's total, so a tier only means something on a
  // single-round clip.
  if (kind.value === "ace") {
    where.kills_count = { _eq: 5 };
    where.round = { _is_null: false };
  } else if (kind.value === "4k") {
    where.kills_count = { _eq: 4 };
    where.round = { _is_null: false };
  }
  return where;
}

let requestId = 0;
async function fetchClips() {
  if (props.ghost) return;
  const id = ++requestId;
  loading.value = clips.value.length === 0;
  try {
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        match_clips: [
          {
            where: $("where", "match_clips_bool_exp!"),
            order_by: topPlayOrderBy,
            limit: $("limit", "Int!"),
          },
          matchClipFields,
        ],
      } as any),
      variables: { where: clipsWhere(), limit: limit.value },
      fetchPolicy: "network-only",
    });
    if (id !== requestId) return;
    clips.value = ((data as any)?.match_clips ?? []) as Clip[];
  } catch (error) {
    console.error("[watch] highlights fetch error:", error);
  } finally {
    if (id === requestId) loading.value = false;
  }
}

watch([kind, range, limit, () => props.ghost], fetchClips, { immediate: true });

const createdToday = (clip: Clip) =>
  new Date(clip.created_at).toDateString() === new Date().toDateString();

function leadTag(clip: Clip) {
  if (createdToday(clip)) return t("pages.watch.highlights.tag.today");
  return range.value === "all"
    ? t("pages.watch.highlights.tag.all")
    : t("pages.watch.highlights.tag.week");
}

// Column/row spans on a 12-column grid. The lead takes 6x2; the rest fill
// the right-hand 2x2 block first, then share full rows evenly.
function restSpans(count: number): Array<[number, number]> {
  if (count <= 0) return [];
  if (count === 1) return [[6, 2]];
  if (count === 2) return [[6, 1], [6, 1]];
  if (count === 3) return [[3, 1], [3, 1], [6, 1]];
  const spans: Array<[number, number]> = [[3, 1], [3, 1], [3, 1], [3, 1]];
  let left = count - 4;
  const rows = Math.ceil(left / 4);
  for (let row = 0; row < rows; row++) {
    const inRow = Math.ceil(left / (rows - row));
    for (let i = 0; i < inRow; i++) spans.push([12 / inRow, 1]);
    left -= inRow;
  }
  return spans;
}

type Cell = {
  clip: Clip;
  cols: number;
  rows: number;
  hero: boolean;
  tag?: string;
};

const cells = computed<Cell[]>(() => {
  const list = clips.value;
  if (list.length === 0) return [];
  if (props.compact) {
    const cols = 12 / list.length;
    return list.map((clip, index) => ({
      clip,
      cols,
      rows: 1,
      hero: false,
      tag: index === 0 ? leadTag(clip) : undefined,
    }));
  }
  if (list.length === 1) {
    return [{ clip: list[0], cols: 12, rows: 2, hero: true, tag: leadTag(list[0]) }];
  }
  const spans = restSpans(list.length - 1);
  return [
    { clip: list[0], cols: 6, rows: 2, hero: true, tag: leadTag(list[0]) },
    ...list.slice(1).map((clip, index) => ({
      clip,
      cols: spans[index][0],
      rows: spans[index][1],
      hero: false,
    })),
  ];
});
</script>

<template>
  <section id="watch-highlights" class="scroll-mt-20">
    <div
      :class="[
        tacticalSectionLabelClasses,
        '!flex w-full items-center justify-between',
      ]"
    >
      <span class="inline-flex items-center gap-3">
        <span class="inline-flex items-center gap-2">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.watch.highlights.title") }}
        </span>
        <NuxtLink
          v-if="!ghost"
          :to="{ name: 'highlights' }"
          class="inline-flex items-center gap-1 text-xs normal-case tracking-normal text-muted-foreground transition-colors hover:text-foreground"
        >
          {{ $t("common.see_all") }}
          <ArrowRight class="h-3 w-3" />
        </NuxtLink>
      </span>
    </div>

    <div v-if="!ghost" class="mb-3 flex items-center justify-between gap-3">
      <WatchSegmented
        v-model="kind"
        :options="kindOptions"
        :label="$t('pages.watch.highlights.kinds.label')"
      />
      <div class="flex min-w-0 items-center gap-2">
        <Select v-model="range">
          <SelectTrigger
            class="h-8 w-auto gap-2 text-xs"
            :aria-label="$t('pages.watch.highlights.range.label')"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem
              v-for="option in rangeOptions"
              :key="option.key"
              :value="option.key"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- Fresh install: the grid's own shape, empty, with one caption. -->
    <div v-if="ghost" class="watch-bento">
      <div
        class="watch-bento-cell watch-bento-hero relative flex items-end rounded-lg border border-dashed border-border p-5 [--cols:6] [--rows:2]"
      >
        <p class="max-w-[36ch] text-sm text-muted-foreground [text-wrap:balance]">
          {{ $t("pages.watch.highlights.ghost") }}
        </p>
      </div>
      <div
        v-for="index in 4"
        :key="index"
        aria-hidden="true"
        class="watch-bento-cell rounded-lg border border-dashed border-border/70 [--cols:3] [--rows:1]"
      ></div>
    </div>

    <div v-else-if="loading" class="watch-bento">
      <Skeleton
        v-for="index in compact ? 4 : 5"
        :key="index"
        class="watch-bento-cell rounded-lg"
        :class="{ 'watch-bento-hero': !compact && index === 1 }"
        :style="{
          '--cols': compact ? 3 : index === 1 ? 6 : 3,
          '--rows': !compact && index === 1 ? 2 : 1,
        }"
      />
    </div>

    <div
      v-else-if="cells.length === 0"
      class="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border px-5 py-8 text-sm text-muted-foreground"
    >
      <span>{{ $t("pages.watch.highlights.empty") }}</span>
      <Button
        v-if="range !== 'all'"
        variant="outline"
        size="sm"
        class="h-8"
        @click="range = 'all'"
      >
        {{ $t("pages.watch.highlights.show_all_time") }}
      </Button>
    </div>

    <TransitionGroup
      v-else
      tag="div"
      class="watch-bento"
      move-class="transition-transform [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
    >
      <div
        v-for="cell in cells"
        :key="cell.clip.id"
        class="watch-bento-cell"
        :class="{ 'watch-bento-hero': cell.hero }"
        :style="{ '--cols': cell.cols, '--rows': cell.rows }"
      >
        <ClipTile
          :clip="cell.clip"
          :variant="cell.hero ? 'hero' : 'tile'"
          :tag="cell.tag"
          :queue="clips"
          queue-scope="watch-highlights"
          fill
        />
      </div>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.watch-bento {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 190px;
  grid-auto-flow: row dense;
  gap: 12px;
}

.watch-bento-cell {
  grid-column: span var(--cols, 3);
  grid-row: span var(--rows, 1);
  min-width: 0;
}

/* Two columns, then one: rows stop being a fixed height and each tile
   carries its own shape. */
@media (max-width: 900px) {
  .watch-bento {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: auto;
  }
  .watch-bento-cell {
    grid-column: span 1;
    grid-row: auto;
    aspect-ratio: 16 / 11;
  }
  .watch-bento-hero {
    grid-column: span 2;
    aspect-ratio: 16 / 8;
  }
}

@media (max-width: 600px) {
  .watch-bento {
    grid-template-columns: minmax(0, 1fr);
  }
  .watch-bento-cell,
  .watch-bento-hero {
    grid-column: span 1;
    aspect-ratio: 16 / 11;
  }
  .watch-bento-hero {
    aspect-ratio: 4 / 3.4;
  }
}
</style>
