<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-4xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Edit File: {{ filePath }}</DialogTitle>
        <DialogDescription>
          Make changes to the file content
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 flex-1 overflow-hidden flex flex-col">
        <div v-if="isLoading" class="text-center py-8 text-muted-foreground">
          Loading file...
        </div>

        <div
          v-else-if="fileContent !== null"
          class="flex-1 min-h-[400px] border rounded-md overflow-hidden"
        >
          <div ref="editorContainer" class="w-full h-full" />
        </div>

        <Alert v-if="error" variant="destructive">
          <AlertTriangle class="w-4 h-4" />
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <Alert
          v-if="saveSuccess"
          variant="default"
          class="bg-green-50 border-green-200"
        >
          <Check class="w-4 h-4 text-green-600" />
          <AlertDescription class="text-green-800"
            >File saved successfully!</AlertDescription
          >
        </Alert>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleCancel" :disabled="isSaving">
          Cancel
        </Button>
        <Button @click="handleSave" :disabled="isSaving || !hasChanges">
          {{ isSaving ? "Saving..." : "Save" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  ref,
  watch,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Check } from "lucide-vue-next";
import * as monaco from "monaco-editor";

const props = defineProps<{
  open: boolean;
  filePath: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const store = useFileManagerStore();
const colorMode = useColorMode();

const editorContainer = ref<HTMLElement | null>(null);
const editorInstance = ref<monaco.editor.IStandaloneCodeEditor | null>(null);
const fileContent = ref<string | null>(null);
const originalContent = ref<string | null>(null);
const isLoading = ref(false);
const isSaving = ref(false);
const error = ref<string | null>(null);
const saveSuccess = ref(false);

const hasChanges = computed(() => {
  if (!editorInstance.value) return false;
  return editorInstance.value.getValue() !== originalContent.value;
});

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    json: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    py: "python",
    sh: "shell",
    bash: "shell",
    sql: "sql",
    php: "php",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    lua: "lua",
    cfg: "plaintext",
    vdf: "plaintext",
    txt: "plaintext",
    log: "plaintext",
    ini: "ini",
    conf: "plaintext",
    toml: "plaintext",
  };
  return languageMap[ext] || "plaintext";
}

function createEditor() {
  if (!editorContainer.value || !fileContent.value) return;

  const theme = colorMode.value === "dark" ? "vs-dark" : "vs";
  const language = getLanguageFromPath(props.filePath);

  editorInstance.value = monaco.editor.create(editorContainer.value, {
    value: fileContent.value,
    language,
    theme,
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: 14,
    tabSize: 2,
    wordWrap: "on",
  });
}

function destroyEditor() {
  if (editorInstance.value) {
    editorInstance.value.dispose();
    editorInstance.value = null;
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await loadFile();
      await nextTick();
      createEditor();
    } else {
      destroyEditor();
      resetState();
    }
  },
);

watch(
  () => colorMode.value,
  (newMode) => {
    if (editorInstance.value) {
      monaco.editor.setTheme(newMode === "dark" ? "vs-dark" : "vs");
    }
  },
);

async function loadFile() {
  isLoading.value = true;
  error.value = null;
  saveSuccess.value = false;

  try {
    const response = await store.readFile(props.filePath);
    if (response) {
      fileContent.value = response.content;
      originalContent.value = response.content;
    }
  } catch (err: any) {
    error.value = err.message || "Failed to load file";
  } finally {
    isLoading.value = false;
  }
}

async function handleSave() {
  if (!editorInstance.value) return;

  const content = editorInstance.value.getValue();

  isSaving.value = true;
  error.value = null;
  saveSuccess.value = false;

  try {
    const success = await store.saveFile(props.filePath, content);

    if (success) {
      originalContent.value = content;
      saveSuccess.value = true;

      setTimeout(() => {
        emit("update:open", false);
      }, 1500);
    } else {
      error.value = store.error || "Failed to save file";
    }
  } catch (err: any) {
    error.value = err.message || "Failed to save file";
  } finally {
    isSaving.value = false;
  }
}

function handleCancel() {
  if (hasChanges.value) {
    if (!confirm("You have unsaved changes. Are you sure you want to close?")) {
      return;
    }
  }
  emit("update:open", false);
}

function resetState() {
  fileContent.value = null;
  originalContent.value = null;
  error.value = null;
  saveSuccess.value = false;
}

onBeforeUnmount(() => {
  destroyEditor();
});
</script>
