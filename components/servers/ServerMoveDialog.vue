<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  ArrowRightLeft,
  Check,
  Info,
  Server,
  TriangleAlert,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useServerMoveNodes } from "~/composables/useServerMigration";
import {
  MOVE_DEDICATED_SERVER_MUTATION,
  SERVER_MIGRATION_OPTIONAL,
} from "~/graphql/serverMigrationGraphql";
import {
  formatBytes,
  moveTargetIneligibility,
  type MigratingServer,
} from "~/types/serverMigration";

const props = defineProps<{
  open: boolean;
  server: MigratingServer | null;
  serverLabel: string;
  sourceReachable: boolean;
}>();

const emit = defineEmits<{ "update:open": [boolean] }>();

const { t } = useI18n();
const nuxtApp = useNuxtApp();
const { closeFiles } = useFilePopout();
const { nodes, loaded } = useServerMoveNodes(computed(() => props.open));

const target = ref<string | null>(null);
const withoutFiles = ref(false);

watch(
  () => props.open,
  (open) => {
    if (open) {
      target.value = null;
      withoutFiles.value = false;
    }
  },
);

const options = computed(() => {
  const server = props.server;

  if (!server) {
    return [];
  }

  return nodes.value
    .map((node) => {
      const reason = moveTargetIneligibility(node, server);

      return {
        node,
        label: node.label || node.id,
        eligible: !reason,
        detail: reason
          ? t(`pages.dedicated_servers.detail.move.reason.${reason.key}`, {
              game: "game" in reason ? reason.game : "",
            })
          : [
              node.e_region?.description || node.region,
              t("pages.dedicated_servers.detail.move.free_slots", {
                count: node.available_dedicated_slot_count ?? 0,
              }),
              node.disk_available_gb !== null
                ? t("pages.dedicated_servers.detail.move.free_disk", {
                    size: formatBytes(
                      node.disk_available_gb * 1024 * 1024 * 1024,
                    ),
                  })
                : null,
            ]
              .filter(Boolean)
              .join(" · "),
      };
    })
    .sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        a.label.localeCompare(b.label),
    );
});

const selected = computed(
  () =>
    options.value.find(
      (option) => option.node.id === target.value && option.eligible,
    )?.node ?? null,
);

const sourceLabel = computed(
  () =>
    props.server?.game_server_node?.label ||
    props.server?.game_server_node_id ||
    "",
);

const warnings = computed(() => {
  const node = selected.value;
  const server = props.server;

  if (!node || !server) {
    return [];
  }

  const list = [t("pages.dedicated_servers.detail.move.warning.address")];

  if (server.region && node.region && node.region !== server.region) {
    list.push(
      t("pages.dedicated_servers.detail.move.warning.region", {
        region: node.e_region?.description || node.region,
      }),
    );
  }

  if (
    node.pin_plugin_runtime &&
    server.plugin_runtime &&
    node.pin_plugin_runtime !== server.plugin_runtime
  ) {
    list.push(
      t("pages.dedicated_servers.detail.move.warning.runtime", {
        runtime: node.pin_plugin_runtime,
      }),
    );
  }

  return list;
});

const canMove = computed(
  () => !!selected.value && (props.sourceReachable || withoutFiles.value),
);

function errorMessage(error: any) {
  return (
    error?.graphQLErrors?.[0]?.message ||
    error?.networkError?.result?.errors?.[0]?.message ||
    error?.message ||
    t("common.error")
  );
}

async function move() {
  if (!props.server || !selected.value) {
    return;
  }

  const node = selected.value;

  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: MOVE_DEDICATED_SERVER_MUTATION,
      variables: {
        server_id: props.server.id,
        game_server_node_id: node.id,
        without_files: !props.sourceReachable,
      },
      context: SERVER_MIGRATION_OPTIONAL,
    });

    closeFiles({ scope: "server", id: props.server.id });

    toast({
      title: t("pages.dedicated_servers.detail.move.started", {
        server: props.serverLabel,
        node: node.label || node.id,
      }),
    });

    emit("update:open", false);
  } catch (error) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: errorMessage(error),
    });
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <ArrowRightLeft class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          {{ $t("pages.dedicated_servers.detail.move.title") }}
        </DialogTitle>
        <DialogDescription>
          {{
            $t("pages.dedicated_servers.detail.move.description", {
              node: sourceLabel,
            })
          }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="server && !sourceReachable"
        class="flex flex-col gap-3 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2.5"
      >
        <div class="flex items-start gap-2.5">
          <TriangleAlert
            class="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
            aria-hidden="true"
          />
          <p class="text-xs leading-relaxed text-[hsl(var(--tac-amber))]">
            {{
              $t("pages.dedicated_servers.detail.move.source_offline", {
                node: sourceLabel,
              })
            }}
          </p>
        </div>
        <label class="flex cursor-pointer items-center gap-2 pl-6 text-sm">
          <Checkbox
            :model-value="withoutFiles"
            @update:model-value="(value: boolean) => (withoutFiles = value)"
          />
          {{ $t("pages.dedicated_servers.detail.move.without_files") }}
        </label>
      </div>

      <div class="flex flex-col gap-2">
        <span
          class="flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          <Server class="h-3.5 w-3.5" />
          {{ $t("pages.dedicated_servers.detail.move.target") }}
        </span>
        <div
          role="radiogroup"
          :aria-label="$t('pages.dedicated_servers.detail.move.target')"
          class="max-h-72 divide-y divide-border/40 overflow-y-auto rounded-md border border-border/50"
        >
          <button
            v-for="option of options"
            :key="option.node.id"
            type="button"
            role="radio"
            :aria-checked="selected?.id === option.node.id"
            :disabled="!option.eligible"
            class="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent motion-reduce:transition-none"
            :class="
              selected?.id === option.node.id &&
              'bg-[hsl(var(--tac-amber)/0.1)] hover:bg-[hsl(var(--tac-amber)/0.14)]'
            "
            @click="target = option.node.id"
          >
            <Check
              class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]"
              :class="{ invisible: selected?.id !== option.node.id }"
            />
            <span class="flex min-w-0 flex-col">
              <span class="truncate text-sm">{{ option.label }}</span>
              <span
                class="truncate font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {{ option.detail }}
              </span>
            </span>
          </button>
          <p
            v-if="options.length === 0"
            class="px-3 py-4 text-center text-sm text-muted-foreground"
          >
            {{
              loaded && server
                ? $t("pages.dedicated_servers.detail.move.no_nodes")
                : $t("common.loading")
            }}
          </p>
        </div>
      </div>

      <div
        v-if="warnings.length"
        class="flex items-start gap-2.5 rounded-md border border-border bg-foreground/5 px-3 py-2.5"
      >
        <Info
          class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <ul class="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
          <li v-for="warning of warnings" :key="warning">
            {{ warning }}
          </li>
        </ul>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="ghost" @click="emit('update:open', false)">
          {{ $t("common.cancel") }}
        </Button>
        <Button variant="tactical" :disabled="!canMove" @click="move">
          <ArrowRightLeft class="mr-1 h-4 w-4" />
          {{ $t("pages.dedicated_servers.detail.move.confirm") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
