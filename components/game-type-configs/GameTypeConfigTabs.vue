<template>
  <Tabs v-model="activeTab" class="w-full">
    <div
      class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <TabsList class="grid w-full grid-cols-4 lg:inline-flex lg:w-auto">
        <TabsTrigger
          v-for="config in gameTypeConfigs"
          :key="config.type"
          :value="config.type"
        >
          {{ formatTypeName(config.type) }}
        </TabsTrigger>
      </TabsList>

      <div v-if="activeConfig" class="flex items-center justify-end gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              class="text-muted-foreground hover:border-destructive/50 hover:text-destructive"
            >
              <Trash class="mr-2 h-4 w-4" />
              {{ $t("game_type_configs.form.revert_to_defaults") }}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{{
                $t("game_type_configs.form.revert_confirm.title")
              }}</AlertDialogTitle>
              <AlertDialogDescription>
                {{ $t("game_type_configs.form.revert_confirm.description") }}
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

        <Button
          type="button"
          :disabled="!isActiveDirty"
          @click="submitForm(activeConfig)"
        >
          <Save class="mr-2 h-4 w-4" />
          {{ $t("common.update") }}
        </Button>
      </div>
    </div>

    <TabsContent
      v-for="config in gameTypeConfigs"
      :key="config.type"
      :value="config.type"
      class="w-full"
    >
      <div
        class="w-full overflow-hidden rounded-lg border border-border/60"
        style="height: 500px"
      >
        <div
          :ref="setEditorRef"
          :data-type="config.type"
          class="w-full h-full"
        />
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
import { Trash, Save } from "lucide-vue-next";

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
    Trash,
    Save,
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
      const preferredOrder = [
        e_game_cfg_types_enum.Lan,
        e_game_cfg_types_enum.Competitive,
        e_game_cfg_types_enum.Wingman,
        e_game_cfg_types_enum.Duel,
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
      if (orderedTabs.value.includes(e_game_cfg_types_enum.Lan)) {
        return e_game_cfg_types_enum.Lan;
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
      colorMode: useColorMode(),
      pendingContainers: new Map<string, HTMLElement>(),
      dirtyTypes: new Set<string>(),
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
    "colorMode.value"(newMode: string) {
      if (!monaco) {
        return;
      }

      editorsMap.forEach((editor) => {
        monaco.editor.setTheme(newMode === "dark" ? "vs-dark" : "vs");
      });
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
        [e_game_cfg_types_enum.Lan]: "LAN",
        [e_game_cfg_types_enum.Competitive]: "Competitive",
        [e_game_cfg_types_enum.Wingman]: "Wingman",
        [e_game_cfg_types_enum.Duel]: "Duel",
      };
      return names[type] || type;
    },
    setEditorRef(el: HTMLElement | null) {
      if (!el) return;

      const type = el.getAttribute("data-type");
      if (!type) return;

      // Store the container reference
      this.pendingContainers.set(type, el);

      // Always dispose old editor and create new one when ref fires
      // because the container might be a newly mounted element
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

      const theme = this.colorMode.value === "dark" ? "vs-dark" : "vs";

      try {
        const editor = monaco.editor.create(el, {
          value: config.cfg,
          language: "plaintext",
          theme,
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          tabSize: 2,
          wordWrap: "on",
        });

        editorsMap.set(type, editor);
        baselineMap.set(type, config.cfg);
        editor.onDidChangeModelContent(() => {
          if (editor.getValue() !== baselineMap.get(type)) {
            this.dirtyTypes.add(type);
          } else {
            this.dirtyTypes.delete(type);
          }
        });
      } finally {
        pendingEditorCreates.delete(type);
      }
    },
    getEditorValue(type: string): string {
      return editorsMap.get(type)?.getValue() || "";
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
      return await $fetch<string>(`/api/get-default-config?type=${type}`);
    },
  },
};
</script>
