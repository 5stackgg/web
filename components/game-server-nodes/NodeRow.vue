<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import SelectDot from "~/components/admin/SelectDot.vue";
import NodeStatusDot from "~/components/game-server-nodes/NodeStatusDot.vue";
import NodeControlMenu from "~/components/game-server-nodes/NodeControlMenu.vue";
import NodeCs2Chip from "~/components/game-server-nodes/NodeCs2Chip.vue";
import NodeLoadStack from "~/components/game-server-nodes/NodeLoadStack.vue";
import TweenNumber from "~/components/game-server-nodes/TweenNumber.vue";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  CircleAlert,
  Download,
  Ellipsis,
  FolderOpen,
  Info,
  ListChecks,
  Network,
  PanelRight,
  Pencil,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-vue-next";
import {
  hasPorts,
  isGpuOnly,
  isOffline,
  isReachable,
  type DiskThresholds,
  type IssueContext,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import {
  diskSize,
  nodeAttention,
} from "~/components/game-server-nodes/nodeInspector";
import {
  cpuSeries,
  latest,
  memorySeries,
} from "~/components/game-server-nodes/nodeMetrics";
import {
  attentionCopy,
  INSPECTOR,
} from "~/components/game-server-nodes/nodeCopy";
import { TONE_TEXT } from "~/components/admin/tone";

export type RowAction =
  | "open"
  | "update"
  | "update_csgo"
  | "rename"
  | "ports"
  | "files"
  | "select"
  | "remove";

const props = defineProps<{
  node: NodeLike & Record<string, any>;
  selected: boolean;
  inSelection: boolean;
  /** Something is selected: every row shows its checkbox. */
  selecting: boolean;
  gameVersions: Array<Record<string, any>>;
  context: IssueContext;
  diskThresholds: DiskThresholds;
  stats: any;
  showLoad: boolean;
}>();

const emit = defineEmits<{
  pick: [id: string, event: MouseEvent | KeyboardEvent];
  action: [action: RowAction, id: string];
  select: [id: string, event: MouseEvent];
}>();

const { t } = useI18n();

const name = computed(() => props.node.label || props.node.id);
const gpuOnly = computed(() => isGpuOnly(props.node));
const offline = computed(() => isOffline(props.node));
const reachable = computed(() => isReachable(props.node));
const inSetup = computed(() => props.node.status === "Setup");

const regionLabel = computed(() =>
  gpuOnly.value
    ? t("pages.game_server_nodes.gpu_only")
    : props.node.region
      ? props.node.e_region?.description || props.node.region
      : t("game_server.no_region"),
);

const sub = computed(() =>
  inSetup.value
    ? t(`${INSPECTOR}.status.setup`)
    : [props.node.label ? props.node.id.slice(0, 8) : "", props.node.lan_ip]
        .filter(Boolean)
        .join(" · "),
);

const ports = computed(() =>
  hasPorts(props.node)
    ? `${props.node.start_port_range}–${props.node.end_port_range}`
    : "",
);

const capacity = computed(() => {
  if (inSetup.value || gpuOnly.value) {
    return "none";
  }
  if (!props.node.enabled) {
    return "disabled";
  }
  if (offline.value) {
    return "offline";
  }
  return hasPorts(props.node) ? "free" : "no_ports";
});

const cpu = computed(() =>
  props.showLoad && reachable.value ? latest(cpuSeries(props.stats)) : null,
);
const memory = computed(() =>
  props.showLoad && reachable.value ? latest(memorySeries(props.stats)) : null,
);
const disk = computed(() => diskSize(props.node));
const showLive = computed(() => props.showLoad && reachable.value);

const attention = computed(() => nodeAttention(props.node, props.context));
const attentionTip = computed(() => {
  const titles = attention.value
    .slice(0, 3)
    .map(
      (item) =>
        attentionCopy(item, t, props.node, props.gameVersions as any).title,
    );
  const rest = attention.value.length - 3;
  return [
    ...titles,
    ...(rest > 0 ? [t(`${INSPECTOR}.more`, { count: rest })] : []),
  ].join(" · ");
});

function onClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest("button, a, input, select")) {
    return;
  }
  emit("pick", props.node.id, event);
}

// Shift-click picks a range; keep it from selecting the text in between.
function onMouseDown(event: MouseEvent) {
  if (event.shiftKey) {
    event.preventDefault();
  }
}

// Enter belongs to the list keyboard (useListKeyboard); Space opens too.
function onKeydown(event: KeyboardEvent) {
  if (event.target !== event.currentTarget) {
    return;
  }
  if (event.key === " ") {
    event.preventDefault();
    emit("pick", props.node.id, event);
  }
}
</script>

<template>
  <tr
    class="gsn-row group/row"
    :data-node="node.id"
    :data-off="!node.enabled"
    :aria-selected="selected"
    @click="onClick"
    @mousedown="onMouseDown"
    @keydown="onKeydown"
  >
    <td>
      <div class="flex min-w-0 items-center gap-2.5">
        <NodeControlMenu :node="node" align="start" class="shrink-0" />
        <SelectDot
          :checked="inSelection"
          :selecting="selecting"
          :label="t('pages.game_server_nodes.row.select', { node: name })"
          @toggle="(event) => emit('select', node.id, event)"
        >
          <NodeStatusDot :node="node" />
        </SelectDot>
        <div class="grid min-w-0 gap-0.5">
          <span
            class="truncate font-semibold"
            :class="!node.label && 'font-mono text-[12.5px] font-medium'"
            :title="name"
            >{{ name }}</span
          >
          <span class="truncate font-mono text-[11px] text-muted-foreground/70">
            {{ sub
            }}<span class="gsn-row-region font-sans"
              ><template v-if="sub"> · </template>{{ regionLabel }}</span
            >
          </span>
        </div>
      </div>
    </td>

    <td class="gsn-c-load">
      <NodeLoadStack
        :live="showLive && !inSetup"
        :cpu="cpu"
        :memory="memory"
        :disk="inSetup ? null : disk"
        :disk-thresholds="diskThresholds"
      />
    </td>
    <td class="gsn-c-cs2">
      <NodeCs2Chip
        :node="node"
        :game-versions="gameVersions"
        :current-build-id="context.currentBuildId"
      />
    </td>
    <td class="gsn-c-cap text-right">
      <span v-if="capacity === 'none'" class="text-muted-foreground/60">—</span>
      <div v-else class="grid justify-items-end gap-0.5 whitespace-nowrap">
        <span
          v-if="capacity === 'free'"
          class="tabular-nums"
          :class="node.available_server_count === 0 && 'text-muted-foreground'"
        >
          <i18n-t :keypath="`${INSPECTOR}.cap_free`" tag="span" scope="global">
            <template #free>
              <b class="font-semibold text-foreground"
                ><TweenNumber :value="node.available_server_count ?? 0"
              /></b>
            </template>
            <template #total>
              <span class="text-muted-foreground">{{
                node.total_server_count ?? 0
              }}</span>
            </template>
          </i18n-t>
        </span>
        <span v-else class="text-muted-foreground">{{
          capacity === "disabled"
            ? t("common.disabled")
            : capacity === "offline"
              ? t("common.offline")
              : t(`${INSPECTOR}.cap_no_ports`)
        }}</span>
        <span
          v-if="ports && capacity !== 'no_ports'"
          class="font-mono text-[11px] text-muted-foreground/70"
          >{{ ports }}</span
        >
      </div>
    </td>
    <td class="gsn-c-region">
      <span
        class="block truncate"
        :class="(gpuOnly || !node.region) && 'text-muted-foreground'"
        >{{ regionLabel }}</span
      >
    </td>

    <td class="gsn-c-attn">
      <FiveStackToolTip
        v-if="attention.length"
        as-child
        :delay-duration="120"
        side="left"
      >
        <template #trigger>
          <span
            class="inline-grid h-[26px] w-[26px] place-items-center rounded-md align-middle"
            :class="TONE_TEXT[attention[0].tone]"
            role="img"
            tabindex="-1"
            :aria-label="attentionTip"
          >
            <CircleAlert v-if="attention[0].tone === 'bad'" class="h-4 w-4" />
            <TriangleAlert
              v-else-if="attention[0].tone === 'warn'"
              class="h-4 w-4"
            />
            <Info v-else class="h-4 w-4" />
          </span>
        </template>
        <span class="block max-w-[18rem]">{{ attentionTip }}</span>
      </FiveStackToolTip>
    </td>

    <td class="gsn-c-more">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="h-8 w-8"
            :aria-label="t(`${INSPECTOR}.actions_for`, { node: name })"
          >
            <Ellipsis class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-60">
          <DropdownMenuItem @click="emit('action', 'open', node.id)">
            <PanelRight />
            <span>{{ t("pages.gpu_nodes.open_details") }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('action', 'select', node.id)">
            <ListChecks />
            <span>{{
              inSelection
                ? t(`${INSPECTOR}.menu.deselect`)
                : t(`${INSPECTOR}.menu.select`)
            }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            v-if="!gpuOnly && !inSetup"
            :disabled="!reachable || !!node.update_status"
            @click="emit('action', 'update', node.id)"
          >
            <RefreshCw v-if="node.build_id" />
            <Download v-else />
            <span>{{
              node.build_id
                ? t("game_server.update_cs")
                : t("game_server.install_cs")
            }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="!gpuOnly && !inSetup"
            :disabled="!reachable || !!node.csgo_update_status"
            @click="emit('action', 'update_csgo', node.id)"
          >
            <RefreshCw v-if="node.csgo_build_id" />
            <Download v-else />
            <span>{{
              node.csgo_build_id
                ? t("game_server.update_csgo")
                : t("game_server.install_csgo")
            }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('action', 'rename', node.id)">
            <Pencil />
            <span>{{ t(`${INSPECTOR}.menu.rename`) }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="!gpuOnly"
            @click="emit('action', 'ports', node.id)"
          >
            <Network />
            <span>{{
              ports
                ? t(`${INSPECTOR}.step.edit_ports`)
                : t(`${INSPECTOR}.step.set_ports`)
            }}</span>
            <span
              v-if="ports"
              class="ml-auto pl-2 font-mono text-xs text-muted-foreground"
              >{{ ports }}</span
            >
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('action', 'files', node.id)">
            <FolderOpen />
            <span>{{ t("game_server.files") }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="text-destructive focus:text-destructive"
            @click="emit('action', 'remove', node.id)"
          >
            <Trash2 />
            <span>{{ t(`${INSPECTOR}.remove`) }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </td>
  </tr>
</template>
