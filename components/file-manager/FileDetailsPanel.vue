<template>
  <div class="relative flex-1 flex flex-col" @contextmenu.prevent>
    <!-- Menubar (VS Code style) - only show when file is open -->
    <Menubar
      v-if="store.activeFilePath"
      class="rounded-none border-b border-t-0 border-x-0"
    >
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem
            @click="handleSave"
            :disabled="!store.activeFile?.isDirty"
          >
            <Save class="mr-2 h-4 w-4" />
            Save
            <MenubarShortcut>⌘S</MenubarShortcut>
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem @click="handleCloseActiveTab">
            <X class="mr-2 h-4 w-4" />
            Close
            <MenubarShortcut>⌘W</MenubarShortcut>
          </MenubarItem>
          <MenubarItem @click="handleCloseAllTabs">
            <X class="mr-2 h-4 w-4" />
            Close All
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem @click="handleUndo">
            <Undo class="mr-2 h-4 w-4" />
            Undo
            <MenubarShortcut>⌘Z</MenubarShortcut>
          </MenubarItem>
          <MenubarItem @click="handleRedo">
            <Redo class="mr-2 h-4 w-4" />
            Redo
            <MenubarShortcut>⇧⌘Z</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarItem @click="toggleWordWrap">
            <WrapText class="mr-2 h-4 w-4" />
            {{ wordWrap ? "Disable" : "Enable" }} Word Wrap
          </MenubarItem>
          <MenubarItem @click="toggleMinimap">
            <LayoutList class="mr-2 h-4 w-4" />
            {{ showMinimap ? "Hide" : "Show" }} Minimap
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>

    <!-- Tabs for open files -->
    <div
      v-if="openFileTabs.length > 0"
      class="flex border-b bg-muted/30 overflow-x-auto"
    >
      <div
        v-for="tab in openFileTabs"
        :key="tab.path"
        :class="
          store.activeFilePath === tab.path
            ? 'bg-background border-b-2 border-b-primary'
            : 'hover:bg-muted'
        "
        @click="store.setActiveFile(tab.path)"
        @contextmenu.prevent="showTabContextMenu($event, tab.path)"
      >
        <ContextMenu>
          <ContextMenuTrigger
            class="flex items-center gap-1 px-3 py-2 border-r cursor-pointer text-sm whitespace-nowrap group"
            :class="
              store.activeFilePath === tab.path
                ? 'bg-background border-b-2 border-b-primary'
                : 'hover:bg-muted'
            "
            @click="store.setActiveFile(tab.path)"
          >
            <FileIcon class="w-3 h-3" />
            <span>{{ tab.name }}</span>
            <span v-if="tab.isDirty" class="text-primary">●</span>
            <button
              @click.stop="handleCloseTab(tab.path, tab.isDirty)"
              class="ml-1 p-0.5 hover:bg-accent rounded opacity-0 group-hover:opacity-100"
            >
              <X class="w-3 h-3" />
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent class="w-48">
            <ContextMenuItem @click="handleCloseTab(contextMenuTabPath, false)">
              <X class="mr-2 h-4 w-4" />
              Close
              <ContextMenuShortcut>⌘W</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem @click="handleCloseOthers(contextMenuTabPath)">
              <X class="mr-2 h-4 w-4" />
              Close Others
            </ContextMenuItem>
            <ContextMenuItem @click="handleCloseToRight(contextMenuTabPath)">
              <X class="mr-2 h-4 w-4" />
              Close to Right
            </ContextMenuItem>
            <ContextMenuItem @click="handleCloseToLeft(contextMenuTabPath)">
              <X class="mr-2 h-4 w-4" />
              Close to Left
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </div>

    <!-- File path header (like Cursor IDE) -->
    <div
      v-if="store.activeFilePath"
      class="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/20 border-b"
    >
      <FolderOpen class="w-3 h-3" />
      <span class="truncate">{{ store.activeFilePath }}</span>
    </div>

    <!-- Editor View (when file is open) -->
    <div
      v-if="store.activeFilePath"
      class="flex-1 flex flex-col overflow-hidden"
    >
      <div ref="editorContainer" class="flex-1" />
    </div>

    <!-- Empty state (when no file is open) -->
    <div
      v-else
      class="flex-1 flex items-center justify-center text-muted-foreground"
    >
      <div class="text-center">
        <FileCode class="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p class="text-lg font-medium">No file open</p>
        <p class="text-sm">Select a file from the browser to edit</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Save,
  Undo,
  Redo,
  WrapText,
  LayoutList,
  X,
  File as FileIcon,
  FileCode,
  FolderOpen,
} from "lucide-vue-next";
import * as monaco from "monaco-editor";

const store = useFileManagerStore();
const colorMode = useColorMode();

// Editor state
const editorContainer = ref<HTMLElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;
const wordWrap = ref(true);
const showMinimap = ref(false);

// Non-reactive state to avoid reactivity issues in Monaco callbacks
let currentEditingPath: string | null = null;
let isSettingContent = false;
let updateTimeout: ReturnType<typeof setTimeout> | null = null;

// Context menu state
const contextMenuTabPath = ref<string | null>(null);
const contextMenuX = ref(0);
const contextMenuY = ref(0);

// Computed
const openFileTabs = computed(() => {
  const tabs: { path: string; name: string; isDirty: boolean }[] = [];
  for (const [path, file] of store.openFiles) {
    const name = path.split("/").pop() || path;
    tabs.push({ path, name, isDirty: file.isDirty });
  }
  return tabs;
});

// Monaco editor setup
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
  if (!editorContainer.value || !store.activeFilePath || !store.activeFile)
    return;

  const theme = colorMode.value === "dark" ? "vs-dark" : "vs";
  const language = getLanguageFromPath(store.activeFilePath);
  const initialContent = store.activeFile.content;

  currentEditingPath = store.activeFilePath;

  editor = monaco.editor.create(editorContainer.value, {
    value: initialContent,
    language,
    theme,
    automaticLayout: true,
    minimap: { enabled: showMinimap.value },
    scrollBeyondLastLine: false,
    fontSize: 14,
    tabSize: 2,
    wordWrap: wordWrap.value ? "on" : "off",
  });

  // Listen for content changes with debounce
  editor.onDidChangeModelContent(() => {
    if (isSettingContent) return;

    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
      if (editor && currentEditingPath) {
        const content = editor.getValue();
        store.updateFileContent(currentEditingPath, content);
      }
    }, 300);
  });

  // Add keyboard shortcuts
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    handleSave();
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
    handleCloseActiveTab();
  });
}

function switchToFile(filePath: string, content: string) {
  if (!editor) return;

  // Clear any pending updates
  if (updateTimeout) {
    clearTimeout(updateTimeout);
    updateTimeout = null;
  }

  // Save current content before switching
  if (currentEditingPath && currentEditingPath !== filePath) {
    store.updateFileContent(currentEditingPath, editor.getValue());
  }

  // Update current file path first
  currentEditingPath = filePath;

  // Set content without triggering the change listener
  isSettingContent = true;
  const model = editor.getModel();
  if (model) {
    monaco.editor.setModelLanguage(model, getLanguageFromPath(filePath));
    model.setValue(content);
  }
  isSettingContent = false;
}

function destroyEditor() {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
    updateTimeout = null;
  }
  if (editor) {
    editor.dispose();
    editor = null;
  }
  currentEditingPath = null;
}

// Watch for active file changes
watch(
  () => store.activeFilePath,
  async (newPath) => {
    if (newPath) {
      const file = store.openFiles.get(newPath);
      if (file) {
        await nextTick();
        if (editor) {
          switchToFile(newPath, file.content);
        } else {
          createEditor();
        }
      }
    } else {
      destroyEditor();
    }
  },
);

watch(
  () => colorMode.value,
  (newMode) => {
    if (editor) {
      monaco.editor.setTheme(newMode === "dark" ? "vs-dark" : "vs");
    }
  },
);

// Event handlers
async function handleSave() {
  await store.saveActiveFile();
}

function handleUndo() {
  editor?.trigger("keyboard", "undo", null);
}

function handleRedo() {
  editor?.trigger("keyboard", "redo", null);
}

function toggleWordWrap() {
  wordWrap.value = !wordWrap.value;
  editor?.updateOptions({ wordWrap: wordWrap.value ? "on" : "off" });
}

function toggleMinimap() {
  showMinimap.value = !showMinimap.value;
  editor?.updateOptions({ minimap: { enabled: showMinimap.value } });
}

function handleCloseTab(path: string, isDirty: boolean) {
  if (isDirty) {
    if (!confirm($t("file_manager.details_panel.unsaved_changes"))) {
      return;
    }
  }
  store.closeFile(path);
}

function handleCloseActiveTab() {
  if (store.activeFilePath) {
    const file = store.openFiles.get(store.activeFilePath);
    handleCloseTab(store.activeFilePath, file?.isDirty || false);
  }
}

function handleCloseAllTabs() {
  if (store.hasUnsavedChanges) {
    if (!confirm($t("file_manager.details_panel.unsaved_changes_all"))) {
      return;
    }
  }
  for (const path of store.openFiles.keys()) {
    store.closeFile(path);
  }
}

function showTabContextMenu(event: MouseEvent, path: string) {
  contextMenuTabPath.value = path;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
}

function handleCloseOthers(path: string) {
  if (store.hasUnsavedChanges) {
    if (!confirm($t("file_manager.tabs.unsaved_changes_warning"))) {
      return;
    }
  }
  for (const [filePath] of store.openFiles) {
    if (filePath !== path) {
      store.closeFile(filePath);
    }
  }
  contextMenuTabPath.value = null;
}

function handleCloseToRight(path: string) {
  const tabIndex = openFileTabs.value.findIndex((t) => t.path === path);
  if (tabIndex === -1) return;

  if (store.hasUnsavedChanges) {
    const hasUnsaved = Array.from(store.openFiles.entries())
      .slice(tabIndex + 1)
      .some(([filePath, file]) => filePath !== path && file.isDirty);

    if (hasUnsaved) {
      if (!confirm($t("file_manager.tabs.unsaved_changes_right_warning"))) {
        return;
      }
    }
  }

  const pathsToClose = openFileTabs.value
    .slice(tabIndex + 1)
    .map((t) => t.path);
  for (const p of pathsToClose) {
    store.closeFile(p);
  }
  contextMenuTabPath.value = null;
}

function handleCloseToLeft(path: string) {
  const tabIndex = openFileTabs.value.findIndex((t) => t.path === path);
  if (tabIndex === -1) return;

  if (store.hasUnsavedChanges) {
    const hasUnsaved = Array.from(store.openFiles.entries())
      .slice(0, tabIndex)
      .some(([filePath, file]) => file.isDirty);

    if (hasUnsaved) {
      if (!confirm($t("file_manager.tabs.unsaved_changes_left_warning"))) {
        return;
      }
    }
  }

  const pathsToClose = openFileTabs.value.slice(0, tabIndex).map((t) => t.path);
  for (const p of pathsToClose) {
    store.closeFile(p);
  }
  contextMenuTabPath.value = null;
}

// Global keyboard shortcuts
function handleKeyDown(event: KeyboardEvent) {
  const modifierKey = event.ctrlKey;

  if (modifierKey && event.key === "s") {
    event.preventDefault();
    if (store.activeFilePath && store.activeFile?.isDirty) {
      handleSave();
    }
  }

  if (modifierKey && event.key === "w") {
    if (store.activeFilePath) {
      handleCloseActiveTab();
    } else {
      const shouldClose = confirm(
        $t("file_manager.details_panel.no_file_open"),
      );
      if (!shouldClose) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }
  }
}

// Warn before closing browser with unsaved changes
function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (store.hasUnsavedChanges) {
    event.preventDefault();
    event.returnValue = "";
    return "";
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("beforeunload", handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("beforeunload", handleBeforeUnload);
  destroyEditor();
});
</script>
