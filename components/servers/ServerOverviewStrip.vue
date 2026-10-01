<script setup lang="ts">
import { computed } from "vue";
import { useNow } from "@vueuse/core";
import { useCommunityFormat } from "~/composables/useCommunityFormat";
import type {
  ServerRecentTotals,
  ServerRosterStatus,
} from "~/types/serverOverview";

const props = defineProps<{
  status: ServerRosterStatus | null;
  totals: ServerRecentTotals | null;
  maxPlayers?: number | null;
}>();

const format = useCommunityFormat();
const now = useNow({ interval: 15 * 1000 });

const count = computed(() => props.status?.count ?? 0);

const occupancy = computed(() =>
  props.maxPlayers
    ? Math.min(100, Math.round((count.value / props.maxPlayers) * 100))
    : null,
);

const averageSession = computed(() =>
  props.totals && props.totals.sessions > 0
    ? props.totals.seconds / props.totals.sessions
    : 0,
);

const labelClasses =
  "font-mono text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground";
const valueClasses =
  "flex items-baseline gap-1 text-[1.45rem] font-bold leading-none tabular-nums";
const subClasses = "truncate font-mono text-[0.66rem] text-muted-foreground";
</script>

<template>
  <div
    class="grid grid-cols-4 border-t border-border max-md:grid-cols-2"
    data-testid="server-overview"
  >
    <div
      class="flex min-w-0 flex-col gap-1.5 px-6 py-3 max-sm:px-4 max-md:border-b max-md:border-border"
    >
      <span :class="labelClasses">{{ $t("common.online") }}</span>
      <span :class="valueClasses" data-testid="overview-online">
        {{ count }}
        <small
          v-if="maxPlayers"
          class="text-[0.85rem] font-semibold text-muted-foreground"
        >
          / {{ maxPlayers }}
        </small>
      </span>
      <span
        v-if="occupancy !== null"
        class="mt-0.5 h-[3px] overflow-hidden rounded-sm bg-muted"
        aria-hidden="true"
      >
        <span
          class="block h-full rounded-sm bg-[hsl(var(--tac-amber))] transition-[width] duration-500 motion-reduce:transition-none"
          :style="{ width: `${occupancy}%` }"
        />
      </span>
    </div>

    <div
      class="flex min-w-0 flex-col gap-1.5 border-l border-border px-6 py-3 max-sm:px-4 max-md:border-b"
    >
      <span :class="labelClasses">
        {{ $t("community.recent.unique_24h") }}
      </span>
      <span :class="valueClasses">{{
        totals ? format.count(totals.day) : "—"
      }}</span>
      <span v-if="totals" :class="subClasses">
        {{ format.count(totals.week) }} ·
        {{ $t("community.recent.unique_7d") }}
      </span>
    </div>

    <div
      class="flex min-w-0 flex-col gap-1.5 px-6 py-3 max-sm:px-4 md:border-l md:border-border"
    >
      <span :class="labelClasses">
        {{ $t("community.recent.avg_session") }}
      </span>
      <span :class="valueClasses">{{
        totals ? format.played(averageSession) : "—"
      }}</span>
      <span v-if="totals" :class="subClasses">
        {{ $t("community.recent.per_visit") }}
      </span>
    </div>

    <div
      class="flex min-w-0 flex-col gap-1.5 border-l border-border px-6 py-3 max-sm:px-4"
      data-testid="overview-plugin"
    >
      <span :class="labelClasses">
        {{ $t("pages.dedicated_servers.detail.player_management") }}
      </span>
      <span
        class="flex min-w-0 items-center gap-2 font-mono text-[0.82rem] font-semibold leading-[1.3]"
      >
        <span
          class="h-[7px] w-[7px] shrink-0 rounded-full"
          :class="
            status?.pluginActive ? 'bg-success' : 'bg-[hsl(var(--tac-amber))]'
          "
        />
        <span class="truncate">
          <template v-if="status?.pluginVersion">
            {{ status.pluginVersion
            }}<template v-if="status.pluginRuntime">
              · {{ status.pluginRuntime }}</template
            >
          </template>
          <template v-else>—</template>
        </span>
      </span>
      <span :class="subClasses">
        <template v-if="status?.pluginActive && status.pluginSeenAt">
          {{
            $t(
              "pages.dedicated_servers.detail.player_management_plugin.last_check_in",
            )
          }}
          {{ format.ago(status.pluginSeenAt, { now: now.getTime() }) }}
        </template>
        <template v-else>
          {{
            $t(
              "pages.dedicated_servers.detail.player_management_plugin.not_detected_title",
            )
          }}
        </template>
      </span>
    </div>
  </div>
</template>
