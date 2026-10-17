<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import NodeRow, {
  type RowAction,
} from "~/components/game-server-nodes/NodeRow.vue";
import { ArrowDown, ArrowUp } from "lucide-vue-next";
import type {
  DiskThresholds,
  IssueContext,
  NodeLike,
} from "~/components/game-server-nodes/nodeState";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

// The calm table: one row per node, no expansion. The picked row wears one
// amber edge that glides to the next row picked by click and snaps for the
// keyboard.
const props = defineProps<{
  nodes: Array<NodeLike & Record<string, any>>;
  pickedId: string | null;
  multiIds: Array<string>;
  focusId: string | null;
  edgeGlide: boolean;
  sort: "asc" | "desc";
  gameVersions: Array<Record<string, any>>;
  context: IssueContext;
  diskThresholds: DiskThresholds;
  stats: Record<string, any>;
  showLoad: boolean;
}>();

const emit = defineEmits<{
  pick: [id: string, event: MouseEvent | KeyboardEvent];
  action: [action: RowAction, id: string];
  focusRow: [id: string];
  sort: [];
}>();

const { t } = useI18n();

const wrap = ref<HTMLElement | null>(null);
const edge = ref<HTMLElement | null>(null);

const isSelected = (id: string) =>
  props.multiIds.length > 1
    ? props.multiIds.includes(id)
    : id === props.pickedId;

const tabbableId = () => {
  const ids = props.nodes.map((node) => node.id);
  const preferred = props.focusId || props.pickedId;
  return preferred && ids.includes(preferred) ? preferred : (ids[0] ?? null);
};

const reduced = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function placeEdge(glide: boolean) {
  const bar = edge.value;
  const box = wrap.value;
  if (!bar || !box) {
    return;
  }
  const row =
    props.multiIds.length > 1 || !props.pickedId
      ? null
      : box.querySelector<HTMLElement>(
          `tr[data-node="${CSS.escape(props.pickedId)}"]`,
        );
  if (!row) {
    bar.style.opacity = "0";
    return;
  }
  const y =
    row.getBoundingClientRect().top -
    box.getBoundingClientRect().top -
    box.clientTop;
  const snap = !glide || bar.style.opacity !== "1" || reduced();
  if (snap) {
    bar.style.transition = "none";
  }
  bar.style.height = `${row.offsetHeight}px`;
  bar.style.transform = `translateY(${y}px)`;
  bar.style.opacity = "1";
  if (snap) {
    void bar.offsetWidth;
    bar.style.transition = "";
  }
}

watch(
  () => [props.pickedId, props.multiIds.length > 1],
  () => nextTick(() => placeEdge(props.edgeGlide)),
  { flush: "post" },
);
watch(
  () => props.nodes.map((node) => node.id).join(),
  () => nextTick(() => placeEdge(false)),
  { flush: "post" },
);

let observer: ResizeObserver | null = null;
onMounted(() => {
  placeEdge(false);
  if (typeof ResizeObserver !== "undefined" && wrap.value) {
    observer = new ResizeObserver(() => placeEdge(false));
    observer.observe(wrap.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="gsn-list">
    <div ref="wrap" class="gsn-wrap">
      <span ref="edge" class="gsn-edge" aria-hidden="true"></span>
      <table class="gsn-table">
        <thead>
          <tr>
            <th>
              <button
                type="button"
                class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                :aria-label="
                  sort === 'desc'
                    ? t('common.sort_ascending')
                    : t('common.sort_descending')
                "
                @click="emit('sort')"
              >
                {{ t("pages.game_server_nodes.table.node") }}
                <ArrowUp v-if="sort === 'desc'" class="h-3 w-3" />
                <ArrowDown v-else class="h-3 w-3" />
              </button>
            </th>
            <th class="gsn-c-load">
              {{ t("pages.game_server_nodes.table.load") }}
            </th>
            <th class="gsn-c-cs2">CS2</th>
            <th class="gsn-c-cap text-right">
              <FiveStackToolTip as-child :delay-duration="120" side="bottom">
                <template #trigger>
                  <span
                    class="cursor-help underline decoration-muted-foreground/70 decoration-dotted underline-offset-[3px]"
                    tabindex="0"
                    >{{ t("pages.game_server_nodes.table.capacity") }}</span
                  >
                </template>
                <span class="block max-w-[16rem]">{{
                  t(`${INSPECTOR}.capacity_tip`)
                }}</span>
              </FiveStackToolTip>
            </th>
            <th class="gsn-c-region">{{ t("common.region") }}</th>
            <th class="gsn-c-attn">
              <span class="sr-only">{{
                t("pages.system_metrics.scope_attention")
              }}</span>
            </th>
            <th class="gsn-c-more">
              <span class="sr-only">{{ t("common.actions_label") }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <NodeRow
            v-for="node of nodes"
            :key="node.id"
            :node="node"
            :selected="isSelected(node.id)"
            :in-selection="multiIds.includes(node.id)"
            :tabbable="node.id === tabbableId()"
            :game-versions="gameVersions"
            :context="context"
            :disk-thresholds="diskThresholds"
            :stats="stats[node.id]"
            :show-load="showLoad"
            @pick="(id, event) => emit('pick', id, event)"
            @action="(action, id) => emit('action', action, id)"
            @focus-row="(id) => emit('focusRow', id)"
          />
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.gsn-list {
  container: gsn-list / inline-size;
  min-width: 0;
}
.gsn-wrap {
  position: relative;
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  background: hsl(var(--card) / 0.3);
}
.gsn-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}
.gsn-table th {
  padding: 9px 12px;
  border-bottom: 1px solid hsl(var(--border));
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}
.gsn-table th.text-right {
  text-align: right;
}
.gsn-table :deep(td) {
  height: 54px;
  padding: 0 12px;
  border-bottom: 1px solid hsl(var(--border) / 0.6);
  vertical-align: middle;
  transition: background-color 120ms ease;
}
.gsn-table :deep(.gsn-row:last-child td) {
  border-bottom: 0;
}
.gsn-table :deep(.gsn-row:last-child td:first-child) {
  border-bottom-left-radius: 0.5rem;
}
.gsn-table :deep(.gsn-row:last-child td:last-child) {
  border-bottom-right-radius: 0.5rem;
}
.gsn-table :deep(.gsn-row) {
  cursor: pointer;
}
.gsn-table :deep(.gsn-row:hover td) {
  background: hsl(240 4% 8.5%);
}
.gsn-table :deep(.gsn-row[aria-selected="true"] td) {
  background: hsl(240 4% 10.5%);
}
.gsn-table :deep(.gsn-row[data-off="true"] td) {
  color: hsl(var(--muted-foreground));
}
.gsn-table :deep(.gsn-row:focus-visible) {
  outline: 2px solid hsl(var(--tac-amber) / 0.5);
  outline-offset: -2px;
}
.gsn-table :deep(.gsn-row[aria-selected="true"]:focus-visible) {
  outline: none;
}
.gsn-table .gsn-c-region {
  width: 150px;
}
.gsn-table .gsn-c-cap {
  width: 112px;
}
.gsn-table .gsn-c-cs2 {
  width: 140px;
}
.gsn-table .gsn-c-load {
  width: 136px;
}
.gsn-table .gsn-c-attn,
.gsn-table :deep(.gsn-c-attn) {
  width: 40px;
  padding-inline: 0;
  text-align: center;
}
.gsn-table .gsn-c-more,
.gsn-table :deep(.gsn-c-more) {
  width: 48px;
  padding-left: 0;
  text-align: right;
}
.gsn-table :deep(.gsn-row-region) {
  display: none;
}
.gsn-edge {
  position: absolute;
  z-index: 1;
  left: -1px;
  top: 0;
  width: 2px;
  height: 54px;
  border-radius: 2px;
  background: hsl(var(--tac-amber));
  opacity: 0;
  pointer-events: none;
  transition:
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 150ms ease;
}
/* Region goes first (it moves under the node's name), then CS2; Load holds
   on until phone width. */
@container gsn-list (max-width: 820px) {
  .gsn-table .gsn-c-region,
  .gsn-table :deep(.gsn-c-region) {
    display: none;
  }
  .gsn-table :deep(.gsn-row-region) {
    display: inline;
  }
}
@container gsn-list (max-width: 600px) {
  .gsn-table .gsn-c-cs2,
  .gsn-table :deep(.gsn-c-cs2) {
    display: none;
  }
}
@container gsn-list (max-width: 460px) {
  .gsn-table .gsn-c-load,
  .gsn-table :deep(.gsn-c-load) {
    display: none;
  }
  .gsn-table .gsn-c-cap {
    width: 92px;
  }
  .gsn-table th,
  .gsn-table :deep(td) {
    padding-inline: 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .gsn-edge {
    transition: none;
  }
}
</style>
