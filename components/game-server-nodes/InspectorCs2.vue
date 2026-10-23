<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
import InspectorLabel from "~/components/game-server-nodes/InspectorLabel.vue";
import GameStatus, {
  type GameStatusState,
} from "~/components/game-server-nodes/GameStatus.vue";
import {
  CircleAlert,
  Download,
  EllipsisVertical,
  Pin,
  ScrollText,
  Trash2,
} from "lucide-vue-next";
import {
  isGpuOnly,
  runsCs2,
  isReachable,
  takesMatches,
  type NodeLike,
} from "~/components/game-server-nodes/nodeState";
import {
  cs2State,
  type NextStep,
} from "~/components/game-server-nodes/nodeInspector";
import {
  INSPECTOR,
  versionShort,
} from "~/components/game-server-nodes/nodeCopy";
import { TONE_TEXT } from "~/components/admin/tone";
import { dateLocale } from "~/utilities/dateLocale";

// CS2: one status line (up to date, behind, updating, failed), then the build
// pin and the plugin pin. The ⋮ menu holds the update log, installing CS:GO,
// which gets its own section once it's on the node, and removing CS2.
const props = defineProps<{
  node: NodeLike & Record<string, any>;
  gameVersions: Array<Record<string, any>>;
  pluginVersions: Array<Record<string, any>>;
  pluginRuntime: string;
  supportsPinning: boolean;
  pinBuild: number | string | null;
  pinPlugin: string | null;
  currentBuildId: number | string | null;
  nextStep: NextStep | null;
  csgoShown: boolean;
}>();

const emit = defineEmits<{
  pinBuild: [buildId: number | null];
  pinPlugin: [version: string | null];
  updateCs: [];
  installCsgo: [];
  openLog: [];
  remove: [];
}>();

const { t } = useI18n();

const valClasses =
  "-ml-2 h-7 w-auto min-w-0 max-w-full gap-1.5 border-transparent bg-transparent px-2 py-0 text-[13px] shadow-none transition-colors hover:border-border hover:bg-muted/40 focus:ring-0 focus-visible:ring-1 data-[state=open]:border-border";

const inSetup = computed(() => props.node.status === "Setup");
const gpuOnly = computed(() => isGpuOnly(props.node));
const noCs2 = computed(() => !runsCs2(props.node));
const reachable = computed(() => isReachable(props.node));
const state = computed(() => cs2State(props.node, props.currentBuildId));
// matches pick a node without looking at its build, so the api refuses this
const takingMatches = computed(
  () => takesMatches(props.node) && props.node.accepting_new_matches !== false,
);

// The header already offers it; the section doesn't repeat the button.
const headerUpdates = computed(
  () =>
    props.nextStep === "install_cs2" ||
    props.nextStep === "update_cs2" ||
    props.nextStep === "retry_update",
);

const target = computed(
  () =>
    props.node.pin_build_id ||
    props.gameVersions.find((version) => version.current)?.build_id ||
    null,
);

const action = computed(() => {
  if (headerUpdates.value) {
    return null;
  }
  switch (state.value) {
    case "missing":
      return "install";
    case "failed":
      return "retry";
    case "behind":
      return "update";
    default:
      return null;
  }
});

// A failed pinned update deletes the install but keeps the pin, so a pinned
// node with no build still gets the version picker: it is the only place to
// change or remove the pin.
const showsVersion = computed(
  () => state.value !== "missing" || !!props.node.pin_build_id,
);

// A pin has to name a version in the runtime the node boots; an existing pin
// from the other framework stays listed so the select can show it.
const plugins = computed(() =>
  props.pluginVersions.filter(
    (version) =>
      version.runtime === props.pluginRuntime ||
      (version.runtime === props.node.pin_plugin_runtime &&
        version.version === props.node.pin_plugin_version),
  ),
);
const latestPlugin = computed(
  () =>
    props.pluginVersions.find(
      (version) => version.runtime === props.pluginRuntime,
    )?.version ?? "",
);

const when = (value: string) =>
  value ? new Date(value).toLocaleString(dateLocale()) : "";
</script>

<template>
  <section class="grid gap-2.5 p-4">
    <div class="flex min-h-7 items-center gap-2">
      <InspectorLabel>CS2</InspectorLabel>
      <span class="grow"></span>
      <DropdownMenu v-if="!inSetup && !noCs2">
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="h-7 w-7 shrink-0 text-muted-foreground"
            :aria-label="t(`${INSPECTOR}.cs2.actions`)"
          >
            <EllipsisVertical class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-60">
          <DropdownMenuItem @click="emit('openLog')">
            <ScrollText />
            {{ t(`${INSPECTOR}.cs2.update_log`) }}
          </DropdownMenuItem>
          <template v-if="!csgoShown && !gpuOnly">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="items-start"
              :disabled="!reachable"
              @click="emit('installCsgo')"
            >
              <Download class="mt-0.5" />
              <span class="flex flex-col">
                <span>{{ t("game_server.install_csgo") }}</span>
                <span class="text-xs text-muted-foreground">{{
                  t(`${INSPECTOR}.csgo.install_hint`)
                }}</span>
              </span>
            </DropdownMenuItem>
          </template>
          <template v-if="node.build_id || node.update_failed_at">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              class="items-start text-destructive focus:text-destructive"
              :disabled="!reachable || !!node.update_status || takingMatches"
              @click="emit('remove')"
            >
              <Trash2 class="mt-0.5" />
              <span class="flex flex-col">
                <span>{{
                  t(`${INSPECTOR}.remove_game.action`, { game: "CS2" })
                }}</span>
                <span
                  v-if="takingMatches"
                  class="text-xs text-muted-foreground"
                  >{{ t(`${INSPECTOR}.remove_game.stop_matches`) }}</span
                >
              </span>
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <p v-if="inSetup" class="text-xs text-muted-foreground">
      {{ t(`${INSPECTOR}.cs2.setup`) }}
    </p>
    <p v-else-if="noCs2" class="text-xs text-muted-foreground">
      {{ t(`${INSPECTOR}.cs2.gpu_only`) }}
    </p>

    <template v-else>
      <GameStatus
        :state="state as GameStatusState"
        :build="node.build_id"
        :target="target"
        :update-status="node.update_status"
        :failed-at="node.update_failed_at"
        :error="node.update_error"
        :action="action"
        :install-label="t('game_server.install_cs')"
        :disabled="!reachable"
        @action="emit('updateCs')"
        @open-log="emit('openLog')"
      />

      <div class="gsn-kv">
        <template v-if="showsVersion">
          <span class="gsn-k">{{ t(`${INSPECTOR}.cs2.version`) }}</span>
          <div class="gsn-v">
            <Select
              :model-value="(pinBuild ?? null) as any"
              :disabled="!supportsPinning"
              @update:model-value="
                (value) =>
                  emit('pinBuild', value ? parseInt(String(value)) : null)
              "
            >
              <SelectTrigger
                :class="valClasses"
                :aria-label="t('pages.game_server_nodes.table.cs2_build')"
              >
                <span class="flex min-w-0 items-center gap-1.5">
                  <span class="truncate">{{
                    versionShort(
                      gameVersions as any,
                      node.build_id || node.pin_build_id,
                    )
                  }}</span>
                  <Pin v-if="pinBuild" class="h-3 w-3 shrink-0 text-info" />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem :value="null as any">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-sm font-medium">{{
                        t("game_server.unpin_build_id")
                      }}</span>
                      <span class="text-xs text-muted-foreground">{{
                        t("game_server.use_latest_version")
                      }}</span>
                    </div>
                  </SelectItem>
                  <SelectItem
                    v-for="version of gameVersions"
                    :key="version.build_id"
                    :value="version.build_id"
                  >
                    <div class="flex flex-col gap-0.5">
                      <span class="flex items-center gap-1">
                        <span class="font-medium">{{ version.version }}</span>
                        <span class="font-mono text-xs text-muted-foreground"
                          >({{ version.build_id }})</span
                        >
                        <Pin
                          v-if="String(pinBuild) === String(version.build_id)"
                          class="ml-1 h-3 w-3 text-info"
                        />
                      </span>
                      <span class="text-xs text-muted-foreground">
                        {{ when(version.updated_at) }}
                        <span v-if="version.current" class="ml-1 text-success"
                          >({{ t("game_server.current") }})</span
                        >
                      </span>
                    </div>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <a
              v-if="!supportsPinning"
              href="https://docs.5stack.gg/servers/game-server-nodes/version-pinning"
              target="_blank"
              rel="noopener"
              class="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
              :title="t('game_server.version_pinning_not_supported')"
              >{{ t(`${INSPECTOR}.cs2.pinning_unsupported`) }}</a
            >
          </div>
        </template>

        <span class="gsn-k">{{
          t("pages.game_server_nodes.table.plugin")
        }}</span>
        <div class="gsn-v">
          <Select
            :model-value="(pinPlugin ?? null) as any"
            :disabled="!node.build_id"
            @update:model-value="
              (value) => emit('pinPlugin', (value as any) ?? null)
            "
          >
            <SelectTrigger
              :class="valClasses"
              :aria-label="t('common.plugin_version')"
            >
              <span class="flex min-w-0 items-center gap-1.5">
                <template v-if="pinPlugin">
                  <Pin class="h-3 w-3 text-info" />
                  <span class="truncate tabular-nums">{{ pinPlugin }}</span>
                </template>
                <template v-else>
                  <span>{{ t("game_server.auto") }}</span>
                  <span
                    v-if="latestPlugin"
                    class="font-mono text-xs text-muted-foreground/70"
                    >{{ latestPlugin }}</span
                  >
                </template>
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem :value="null as any">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-sm font-medium">{{
                      t("game_server.unpin_plugin_version")
                    }}</span>
                    <span class="text-xs text-muted-foreground">{{
                      t("game_server.use_latest_plugin")
                    }}</span>
                  </div>
                </SelectItem>
                <SelectItem
                  v-for="version of plugins"
                  :key="`${version.runtime}:${version.version}`"
                  :value="version.version"
                >
                  <div class="flex flex-col gap-0.5">
                    <span class="flex items-center gap-1">
                      <span class="font-medium">{{ version.version }}</span>
                      <Pin
                        v-if="pinPlugin === version.version"
                        class="ml-1 h-3 w-3 text-info"
                      />
                    </span>
                    <span class="text-xs text-muted-foreground">
                      <span
                        v-if="version.min_game_build_id"
                        :class="
                          Number(node.build_id || 0) >=
                          Number(version.min_game_build_id)
                            ? 'text-success'
                            : TONE_TEXT.warn
                        "
                      >
                        {{ t("game_server.plugin_version_supports") }}
                        {{ version.min_game_build_id }}+ ·
                      </span>
                      {{ t("game_server.plugin_version_published") }}
                      {{ when(version.published_at) }}
                    </span>
                  </div>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <p
          v-if="node.build_id && node.plugin_supported === false"
          class="gsn-note"
        >
          <span class="gsn-flag" :class="TONE_TEXT.bad"
            ><CircleAlert class="h-3 w-3" />{{
              t(`${INSPECTOR}.cs2.plugin_unsupported`)
            }}</span
          >
          <i18n-t :keypath="`${INSPECTOR}.cs2.on_build`" scope="global">
            <template #build>
              <span class="font-mono text-[11.5px] text-foreground">{{
                node.build_id
              }}</span>
            </template>
          </i18n-t>
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.gsn-kv {
  display: grid;
  grid-template-columns: minmax(92px, 32%) minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  row-gap: 2px;
  padding-top: 6px;
  border-top: 1px solid hsl(var(--border) / 0.4);
  font-size: 13px;
}
.gsn-k {
  color: hsl(var(--muted-foreground));
}
.gsn-v {
  display: flex;
  min-width: 0;
  min-height: 30px;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 8px;
}
.gsn-note {
  grid-column: 2;
  min-width: 0;
  padding-bottom: 2px;
  font-size: 12px;
  line-height: 1.45;
  color: hsl(var(--muted-foreground));
}
.gsn-flag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 4px;
  font-weight: 600;
  vertical-align: -1px;
}
</style>
