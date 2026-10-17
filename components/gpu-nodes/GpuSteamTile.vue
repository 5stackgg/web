<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight, Plus, TriangleAlert } from "lucide-vue-next";
import {
  steamTileStatus,
  type GpuPoolHealth,
} from "~/components/gpu-nodes/gpuSessions";

// The Steam account pool as a stat tile: how many, how many are in use, and
// whether the GPUs are short of one. The whole tile opens the pool's sheet.
const props = defineProps<{
  accounts: Array<{ id: string; claims?: unknown[] }>;
  health: GpuPoolHealth;
  loaded: boolean;
}>();

const emit = defineEmits<{
  /** `add`: open on the add form, because the pool needs another account. */
  (e: "open", add: boolean): void;
}>();

const { t } = useI18n();

const status = computed(() => steamTileStatus(props.health));
const warn = computed(
  () =>
    status.value === "empty" ||
    status.value === "short" ||
    status.value === "busy",
);

// Holding accounts first, like the pool table.
const segments = computed(() =>
  props.accounts
    .map((account) => ({
      id: account.id,
      held: (account.claims?.length ?? 0) > 0,
    }))
    .sort((a, b) => Number(b.held) - Number(a.held)),
);

const statusLine = computed(() => {
  switch (status.value) {
    case "no_nodes":
      return t("pages.gpu_nodes.steam_pool.health_no_nodes");
    case "short":
      return t("pages.gpu_nodes.kpi.accounts_short", {
        count: props.health.short,
      });
    case "busy":
      return t("pages.gpu_nodes.kpi.accounts_busy");
    default:
      return t("pages.gpu_nodes.steam_pool.health_enough");
  }
});
</script>

<template>
  <button
    type="button"
    class="group grid content-start gap-1.5 rounded-md border bg-card/40 px-3.5 py-3 text-left transition-colors duration-150 hover:border-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    :class="
      loaded && status === 'empty'
        ? 'border-[hsl(var(--tac-amber)/0.45)]'
        : 'border-border'
    "
    @click="emit('open', status === 'empty' || status === 'short')"
  >
    <span class="flex items-center gap-2 text-xs text-muted-foreground">
      <span class="grow">{{ $t("pages.gpu_nodes.steam_pool.name") }}</span>
      <ChevronRight
        class="h-3.5 w-3.5 text-muted-foreground/60 transition-colors duration-150 group-hover:text-foreground"
        aria-hidden="true"
      />
    </span>

    <span
      v-if="!loaded"
      class="text-[26px] font-bold leading-none text-muted-foreground/50"
      >—</span
    >

    <template v-else-if="status === 'empty'">
      <span class="text-[15px] font-semibold leading-tight">{{
        $t("pages.gpu_nodes.steam_pool.empty_title")
      }}</span>
      <span class="text-xs text-muted-foreground">{{
        $t("pages.gpu_nodes.steam_pool.empty_body")
      }}</span>
      <span
        class="mt-1 inline-flex h-7 w-fit items-center gap-1.5 rounded-md bg-[hsl(var(--tac-amber))] px-2.5 text-xs font-medium text-[hsl(var(--tac-amber-foreground))] transition-colors duration-150 group-hover:bg-[hsl(var(--tac-amber)/0.9)]"
        aria-hidden="true"
      >
        <Plus class="h-3.5 w-3.5" />
        {{ $t("pages.gpu_nodes.steam_pool.add_account") }}
      </span>
    </template>

    <template v-else>
      <!-- Half-width on phones: the split wraps under the count. -->
      <span
        class="text-[26px] font-bold leading-none tabular-nums max-sm:flex max-sm:flex-wrap max-sm:items-baseline max-sm:gap-x-1.5 max-sm:gap-y-1"
      >
        {{ health.total
        }}<small
          class="ml-1.5 text-sm font-semibold text-muted-foreground max-sm:ml-0"
          >{{
            $t("pages.gpu_nodes.kpi.accounts_split", {
              used: health.total - health.free,
              free: health.free,
            })
          }}</small
        >
      </span>
      <span class="flex h-1.5 gap-0.5" aria-hidden="true">
        <span
          v-for="segment in segments"
          :key="segment.id"
          class="flex-1 rounded-sm transition-colors duration-150"
          :class="segment.held ? 'bg-[hsl(var(--tac-amber))]' : 'bg-muted'"
        />
      </span>
      <span
        class="flex items-start gap-1.5 text-xs"
        :class="warn ? 'text-yellow-500' : 'text-muted-foreground'"
      >
        <TriangleAlert v-if="warn" class="mt-px h-3.5 w-3.5 shrink-0" />
        <span>{{ statusLine }}</span>
      </span>
    </template>

    <span class="sr-only">{{ $t("pages.gpu_nodes.steam_pool.manage") }}</span>
  </button>
</template>
