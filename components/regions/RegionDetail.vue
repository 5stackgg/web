<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { ArrowLeft, Cable, Pencil, Route, Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import ManageSection from "~/components/common/ManageSection.vue";
import StatusDot from "~/components/admin/StatusDot.vue";
import { TONE_TEXT } from "~/components/admin/tone";
import {
  nodeState,
  nodeStateKey,
  nodeStateTone,
  regionLabel,
} from "~/components/regions/regionStatus";

type RegionNode = {
  id: string;
  label?: string | null;
  status?: string | null;
  offline_at?: string | null;
  enabled?: boolean | null;
  available_server_count?: number | null;
  total_server_count?: number | null;
};

const props = defineProps<{
  region: {
    value: string;
    description?: string | null;
    status?: string | null;
    steam_relay: boolean;
    is_lan: boolean;
    available_server_count?: number | null;
    total_server_count?: number | null;
    game_server_nodes?: RegionNode[];
  };
  // Phones show the detail on its own, pushed over the list.
  pushed?: boolean;
}>();

const emit = defineEmits<{
  (e: "back"): void;
  (e: "rename", label: string): void;
  (e: "set-flag", key: "steam_relay" | "is_lan", value: boolean): void;
  (e: "delete"): void;
}>();

const label = computed(() => regionLabel(props.region));
const nodes = computed(() => props.region.game_server_nodes ?? []);

const editing = ref(false);
const draft = ref("");
const input = ref<InstanceType<typeof Input> | null>(null);

async function startRename() {
  draft.value = props.region.description ?? "";
  editing.value = true;
  await nextTick();
  const el = (input.value as any)?.$el as HTMLInputElement | undefined;
  el?.focus();
  el?.select();
}

// Enter commits and the blur that follows must not commit a second time.
function finishRename(save: boolean) {
  if (!editing.value) {
    return;
  }
  editing.value = false;
  const next = draft.value.trim();
  if (save && next !== (props.region.description ?? "").trim()) {
    emit("rename", next);
  }
}
</script>

<template>
  <section
    class="grid w-full min-w-0 max-w-[720px] content-start gap-7"
    aria-live="polite"
  >
    <!-- The list beside it already names the region and its status; only
         the phone, where the list is pushed away, needs them here. -->
    <div v-if="pushed" class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        class="-ml-1.5 shrink-0"
        :aria-label="$t('common.back')"
        @click="$emit('back')"
      >
        <ArrowLeft />
      </Button>
      <h2 class="m-0 min-w-0 truncate text-base font-semibold">{{ label }}</h2>
    </div>

    <div class="grid gap-8">
      <div class="grid gap-3 sm:grid-cols-2">
        <label
          class="region-option"
          :data-on="region.steam_relay && !region.is_lan"
          :data-disabled="region.is_lan"
        >
          <span class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-2 text-sm font-medium">
              <Route class="region-option-icon size-4" />
              {{ $t("pages.regions.detail.relay_title") }}
            </span>
            <Switch
              :model-value="region.steam_relay"
              :disabled="region.is_lan"
              :aria-label="$t('pages.regions.detail.relay_title')"
              @update:model-value="
                (value: boolean) => $emit('set-flag', 'steam_relay', value)
              "
            />
          </span>
          <span class="text-[0.8rem] leading-snug text-muted-foreground">
            {{
              region.is_lan
                ? $t("pages.regions.detail.relay_lan_description")
                : $t("pages.regions.detail.relay_description")
            }}
          </span>
        </label>
        <label class="region-option" :data-on="region.is_lan">
          <span class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-2 text-sm font-medium">
              <Cable class="region-option-icon size-4" />
              {{ $t("pages.regions.detail.lan_title") }}
            </span>
            <Switch
              :model-value="region.is_lan"
              :aria-label="$t('pages.regions.detail.lan_title')"
              @update:model-value="
                (value: boolean) => $emit('set-flag', 'is_lan', value)
              "
            />
          </span>
          <span class="text-[0.8rem] leading-snug text-muted-foreground">
            {{ $t("pages.regions.detail.lan_description") }}
          </span>
        </label>
      </div>

      <ManageSection :label="$t('pages.regions.detail.nodes_label')">
        <template v-if="region.total_server_count" #action>
          <span class="text-xs tabular-nums text-muted-foreground">{{
            $t("pages.regions.detail.servers_free", {
              free: region.available_server_count ?? 0,
              total: region.total_server_count,
            })
          }}</span>
        </template>

        <div
          v-if="nodes.length"
          class="overflow-x-auto rounded-md border border-border"
        >
          <table class="w-full text-sm tabular-nums">
            <thead>
              <tr
                class="border-b border-border text-left text-xs text-muted-foreground"
              >
                <th class="h-9 px-3 font-medium">
                  {{ $t("pages.regions.detail.col_node") }}
                </th>
                <th class="h-9 px-3 font-medium">
                  {{ $t("common.status") }}
                </th>
                <th class="h-9 px-3 text-right font-medium">
                  {{ $t("pages.regions.detail.col_free") }}
                </th>
                <th class="h-9 px-3 text-right font-medium">
                  {{ $t("pages.regions.detail.col_servers") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="node in nodes"
                :key="node.id"
                class="border-b border-border/60 last:border-b-0"
              >
                <td class="max-w-[280px] px-3 py-2.5">
                  <span
                    class="block truncate"
                    :class="{ 'font-mono text-xs': !node.label }"
                    :title="node.label || node.id"
                    >{{ node.label || node.id }}</span
                  >
                </td>
                <td class="whitespace-nowrap px-3 py-2.5">
                  <span
                    class="inline-flex items-center gap-1.5"
                    :class="
                      ['bad', 'off'].includes(nodeStateTone[nodeState(node)]) &&
                      TONE_TEXT[nodeStateTone[nodeState(node)]]
                    "
                  >
                    <StatusDot :tone="nodeStateTone[nodeState(node)]" />
                    {{ $t(nodeStateKey[nodeState(node)]) }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-right">
                  {{
                    nodeState(node) === "online"
                      ? (node.available_server_count ?? 0)
                      : "—"
                  }}
                </td>
                <td class="px-3 py-2.5 text-right">
                  {{ node.total_server_count ?? 0 }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else>
          <div class="text-sm font-medium">
            {{ $t("pages.regions.detail.no_nodes_title") }}
          </div>
          <i18n-t
            keypath="pages.regions.detail.no_nodes_hint"
            tag="p"
            class="mt-0.5 text-xs text-muted-foreground"
          >
            <template #page>
              <NuxtLink
                to="/game-server-nodes"
                class="underline underline-offset-2 hover:text-foreground"
                >{{
                  $t("layouts.app_nav.administration.game_server_nodes")
                }}</NuxtLink
              >
            </template>
          </i18n-t>
        </div>
      </ManageSection>

      <div
        class="flex items-center justify-between gap-4 border-t border-border/60 pt-5"
      >
        <Input
          v-if="editing"
          ref="input"
          v-model="draft"
          autocomplete="off"
          class="h-8 w-[min(280px,100%)]"
          :placeholder="region.value"
          :aria-label="$t('pages.regions.detail.label_aria')"
          @keydown.enter.prevent="finishRename(true)"
          @keydown.esc.stop.prevent="finishRename(false)"
          @blur="finishRename(true)"
        />
        <p v-else class="min-w-0 text-xs text-muted-foreground">
          {{
            nodes.length
              ? $t(
                  "pages.regions.detail.delete_hint_nodes",
                  { count: nodes.length },
                  nodes.length,
                )
              : $t("pages.regions.detail.delete_hint_empty")
          }}
        </p>
        <div class="flex shrink-0 items-center gap-1">
          <Button
            v-if="!editing"
            type="button"
            variant="ghost"
            size="sm"
            class="h-8 text-muted-foreground hover:text-foreground"
            @click="startRename"
          >
            <Pencil class="size-3.5" />
            {{ $t("common.rename") }}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="h-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            :disabled="nodes.length > 0"
            @click="$emit('delete')"
          >
            <Trash2 class="size-3.5" />
            {{ $t("pages.regions.detail.delete_title") }}
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.region-option {
  display: grid;
  gap: 0.5rem;
  padding: 0.875rem;
  border-radius: 0.375rem;
  border: 1px solid hsl(var(--border));
  background: hsl(240 6% 5.5%);
  cursor: pointer;
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
}
.region-option:hover {
  border-color: hsl(var(--muted-foreground) / 0.35);
}
.region-option-icon {
  color: hsl(var(--muted-foreground));
  transition: color 150ms ease;
}
.region-option[data-on="true"] {
  border-color: hsl(var(--tac-amber) / 0.35);
  background: hsl(var(--tac-amber) / 0.05);
}
.region-option[data-on="true"] .region-option-icon {
  color: hsl(var(--tac-amber));
}
.region-option[data-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.6;
}
.region-option[data-disabled="true"]:hover {
  border-color: hsl(var(--border));
}
</style>
