<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Check, ChevronDown, RotateCw } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { nodeIneligibility, type Cs2BuildNode } from "~/types/cs2Build";

const props = defineProps<{
  label: string;
  buildId: number;
  nodes: Array<Cs2BuildNode>;
  run: (gameServerNodeId: string | null) => unknown;
  blocked?: string | null;
  primary?: boolean;
}>();

const { t } = useI18n();

const AUTOMATIC = "auto";
const target = ref<string>(AUTOMATIC);

const options = computed(() =>
  props.nodes
    .filter((node) => !(node.gpu && !node.enabled_for_match_making))
    .map((node) => {
      const reason = nodeIneligibility(node, props.buildId);
      return {
        id: node.id,
        label: node.label || node.id,
        eligible: !reason,
        detail: reason
          ? t(`pages.game_server_nodes.cs2_build.node_reason.${reason.key}`, {
              status: "status" in reason ? reason.status : "",
              build: "build" in reason ? reason.build : "",
            })
          : [node.status, node.build_id, node.e_region?.description]
              .filter(Boolean)
              .join(" · "),
      };
    })
    .sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        a.label.localeCompare(b.label),
    ),
);

const hasEligible = computed(() => options.value.some((node) => node.eligible));

const selected = computed(() =>
  options.value.find((node) => node.id === target.value && node.eligible),
);

const targetLabel = computed(() =>
  selected.value
    ? selected.value.label
    : t("pages.game_server_nodes.cs2_build.auto"),
);

const blockedReason = computed(
  () =>
    props.blocked ??
    (hasEligible.value
      ? null
      : t("pages.game_server_nodes.cs2_build.blocked.no_node", {
          build: props.buildId,
        })),
);

const ACCENT =
  "border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.2)] hover:text-[hsl(var(--tac-amber))]";

function start() {
  return props.run(selected.value ? selected.value.id : null);
}
</script>

<template>
  <TooltipProvider :delay-duration="200">
    <Tooltip :disabled="!blockedReason">
      <TooltipTrigger as-child>
        <span class="inline-flex" :tabindex="blockedReason ? 0 : undefined">
          <ButtonGroup>
            <Button
              size="sm"
              variant="outline"
              :class="primary && ACCENT"
              :disabled="!!blockedReason"
              @click="start"
            >
              <RotateCw />
              {{ label }}
              <span
                class="rounded-sm px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-[0.08em]"
                :class="
                  primary
                    ? 'bg-[hsl(var(--tac-amber)/0.15)]'
                    : 'bg-muted/50 text-muted-foreground'
                "
              >
                {{ targetLabel }}
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  size="sm"
                  variant="outline"
                  class="px-2"
                  :class="primary && ACCENT"
                  :disabled="!!blocked"
                  :aria-label="$t('pages.game_server_nodes.cs2_build.run_on')"
                >
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-72">
                <DropdownMenuLabel
                  class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                >
                  {{ $t("pages.game_server_nodes.cs2_build.run_on") }}
                </DropdownMenuLabel>
                <DropdownMenuItem @select="target = AUTOMATIC">
                  <Check
                    class="text-[hsl(var(--tac-amber))]"
                    :class="{ invisible: selected }"
                  />
                  <span class="flex flex-col">
                    <span>{{ $t("pages.game_server_nodes.cs2_build.automatic") }}</span>
                    <span class="text-xs text-muted-foreground">
                      {{
                        $t("pages.game_server_nodes.cs2_build.automatic_description", {
                          build: buildId,
                        })
                      }}
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator v-if="options.length" />
                <DropdownMenuItem
                  v-for="node of options"
                  :key="node.id"
                  :disabled="!node.eligible"
                  @select="target = node.id"
                >
                  <Check
                    class="text-[hsl(var(--tac-amber))]"
                    :class="{ invisible: selected?.id !== node.id }"
                  />
                  <span class="flex min-w-0 flex-col">
                    <span class="truncate">{{ node.label }}</span>
                    <span class="truncate text-xs text-muted-foreground">
                      {{ node.detail }}
                    </span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" class="max-w-[18rem]">
        {{ blockedReason }}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
