<script setup lang="ts">
import { computed } from "vue";
import { ChevronRight, Plus, TriangleAlert } from "lucide-vue-next";
import StatTile from "~/components/admin/StatTile.vue";
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

const split = computed(() =>
  t("pages.gpu_nodes.kpi.accounts_split", {
    used: props.health.total - props.health.free,
    free: props.health.free,
  }),
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
  <StatTile
    class="group"
    :tone="loaded && warn ? 'warn' : undefined"
    @click="emit('open', status === 'empty' || status === 'short')"
  >
    <template #label>
      <span class="flex items-center gap-2">
        <span class="grow truncate">{{
          $t("pages.gpu_nodes.steam_pool.name")
        }}</span>
        <ChevronRight
          class="size-3.5 shrink-0 text-muted-foreground/60 transition-colors duration-150 group-hover:text-foreground"
          aria-hidden="true"
        />
      </span>
    </template>

    <span v-if="!loaded" class="text-muted-foreground">—</span>
    <span
      v-else-if="status === 'empty'"
      class="text-[15px] font-semibold leading-tight"
      >{{ $t("pages.gpu_nodes.steam_pool.empty_title") }}</span
    >
    <template v-else>{{ health.total }}</template>

    <template v-if="loaded && status !== 'empty'" #aside>{{ split }}</template>

    <template v-if="loaded" #sub>
      <span v-if="status === 'empty'" class="grid gap-2">
        <span>{{ $t("pages.gpu_nodes.steam_pool.empty_body") }}</span>
        <span
          class="inline-flex h-7 w-fit items-center gap-1.5 rounded-md bg-[hsl(var(--tac-amber))] px-2.5 font-medium text-[hsl(var(--tac-amber-foreground))] transition-colors duration-150 group-hover:bg-[hsl(var(--tac-amber)/0.9)]"
          aria-hidden="true"
        >
          <Plus class="size-3.5" />
          {{ $t("pages.gpu_nodes.steam_pool.add_account") }}
        </span>
      </span>
      <span v-else class="grid gap-1.5">
        <span class="flex h-1.5 gap-0.5" aria-hidden="true">
          <span
            v-for="segment in segments"
            :key="segment.id"
            class="flex-1 rounded-sm transition-colors duration-150"
            :class="segment.held ? 'bg-[hsl(var(--tac-amber))]' : 'bg-muted'"
          />
        </span>
        <span class="flex items-start gap-1.5" :class="warn && 'text-warning'">
          <TriangleAlert v-if="warn" class="mt-px size-3.5 shrink-0" />
          <span>{{ statusLine }}</span>
        </span>
      </span>
    </template>

    <span class="sr-only">{{ $t("pages.gpu_nodes.steam_pool.manage") }}</span>
  </StatTile>
</template>
