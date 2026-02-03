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

interface GameTypeConfig {
  type: string;
  cfg: string;
}

const props = defineProps<{
  gameTypeConfigs: GameTypeConfig[];
}>();

const emit = defineEmits<{
  updated: [];
}>();

const colorMode = useColorMode();
const activeTab = ref<string>("");
const editorsMap = new Map<string, monaco.editor.IStandaloneCodeEditor>();

function formatTypeName(type: string): string {
  const names: Record<string, string> = {
    [e_game_cfg_types_enum.Lan]: "LAN",
    [e_game_cfg_types_enum.Competitive]: "Competitive",
    [e_game_cfg_types_enum.Wingman]: "Wingman",
    [e_game_cfg_types_enum.Duel]: "Duel",
  };
  return names[type] || type;
}

function initEditor(el: HTMLElement | null, type: string) {
  if (!el) return;

  const config = props.gameTypeConfigs.find((c) => c.type === type);
  if (!config) return;

  const theme = colorMode.value === "dark" ? "vs-dark" : "vs";

  // If an editor already exists for this type, dispose it first
  // because the old container was unmounted when switching tabs
  if (editorsMap.has(type)) {
    const oldEditor = editorsMap.get(type);
    oldEditor?.dispose();
    editorsMap.delete(type);
  }

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
}

function getEditorValue(type: string): string {
  return editorsMap.get(type)?.getValue() || "";
}

async function submitForm(config: GameTypeConfig) {
  const cfgValue = getEditorValue(config.type);

  try {
    await generateMutation({
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
    });

    toast({
      title: "game_type_configs.form.success.update",
    });

    emit("updated");
  } catch (error) {
    toast({
      title: "game_type_configs.form.error.update",
      variant: "destructive",
    });
  }
}

async function revertToDefaults(config: GameTypeConfig) {
  try {
    const defaultConfig = await $fetch<string>(
      `/api/get-default-config?type=${config.type}`,
    );
    const editor = editorsMap.get(config.type);

    if (editor) {
      editor.setValue(defaultConfig);
    }

    await submitForm(config);

    toast({
      title: "game_type_configs.form.success.revert",
    });

    emit("updated");
  } catch (error) {
    toast({
      title: "game_type_configs.form.error.revert",
      variant: "destructive",
    });
  }
}

watch(
  () => props.gameTypeConfigs,
  (newConfigs) => {
    if (newConfigs.length > 0 && !activeTab.value) {
      activeTab.value = newConfigs[0].type;
    }
    // Clear editors when configs change
    nextTick(() => {
      editorsMap.forEach((editor, type) => {
        if (!newConfigs.find((c) => c.type === type)) {
          editor.dispose();
          editorsMap.delete(type);
        }
      });
    });
  },
  { immediate: true },
);

watch(
  () => colorMode.value,
  (newMode) => {
    editorsMap.forEach((editor) => {
      monaco.editor.setTheme(newMode === "dark" ? "vs-dark" : "vs");
    });
  },
);

watch(activeTab, (newTab) => {
  nextTick(() => {
    const editor = editorsMap.get(newTab);
    if (editor) {
      editor.layout();
    }
  });
});

onBeforeUnmount(() => {
  editorsMap.forEach((editor) => {
    editor.dispose();
  });
  editorsMap.clear();
});
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
                  :ref="(el) => initEditor(el as HTMLElement, config.type)"
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
