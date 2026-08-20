<template>
  <Tabs v-model="activeTab" class="w-full">
    <div
      class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="flex items-center gap-2">
        <TabsList class="grid w-full grid-cols-5 lg:inline-flex lg:w-auto">
          <template v-for="config in gameTypeConfigs" :key="config.type">
            <!-- The three match types, then a rule, then the two layers that sit
               on top of whichever one a match got. -->
            <span
              v-if="config.type === 'Lan'"
              aria-hidden="true"
              class="mx-1 hidden h-4 w-px self-center bg-border lg:block"
            />
            <TabsTrigger :value="config.type">
              {{ formatTypeName(config.type) }}
            </TabsTrigger>
          </template>
        </TabsList>

        <FiveStackToolTip
          :size="16"
          side="bottom"
          align="end"
          class="mr-1 text-muted-foreground hover:text-foreground"
        >
          <div class="max-w-xs space-y-2">
            <div>
              <p class="text-sm font-medium">
                {{ $t("pages.settings.application.game_type_configs.order") }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{
                  $t("pages.settings.application.game_type_configs.order_hint")
                }}
              </p>
            </div>

            <ol class="space-y-1">
              <li
                v-for="(layer, index) in execOrder"
                :key="layer.key"
                class="flex items-baseline gap-2 text-xs"
                :class="
                  layer.key === activeLayerKey
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
              >
                <span class="w-3 shrink-0 tabular-nums opacity-60">
                  {{ index + 1 }}
                </span>
                <span class="font-medium">{{ layer.label }}</span>
                <span class="ml-auto pl-3 text-right opacity-70">
                  {{ layer.note }}
                </span>
              </li>
            </ol>
          </div>
        </FiveStackToolTip>
      </div>

      <div v-if="activeConfig" class="flex items-center justify-end gap-2">
        <AlertDialog>
          <FiveStackToolTip as-child side="bottom" align="end">
            <template #trigger>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  class="text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                  :aria-label="resetLabel"
                >
                  <RotateCcw class="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
            </template>
            {{ resetLabel }}
          </FiveStackToolTip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{{
                $t("game_type_configs.form.revert_confirm.title")
              }}</AlertDialogTitle>
              <AlertDialogDescription>
                {{
                  isLayer
                    ? $t("game_type_configs.form.clear_confirm.description")
                    : $t("game_type_configs.form.revert_confirm.description")
                }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
              <AlertDialogAction
                @click="revertToDefaults(activeConfig)"
                variant="destructive"
              >
                {{ $t("game_type_configs.form.revert_confirm.confirm") }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>

    <SettingsSaveBar
      :dirty="isActiveDirty"
      @save="submitForm(activeConfig)"
      @discard="discardActive"
    />

    <TabsContent
      v-for="config in gameTypeConfigs"
      :key="config.type"
      :value="config.type"
      class="w-full"
    >
      <div
        class="relative w-full overflow-hidden rounded-lg border border-border/60"
        style="height: 500px"
      >
        <div
          :ref="setEditorRef"
          :data-type="config.type"
          class="h-full w-full"
        />

        <!-- Monaco has no placeholder, and Global ships empty, so without this
             the tab is an unexplained void. -->
        <p
          v-if="emptyTypes.has(config.type) && config.type === 'Global'"
          class="pointer-events-none absolute left-[4.5rem] top-2.5 select-none text-sm text-muted-foreground/60"
        >
          {{ $t("pages.settings.application.game_type_configs.placeholder") }}
        </p>
      </div>
    </TabsContent>
  </Tabs>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { e_game_cfg_types_enum } from "~/generated/zeus";
import type * as Monaco from "monaco-editor";
import { computed, markRaw } from "vue";
import { loadMonaco } from "~/utilities/loadMonaco";
import { RotateCcw } from "lucide-vue-next";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";

interface GameTypeConfig {
  type: string;
  cfg: string;
}

// Non-reactive map outside component instance
let monaco: typeof Monaco | null = null;
const editorsMap = new Map<string, Monaco.editor.IStandaloneCodeEditor>();
const pendingEditorCreates = new Set<string>();
// Last-saved cfg per type, used to detect unsaved editor changes (dirty state).
const baselineMap = new Map<string, string>();

export default {
  components: {
    RotateCcw,
    SettingsSaveBar,
    FiveStackToolTip,
  },
  props: {
    gameTypeConfigs: {
      type: Array as () => GameTypeConfig[],
      required: true,
    },
  },
  emits: ["updated"],
  setup(props) {
    const orderedTabs = computed(() => {
      const availableTabs = props.gameTypeConfigs
        .map((config) => config.type)
        .filter((type): type is string => Boolean(type));
      // The match types first, most-used first, then the two layers that are
      // exec'd on top of whichever one a match got.
      const preferredOrder = [
        e_game_cfg_types_enum.Competitive,
        e_game_cfg_types_enum.Wingman,
        e_game_cfg_types_enum.Duel,
        e_game_cfg_types_enum.Lan,
        e_game_cfg_types_enum.Global,
      ];

      const preferredTabs = preferredOrder.filter((type) =>
        availableTabs.includes(type),
      );
      const remainingTabs = availableTabs.filter(
        (type) => !preferredTabs.includes(type),
      );

      return [...preferredTabs, ...remainingTabs];
    });

    const defaultTab = computed(() => {
      if (orderedTabs.value.includes(e_game_cfg_types_enum.Competitive)) {
        return e_game_cfg_types_enum.Competitive;
      }

      return orderedTabs.value[0] ?? "";
    });

    const activeTab = useRouteTab({
      defaultTab,
      tabs: orderedTabs,
      ready: computed(() => props.gameTypeConfigs.length > 0),
    });

    return { activeTab };
  },
  data() {
    return {
      pendingContainers: new Map<string, HTMLElement>(),
      dirtyTypes: new Set<string>(),
      emptyTypes: new Set<string>(),
    };
  },
  watch: {
    gameTypeConfigs: {
      immediate: true,
      handler(newConfigs: GameTypeConfig[]) {
        // Clear editors for configs that no longer exist
        editorsMap.forEach((editor, type) => {
          if (!newConfigs.find((c) => c.type === type)) {
            editor.dispose();
            editorsMap.delete(type);
          }
        });
      },
    },
    activeTab(newTab: string) {
      this.$nextTick(() => {
        // Create editor for the newly active tab if container is ready
        const container = this.pendingContainers.get(newTab);
        if (container && !editorsMap.has(newTab)) {
          void this.createEditor(container, newTab);
        }
        // Layout existing editor
        const editor = editorsMap.get(newTab);
        if (editor) {
          editor.layout();
        }
      });
    },
  },
  computed: {
    activeConfig(): GameTypeConfig | null {
      return (
        this.gameTypeConfigs.find((c) => c.type === this.activeTab) ?? null
      );
    },
    isActiveDirty(): boolean {
      return !!this.activeTab && this.dirtyTypes.has(this.activeTab);
    },
    // Global is the operator's own layer, not a match type, so there is no
    // shipped file to revert to -- the action empties it instead.
    isLayer(): boolean {
      return this.activeTab === e_game_cfg_types_enum.Global;
    },
    // Which row of the stack the open tab is, so the order reads as "you are
    // here" rather than a static list.
    activeLayerKey(): string {
      if (this.activeTab === e_game_cfg_types_enum.Global) {
        return "global";
      }

      if (this.activeTab === e_game_cfg_types_enum.Lan) {
        return "lan";
      }

      return "type";
    },
    resetLabel(): string {
      return this.isLayer
        ? this.$t("game_type_configs.form.clear_tooltip")
        : this.$t("game_type_configs.form.reset_tooltip");
    },
    execOrder(): Array<{ key: string; label: string; note: string }> {
      return [
        {
          key: "type",
          label: this.$t(
            "pages.settings.application.game_type_configs.layers.type",
          ),
          note: this.$t(
            "pages.settings.application.game_type_configs.layers.type_note",
          ),
        },
        {
          key: "lan",
          label: "LAN",
          note: this.$t(
            "pages.settings.application.game_type_configs.layers.lan_note",
          ),
        },
        {
          key: "global",
          label: this.$t("pages.settings.application.game_type_configs.global"),
          note: this.$t(
            "pages.settings.application.game_type_configs.layers.global_note",
          ),
        },
        {
          key: "plugin",
          label: this.$t(
            "pages.settings.application.game_type_configs.layers.plugin",
          ),
          note: this.$t(
            "pages.settings.application.game_type_configs.layers.plugin_note",
          ),
        },
        {
          key: "mode",
          label: this.$t(
            "pages.settings.application.game_type_configs.layers.mode",
          ),
          note: this.$t(
            "pages.settings.application.game_type_configs.layers.mode_note",
          ),
        },
      ];
    },
  },
  beforeUnmount() {
    editorsMap.forEach((editor) => {
      editor.dispose();
    });
    editorsMap.clear();
    this.pendingContainers.clear();
  },
  methods: {
    formatTypeName(type: string): string {
      const names: Record<string, string> = {
        [e_game_cfg_types_enum.Global]: this.$t(
          "pages.settings.application.game_type_configs.global",
        ),
        [e_game_cfg_types_enum.Lan]: "LAN",
        [e_game_cfg_types_enum.Competitive]: this.$t(
          "pages.leaderboard.match_types.competitive",
        ),
        [e_game_cfg_types_enum.Wingman]: this.$t(
          "pages.leaderboard.match_types.wingman",
        ),
        [e_game_cfg_types_enum.Duel]: this.$t(
          "pages.leaderboard.match_types.duel",
        ),
      };
      return names[type] || type;
    },
    setEditorRef(el: HTMLElement | null) {
      if (!el) return;

      const type = el.getAttribute("data-type");
      if (!type) return;

      // Function refs re-fire on every re-render (e.g. when the unsaved-changes
      // bar appears as the editor becomes dirty). If we already have an editor
      // mounted on this exact element, do nothing — recreating it would blow
      // away the live editor and steal focus mid-keystroke.
      if (editorsMap.has(type) && this.pendingContainers.get(type) === el) {
        return;
      }

      // Store the container reference
      this.pendingContainers.set(type, el);

      // Dispose any editor bound to a stale container before recreating.
      if (editorsMap.has(type)) {
        const oldEditor = editorsMap.get(type)!;
        oldEditor.dispose();
        editorsMap.delete(type);
      }

      // Create editor since this is a fresh container
      if (this.activeTab === type) {
        this.createEditor(el, type);
      }
    },
    async createEditor(el: HTMLElement, type: string) {
      if (pendingEditorCreates.has(type) || editorsMap.has(type)) {
        return;
      }

      const config = this.gameTypeConfigs.find((c) => c.type === type);
      if (!config) return;

      pendingEditorCreates.add(type);

      monaco ??= await loadMonaco();

      try {
        const editor = monaco.editor.create(el, {
          value: config.cfg,
          language: "plaintext",
          theme: "vs-dark",
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          tabSize: 2,
          wordWrap: "on",
        });

        editorsMap.set(type, editor);
        baselineMap.set(type, config.cfg);
        this.trackEmpty(type, config.cfg);
        editor.onDidChangeModelContent(() => {
          const value = editor.getValue();

          if (value !== baselineMap.get(type)) {
            this.dirtyTypes.add(type);
          } else {
            this.dirtyTypes.delete(type);
          }

          this.trackEmpty(type, value);
        });
      } finally {
        pendingEditorCreates.delete(type);
      }
    },
    trackEmpty(type: string, value: string) {
      if (value.trim()) {
        this.emptyTypes.delete(type);
        return;
      }

      this.emptyTypes.add(type);
    },
    getEditorValue(type: string): string {
      return editorsMap.get(type)?.getValue() || "";
    },
    discardActive() {
      if (!this.activeTab) {
        return;
      }
      const editor = editorsMap.get(this.activeTab);
      const baseline = baselineMap.get(this.activeTab);
      if (editor && baseline !== undefined) {
        editor.setValue(baseline);
      }
      this.dirtyTypes.delete(this.activeTab);
    },
    async submitForm(config: GameTypeConfig) {
      const cfgValue = this.getEditorValue(config.type);

      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_match_type_cfgs: [
              {
                objects: [
                  {
                    type: config.type,
                    cfg: cfgValue,
                  },
                ],
                on_conflict: {
                  constraint: "match_type_cfgs_pkey",
                  update_columns: ["cfg"],
                },
              },
              {
                affected_rows: true,
              },
            ],
          }),
        });

        baselineMap.set(config.type, cfgValue);
        this.dirtyTypes.delete(config.type);

        toast({
          title: this.$t("game_type_configs.form.success.update"),
        });

        this.$emit("updated");
      } catch (error) {
        toast({
          title: this.$t("game_type_configs.form.error.update"),
          variant: "destructive",
        });
      }
    },
    async revertToDefaults(config: GameTypeConfig) {
      try {
        const defaultConfig = await this.getDefaultConfig(config.type);
        const editor = editorsMap.get(config.type);

        if (editor) {
          editor.setValue(defaultConfig);
        }

        await this.submitForm(config);

        toast({
          title: this.$t("game_type_configs.form.success.revert"),
        });

        this.$emit("updated");
      } catch (error) {
        toast({
          title: this.$t("game_type_configs.form.error.revert"),
          variant: "destructive",
        });
      }
    },
    async getDefaultConfig(type: string): Promise<string> {
      // Global has no shipped default, so reverting it clears it.
      if (type === e_game_cfg_types_enum.Global) {
        return "";
      }

      return (
        (await $fetch<string>(`/api/get-default-config?type=${type}`)) ?? ""
      );
    },
  },
};
</script>
