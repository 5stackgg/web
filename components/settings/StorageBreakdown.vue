<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@vue/apollo-composable";
import gql from "graphql-tag";
import { LucideFilm, LucideSparkles } from "lucide-vue-next";
import formatBytes from "~/utilities/formatBytes";

// Counts are entity rows (one per demo / one per highlight) — not S3 objects,
// since each highlight also stores a thumbnail snapshot which would skew a
// file-based count. Sizes are the DB totals the panel sums (kept accurate by
// the orphaned-uploads scan's size reconcile).
const QUERY = gql`
  query StorageBreakdown {
    match_map_demos_aggregate {
      aggregate {
        count
        sum {
          size
          playback_size
        }
      }
    }
    match_clips_aggregate {
      aggregate {
        count
        sum {
          size
        }
      }
    }
  }
`;

const { result: agg } = useQuery(QUERY, null, {
  fetchPolicy: "cache-and-network",
});

const demoBytes = computed(() => {
  const sum = (agg.value as any)?.match_map_demos_aggregate?.aggregate?.sum;
  return Number(sum?.size || 0) + Number(sum?.playback_size || 0);
});
const demoCount = computed(() =>
  Number((agg.value as any)?.match_map_demos_aggregate?.aggregate?.count || 0),
);
const clipBytes = computed(() =>
  Number((agg.value as any)?.match_clips_aggregate?.aggregate?.sum?.size || 0),
);
const clipCount = computed(() =>
  Number((agg.value as any)?.match_clips_aggregate?.aggregate?.count || 0),
);

const total = computed(() => demoBytes.value + clipBytes.value);
const demoPct = computed(() =>
  total.value ? Math.round((demoBytes.value / total.value) * 100) : 0,
);
const clipPct = computed(() => (total.value ? 100 - demoPct.value : 0));
</script>

<template>
  <div class="rounded-lg border bg-card/40 p-4 space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div class="space-y-0.5">
        <div
          class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {{
            $t("pages.settings.application.demo_settings.orphaned_breakdown")
          }}
        </div>
        <div class="text-2xl font-bold tabular-nums">
          {{ formatBytes(total) }}<span class="text-muted-foreground">~</span>
        </div>
      </div>
      <slot name="action" />
    </div>

    <!-- Proportion bar: demos vs highlights share of storage -->
    <div class="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      <div class="bg-primary" :style="{ width: demoPct + '%' }" />
      <div class="bg-amber-400" :style="{ width: clipPct + '%' }" />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1.5">
        <div class="flex items-center gap-2">
          <LucideFilm class="h-3.5 w-3.5 text-primary" />
          <span class="text-sm font-medium">
            {{ $t("pages.settings.application.demo_settings.orphaned_demos") }}
          </span>
          <span class="ml-auto text-xs tabular-nums text-muted-foreground">
            {{ demoPct }}%
          </span>
        </div>
        <div class="flex items-baseline gap-2 pl-5">
          <span class="text-xl font-semibold tabular-nums">
            {{ formatBytes(demoBytes) }}
          </span>
          <span class="text-xs text-muted-foreground tabular-nums">
            {{
              $t(
                "pages.settings.application.demo_settings.orphaned_demos_count",
                {
                  count: demoCount,
                },
              )
            }}
          </span>
        </div>
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center gap-2">
          <LucideSparkles class="h-3.5 w-3.5 text-amber-400" />
          <span class="text-sm font-medium">
            {{
              $t("pages.settings.application.demo_settings.orphaned_highlights")
            }}
          </span>
          <span class="ml-auto text-xs tabular-nums text-muted-foreground">
            {{ clipPct }}%
          </span>
        </div>
        <div class="flex items-baseline gap-2 pl-5">
          <span class="text-xl font-semibold tabular-nums">
            {{ formatBytes(clipBytes) }}
          </span>
          <span class="text-xs text-muted-foreground tabular-nums">
            {{
              $t(
                "pages.settings.application.demo_settings.orphaned_highlights_count",
                { count: clipCount },
              )
            }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
