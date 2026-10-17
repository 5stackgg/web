<script setup lang="ts">
import { computed } from "vue";
import { Button } from "~/components/ui/button";
import GpuKindIcon from "~/components/gpu-nodes/GpuKindIcon.vue";
import GpuSessionState from "~/components/gpu-nodes/GpuSessionState.vue";
import {
  formatElapsed,
  gpuShortName,
  nodeName,
  type GpuSession,
} from "~/components/gpu-nodes/gpuSessions";
import { useGpuNodeActions } from "~/composables/useGpuNodeActions";

const props = defineProps<{
  session: GpuSession;
  node: any;
  now: number;
  /** Its GPU's panel is open. */
  selected?: boolean;
}>();

const emit = defineEmits<{
  (e: "open"): void;
  (e: "stop"): void;
}>();

const { bakeBusy, cancelBake } = useGpuNodeActions();

const kindKey = computed(() => {
  const { kind, liveMode } = props.session;
  if (kind === "live") return liveMode === "tv" ? "live_tv" : "live_direct";
  return kind;
});

const elapsed = computed(() =>
  props.session.startedAt === null
    ? null
    : formatElapsed(props.now - props.session.startedAt),
);

function onRowClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest("a, button")) return;
  emit("open");
}
</script>

<template>
  <tr
    class="gpn-row cursor-pointer border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
    tabindex="0"
    :aria-selected="selected"
    @click="onRowClick"
    @keydown.enter.self="emit('open')"
  >
    <td class="px-3 py-2.5">
      <span class="inline-flex items-center gap-2 whitespace-nowrap">
        <GpuKindIcon :kind="session.kind" />
        {{ $t(`pages.gpu_nodes.kind.${kindKey}`) }}
      </span>
    </td>
    <td class="max-w-[260px] px-3 py-2.5">
      <div class="grid min-w-0 gap-0.5">
        <template v-if="session.kind === 'live'">
          <span class="truncate font-semibold">{{
            session.matchup || $t("gpu_pool_status.live_match")
          }}</span>
          <span class="text-xs text-muted-foreground">{{
            $t("pages.gpu_nodes.who.spectators")
          }}</span>
        </template>
        <template v-else-if="session.kind === 'bake'">
          <span class="font-semibold">{{ $t("common.system") }}</span>
          <span class="text-xs text-muted-foreground">{{
            $t("pages.gpu_nodes.who.warming_cache")
          }}</span>
        </template>
        <template v-else>
          <span class="truncate font-semibold">{{
            session.who ||
            (session.system
              ? $t("common.system")
              : $t("gpu_pool_status.unknown_user"))
          }}</span>
          <NuxtLink
            v-if="session.matchId && session.matchup"
            :to="{ name: 'matches-id', params: { id: session.matchId } }"
            class="truncate text-xs text-muted-foreground underline decoration-dotted underline-offset-[3px] transition-colors hover:text-[hsl(var(--tac-amber))]"
          >
            {{ session.matchup }}
          </NuxtLink>
        </template>
      </div>
    </td>
    <td class="px-3 py-2.5">
      <div class="grid min-w-0 gap-0.5">
        <span class="truncate">{{
          gpuShortName(node) || $t("pages.gpu_nodes.gpu_unknown")
        }}</span>
        <NuxtLink
          :to="{ path: '/game-server-nodes', query: { node: node.id } }"
          class="max-w-[200px] truncate text-xs text-muted-foreground underline decoration-dotted underline-offset-[3px] transition-colors hover:text-[hsl(var(--tac-amber))]"
          :class="node.label ? '' : 'font-mono'"
        >
          {{ nodeName(node) }}
        </NuxtLink>
      </div>
    </td>
    <td class="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
      <span v-if="session.account">{{ session.account }}</span>
      <span v-else class="font-sans text-muted-foreground">{{
        $t("common.none")
      }}</span>
    </td>
    <td class="px-3 py-2.5">
      <GpuSessionState :session="session" />
    </td>
    <td
      class="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground"
    >
      {{ elapsed ?? "—" }}
    </td>
    <td class="px-3 py-2.5 text-right">
      <Button
        v-if="session.kind === 'bake'"
        size="xs"
        variant="outline"
        class="text-xs"
        :loading="bakeBusy[session.nodeId]"
        @click="cancelBake(session.nodeId)"
      >
        {{ $t("pages.gpu_nodes.bake.cancel") }}
      </Button>
      <Button
        v-else
        size="xs"
        variant="outline"
        class="border-destructive/40 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
        @click="emit('stop')"
      >
        {{ $t("pages.gpu_nodes.stop") }}
      </Button>
    </td>
  </tr>
</template>

<style scoped>
.gpn-row[aria-selected="true"] > td {
  background: hsl(240 4% 10.5%);
}
.gpn-row[aria-selected="true"] > td:first-child {
  box-shadow: inset 2px 0 0 hsl(var(--tac-amber));
}
</style>
