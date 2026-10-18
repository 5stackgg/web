<script setup lang="ts">
import { computed, ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { RefreshCw, ChevronDown, Globe, X } from "lucide-vue-next";
import NodeStatusDot from "~/components/game-server-nodes/NodeStatusDot.vue";
import NodeCs2Chip from "~/components/game-server-nodes/NodeCs2Chip.vue";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";
import {
  canUpdateCs,
  isGpuOnly,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";

// The inspector turned bulk panel, for two or more picked rows. The api has
// no bulk mutation, so every action walks the selected nodes one by one with
// the same per-node mutation the inspector uses, counting as it goes.
const props = withDefaults(
  defineProps<{
    nodes: Array<NodeLike>;
    regions: Array<{ value: string; description?: string | null }>;
    currentBuildId?: number | string | null;
    gameVersions?: Array<Record<string, any>>;
  }>(),
  { currentBuildId: null, gameVersions: () => [] },
);

const emit = defineEmits<{
  (e: "clear"): void;
  (e: "unpick", id: string): void;
}>();

const modifier =
  typeof navigator !== "undefined" && /Mac|iP/.test(navigator.platform || "")
    ? "⌘"
    : "Ctrl";

const { t } = useI18n();
const { client } = useApolloClient();

const progress = ref<{ done: number; total: number } | null>(null);

const updatable = computed(() =>
  props.nodes.filter((node) => canUpdateCs(node, props.currentBuildId)),
);
const movable = computed(() => props.nodes.filter((node) => !isGpuOnly(node)));
const toEnable = computed(() => props.nodes.filter((node) => !node.enabled));
const toDisable = computed(() => props.nodes.filter((node) => !!node.enabled));

async function run(
  targets: Array<NodeLike>,
  mutationFor: (node: NodeLike) => unknown,
) {
  let failed = 0;
  progress.value = { done: 0, total: targets.length };
  for (const node of targets) {
    try {
      await client.mutate({ mutation: mutationFor(node) as any });
    } catch {
      failed++;
    }
    progress.value = { done: progress.value.done + 1, total: targets.length };
  }
  progress.value = null;
  return { done: targets.length - failed, failed };
}

function report(
  { done, failed }: { done: number; failed: number },
  title: string,
) {
  toast({
    title,
    description: failed
      ? t("pages.game_server_nodes.bulk.failed", { count: failed }, failed)
      : undefined,
    variant: failed && !done ? "destructive" : undefined,
  });
}

const setNode = (node: NodeLike, _set: Record<string, unknown>) =>
  generateMutation({
    update_game_server_nodes_by_pk: [
      { pk_columns: { id: node.id }, _set: _set as any },
      { __typename: true },
    ],
  });

async function updateCs() {
  const result = await run(updatable.value, (node) =>
    generateMutation({
      updateCs: [{ game_server_node_id: node.id }, { success: true }],
    }),
  );
  report(
    result,
    t(
      "pages.game_server_nodes.bulk.updating",
      { count: result.done },
      result.done,
    ),
  );
}

async function moveTo(region: string | null) {
  const result = await run(movable.value, (node) => setNode(node, { region }));
  const name =
    props.regions.find((option) => option.value === region)?.description ||
    region;
  report(
    result,
    region
      ? t(
          "pages.game_server_nodes.bulk.moved",
          { count: result.done, region: name },
          result.done,
        )
      : t(
          "pages.game_server_nodes.bulk.unassigned",
          { count: result.done },
          result.done,
        ),
  );
}

async function setEnabled(enabled: boolean) {
  const result = await run(enabled ? toEnable.value : toDisable.value, (node) =>
    setNode(node, { enabled }),
  );
  report(
    result,
    t(
      enabled
        ? "pages.game_server_nodes.bulk.enabled"
        : "pages.game_server_nodes.bulk.disabled",
      { count: result.done },
      result.done,
    ),
  );
}
</script>

<template>
  <div
    role="region"
    :aria-label="
      t(`${INSPECTOR}.bulk.title`, { count: nodes.length }, nodes.length)
    "
  >
    <header
      class="sticky top-0 z-[3] grid gap-0.5 border-b border-border bg-[hsl(240_6%_7%)] py-3 pl-4 pr-3"
    >
      <div class="flex min-w-0 items-center gap-2">
        <h2
          class="min-w-0 flex-1 truncate text-base font-bold leading-[30px] tabular-nums"
        >
          {{
            t(`${INSPECTOR}.bulk.title`, { count: nodes.length }, nodes.length)
          }}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          class="h-8 w-8 shrink-0"
          :disabled="!!progress"
          :aria-label="t(`${INSPECTOR}.bulk.clear`)"
          @click="emit('clear')"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ t(`${INSPECTOR}.bulk.hint`, { modifier }) }}
      </p>
    </header>

    <section class="grid gap-2.5 p-4">
      <h3 class="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
        {{ t(`${INSPECTOR}.bulk.apply`) }}
        <span
          v-if="progress"
          class="ml-auto text-xs font-normal tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {{ t("pages.game_server_nodes.bulk.progress", progress) }}
        </span>
      </h3>
      <div class="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          :disabled="!updatable.length || !!progress"
          @click="updateCs"
        >
          <RefreshCw class="h-3.5 w-3.5" />
          {{ t("game_server.update_cs") }}
          <span
            v-if="updatable.length"
            class="tabular-nums text-muted-foreground"
            >({{ updatable.length }})</span
          >
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              :disabled="!movable.length || !!progress"
            >
              <Globe class="h-3.5 w-3.5" />
              {{ t("pages.game_server_nodes.bulk.move_region") }}
              <ChevronDown class="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            class="max-h-72 w-56 overflow-y-auto"
          >
            <DropdownMenuItem @click="moveTo(null)">
              <span class="text-muted-foreground">{{
                t("game_server.no_region")
              }}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator v-if="regions.length" />
            <DropdownMenuItem
              v-for="region of regions"
              :key="region.value"
              @click="moveTo(region.value)"
            >
              {{ region.description || region.value }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          :disabled="!toEnable.length || !!progress"
          @click="setEnabled(true)"
        >
          {{ t("pages.game_server_nodes.bulk.enable") }}
          <span
            v-if="toEnable.length"
            class="tabular-nums text-muted-foreground"
            >({{ toEnable.length }})</span
          >
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="!toDisable.length || !!progress"
          @click="setEnabled(false)"
        >
          {{ t("pages.game_server_nodes.bulk.disable") }}
          <span
            v-if="toDisable.length"
            class="tabular-nums text-muted-foreground"
            >({{ toDisable.length }})</span
          >
        </Button>
      </div>
      <p class="text-xs leading-snug text-muted-foreground">
        {{ t(`${INSPECTOR}.bulk.note`) }}
      </p>
    </section>

    <section class="grid gap-2.5 border-t border-border/60 p-4">
      <h3 class="text-[13px] font-semibold">
        {{ t(`${INSPECTOR}.bulk.selected`) }}
      </h3>
      <ul class="grid gap-0.5">
        <li
          v-for="node of nodes"
          :key="node.id"
          class="flex min-h-8 min-w-0 items-center gap-2 text-[13px]"
        >
          <NodeStatusDot :node="node" />
          <span
            class="min-w-0 truncate"
            :class="!node.label && 'font-mono text-xs'"
            >{{ node.label || node.id }}</span
          >
          <span class="grow"></span>
          <NodeCs2Chip
            :node="node"
            :game-versions="gameVersions"
            :current-build-id="currentBuildId"
            :tip="false"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            class="h-6 w-6 shrink-0"
            :disabled="!!progress"
            :aria-label="
              t(`${INSPECTOR}.bulk.drop`, { node: node.label || node.id })
            "
            @click="emit('unpick', node.id)"
          >
            <X class="h-3 w-3" />
          </Button>
        </li>
      </ul>
    </section>
  </div>
</template>
