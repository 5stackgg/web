<script setup lang="ts">
import { computed } from "vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import {
  regionLabel,
  regionMode,
  regionStatusKey,
  regionTone,
} from "~/components/regions/regionStatus";

const props = defineProps<{
  region: {
    value: string;
    description?: string | null;
    status?: string | null;
    steam_relay: boolean;
    is_lan: boolean;
    available_server_count?: number | null;
    total_server_count?: number | null;
    game_server_nodes?: Array<{
      enabled?: boolean | null;
      enabled_for_match_making?: boolean | null;
    }>;
  };
  current: boolean;
}>();

defineEmits<{ (e: "select"): void }>();

const label = computed(() => regionLabel(props.region));
const mode = computed(() => regionMode(props.region));
</script>

<template>
  <button
    type="button"
    :aria-current="current"
    class="relative z-[1] grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-md px-3 py-2 text-left outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-ring"
    :class="
      current
        ? 'bg-[hsl(var(--tac-amber)/0.06)] text-foreground hover:bg-[hsl(var(--tac-amber)/0.08)]'
        : 'text-muted-foreground hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-foreground'
    "
    @click="$emit('select')"
  >
    <span class="inline-flex shrink-0">
      <StatusDot :tone="regionTone(region.status)" />
      <span class="sr-only">{{
        $t(regionStatusKey(region.status, region.game_server_nodes))
      }}</span>
    </span>

    <span class="grid min-w-0">
      <span class="truncate text-[13px]">{{ label }}</span>
      <span
        class="flex h-4 min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground/70"
      >
        <span
          v-if="label !== region.value"
          class="truncate font-mono text-[11px] tracking-[0.04em]"
          >{{ region.value }}</span
        >
        <Transition name="region-mode" mode="out-in">
          <span
            v-if="mode"
            :key="mode"
            class="flex shrink-0 items-center gap-1.5"
          >
            <span v-if="label !== region.value" aria-hidden="true">·</span>
            {{
              mode === "lan"
                ? $t("pages.regions.list.flag_lan")
                : $t("pages.regions.list.flag_relay")
            }}
          </span>
        </Transition>
      </span>
    </span>

    <span class="text-xs tabular-nums">
      <template v-if="region.total_server_count">
        <span aria-hidden="true"
          >{{ region.available_server_count ?? 0 }}/{{
            region.total_server_count
          }}</span
        >
        <span class="sr-only">{{
          $t("pages.regions.detail.servers_free", {
            free: region.available_server_count ?? 0,
            total: region.total_server_count,
          })
        }}</span>
      </template>
      <template v-else>—</template>
    </span>
  </button>
</template>

<style scoped>
.region-mode-enter-active {
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.region-mode-leave-active {
  transition: opacity 110ms ease-in;
}
.region-mode-enter-from,
.region-mode-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .region-mode-enter-active,
  .region-mode-leave-active {
    transition-duration: 1ms;
  }
}
</style>
