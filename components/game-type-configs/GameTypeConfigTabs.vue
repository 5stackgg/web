<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-vue-next";
import * as monaco from "monaco-editor";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { e_game_cfg_types_enum } from "~/generated/zeus";
import { markRaw } from "vue";
</script>

<template>
  <Tabs v-model="activeTab" class="w-full">
    <TabsList class="grid w-full grid-cols-4 lg:inline-flex lg:w-auto mb-4">
      <TabsTrigger
        v-for="config in gameTypeConfigs"
        :key="config.type"
        :value="config.type"
      >
        {{ formatTypeName(config.type) }}
      </TabsTrigger>
    </TabsList>

    <TabsContent
      v-for="config in gameTypeConfigs"
      :key="config.type"
      :value="config.type"
      class="space-y-4"
    >
      <Card>
        <CardHeader class="flex flex-row items-center justify-between">
          <CardTitle>{{ formatTypeName(config.type) }} Configuration</CardTitle>
          <div class="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
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
                    {{
                      $t("game_type_configs.form.revert_confirm.description")
                    }}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{{
                    $t("game_type_configs.form.revert_confirm.cancel")
                  }}</AlertDialogCancel>
                  <AlertDialogAction
                    @click="revertToDefaults(config)"
                    variant="destructive"
                  >
                    {{ $t("game_type_configs.form.revert_confirm.confirm") }}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          <form @submit.prevent="submitForm(config)" class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-medium">{{
                $t("game_type_configs.form.cfg")
              }}</label>
              <div
                class="border rounded-md overflow-hidden"
                style="height: 500px"
              >
                <div
                  :ref="setEditorRef"
                  :data-type="config.type"
                  class="w-full h-full"
                />
              </div>
            </div>

            <div class="flex justify-end">
              <Button type="submit">
                {{ $t("game_type_configs.form.update") }}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { e_game_cfg_types_enum } from "~/generated/zeus";
import * as monaco from "monaco-editor";
import { markRaw } from "vue";

interface GameTypeConfig {
  type: string;
  cfg: string;
}

// Non-reactive map outside component instance
const editorsMap = new Map<string, monaco.editor.IStandaloneCodeEditor>();

export default {
  props: {
    gameTypeConfigs: {
      type: Array as () => GameTypeConfig[],
      required: true,
    },
  },
  emits: ["updated"],
  data() {
    return {
      activeTab: "" as string,
      colorMode: useColorMode(),
      pendingContainers: new Map<string, HTMLElement>(),
    };
  },
  watch: {
    gameTypeConfigs: {
      immediate: true,
      handler(newConfigs: GameTypeConfig[]) {
        if (newConfigs.length > 0 && !this.activeTab) {
          this.activeTab = newConfigs[0].type;
        }
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
      editorsMap.forEach((editor) => {
        monaco.editor.setTheme(newMode === "dark" ? "vs-dark" : "vs");
      });
    },
    activeTab(newTab: string) {
      this.$nextTick(() => {
        // Create editor for the newly active tab if container is ready
        const container = this.pendingContainers.get(newTab);
        if (container && !editorsMap.has(newTab)) {
          this.createEditor(container, newTab);
        }
        // Layout existing editor
        const editor = editorsMap.get(newTab);
        if (editor) {
          editor.layout();
        }
      });
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
    createEditor(el: HTMLElement, type: string) {
      const config = this.gameTypeConfigs.find((c) => c.type === type);
      if (!config) return;

      const theme = this.colorMode.value === "dark" ? "vs-dark" : "vs";

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
