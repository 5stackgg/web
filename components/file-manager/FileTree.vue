<template>
  <div
    class="file-tree h-full overflow-auto border-r flex flex-col min-w-80 max-w-80"
    @contextmenu="handleTreeContextMenu"
    @drop="handleTreeDrop"
    @dragover.prevent
    @dragenter.prevent="handleTreeDragEnter"
    @dragleave.prevent="handleTreeDragLeave"
  >
    <!-- File Browser Toolbar -->
    <div class="flex items-center gap-1 border-b px-2 py-1.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              @click="handleCreateFileInRoot"
            >
              <FilePlus class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>New File</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              @click="handleCreateFolderInRoot"
            >
              <FolderPlus class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>New Folder</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              @click="openUploadDialog"
            >
              <Upload class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Upload Files</p>
          </TooltipContent>
        </Tooltip>

        <div class="flex-1" />

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              @click="refresh"
            >
              <RefreshCcw
                class="h-4 w-4"
                :class="{ 'animate-spin-smooth': store.isLoading }"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Refresh</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <div class="p-4 flex-1 overflow-auto">
      <div class="space-y-1">
        <FileTreeNode
          v-for="item in store.rootItems"
          :key="item.path"
          :item="item"
          @select="handleSelect"
          @edit-file="handleEditFile"
          @delete="handleDelete"
          @drop-files="handleDropFiles"
          @move-item="handleMoveItem"
        />

        <!-- Inline create at root level (move dummy/file-input to bottom) -->
        <div
          v-if="store.pendingCreate?.parentPath === ''"
          class="flex items-center gap-2 px-2 py-1 mt-1"
          @mousedown.stop
        >
          <span class="w-4"></span>
          <component
            :is="store.pendingCreate.type === 'directory' ? Folder : FileIcon"
            class="w-4 h-4 text-muted-foreground"
          />
          <Input
            ref="rootInlineInput"
            v-model="rootInlineCreateName"
            class="h-6 text-sm py-0 px-1"
            :placeholder="
              store.pendingCreate.type === 'directory'
                ? 'folder name'
                : 'file name'
            "
            @keydown.enter.prevent="confirmRootInlineCreate"
            @keydown.escape="cancelRootInlineCreate"
            @blur="handleRootInlineBlur"
            :autofocus="true"
          />
        </div>
      </div>

      <!-- Empty state / drop zone -->
      <div
        v-if="store.rootItems.length === 0 || treeDragOver"
        class="mt-4 p-4 border-2 border-dashed rounded-md text-center text-muted-foreground"
        :class="treeDragOver ? 'border-primary bg-primary/10' : 'border-muted'"
      >
        <Upload class="w-8 h-8 mx-auto mb-2" />
        <p class="text-sm">Drop files here or right-click to create</p>
      </div>
    </div>

    <!-- Tree context menu (for empty space) -->
    <DropdownMenu v-model:open="treeContextMenuOpen">
      <DropdownMenuTrigger as-child>
        <div
          class="fixed w-0 h-0"
          :style="{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-48">
        <DropdownMenuItem @click="handleCreateFileInRoot">
          <FilePlus class="mr-2 h-4 w-4" />
          <span>New File</span>
        </DropdownMenuItem>
        <DropdownMenuItem @click="handleCreateFolderInRoot">
          <FolderPlus class="mr-2 h-4 w-4" />
          <span>New Folder</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="openUploadDialog">
          <Upload class="mr-2 h-4 w-4" />
          <span>Upload Files</span>
        </DropdownMenuItem>
        <DropdownMenuItem @click="refresh">
          <RefreshCcw class="mr-2 h-4 w-4" />
          <span>Refresh</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Upload Progress Panel -->
    <div
      v-if="
        store.uploadBatch.isUploading || store.uploadBatch.completedFiles > 0
      "
      class="border-t bg-background"
    >
      <!-- Header with overall progress -->
      <div class="p-3 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Loader2
              v-if="store.uploadBatch.isUploading"
              class="w-4 h-4 animate-spin text-primary"
            />
            <CheckCircle
              v-else-if="
                store.uploadBatch.failedFiles.length === 0 &&
                !store.uploadBatch.cancelRequested
              "
              class="w-4 h-4 text-green-500"
            />
            <AlertCircle v-else class="w-4 h-4 text-yellow-500" />
            <span class="text-sm font-medium">
              <template v-if="store.uploadBatch.isUploading">
                Uploading files...
              </template>
              <template v-else-if="store.uploadBatch.cancelRequested">
                Upload cancelled
              </template>
              <template v-else-if="store.uploadBatch.failedFiles.length === 0">
                Upload complete
              </template>
              <template v-else> Upload complete with errors </template>
            </span>
          </div>
          <div class="flex items-center gap-1">
            <Button
              v-if="store.uploadBatch.isUploading"
              variant="ghost"
              size="icon"
              class="h-6 w-6"
              @click="store.cancelUpload()"
            >
              <X class="h-3 w-3" />
            </Button>
            <Button
              v-else
              variant="ghost"
              size="icon"
              class="h-6 w-6"
              @click="store.resetUploadBatch()"
            >
              <X class="h-3 w-3" />
            </Button>
          </div>
        </div>

        <!-- Overall progress bar -->
        <Progress :model-value="store.uploadOverallProgress" class="h-2" />

        <!-- Stats row -->
        <div
          class="flex items-center justify-between text-xs text-muted-foreground"
        >
          <span
            >{{ store.uploadBatch.completedFiles }} /
            {{ store.uploadBatch.totalFiles }} files</span
          >
          <span
            >{{ formatBytes(store.uploadBatch.uploadedBytes) }} /
            {{ formatBytes(store.uploadBatch.totalBytes) }}</span
          >
        </div>

        <!-- Current file -->
        <div
          v-if="store.uploadBatch.currentFile"
          class="text-xs text-muted-foreground truncate"
        >
          Current: {{ store.uploadBatch.currentFile }}
        </div>
      </div>

      <!-- Expandable details -->
      <Collapsible v-model:open="uploadDetailsOpen">
        <CollapsibleTrigger
          class="w-full px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground hover:bg-muted/50 border-t"
        >
          <span>{{ uploadDetailsOpen ? "Hide details" : "Show details" }}</span>
          <ChevronDown
            class="h-3 w-3 transition-transform"
            :class="{ 'rotate-180': uploadDetailsOpen }"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div class="px-3 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
            <!-- In-progress files -->
            <div
              v-for="[filename, progress] in store.uploadProgress"
              :key="filename"
              class="space-y-0.5"
            >
              <div class="flex items-center justify-between text-xs">
                <div class="flex items-center gap-1.5 truncate flex-1 min-w-0">
                  <Loader2 class="w-3 h-3 animate-spin text-primary shrink-0" />
                  <span class="truncate">{{ filename }}</span>
                </div>
                <span class="text-muted-foreground ml-2 shrink-0"
                  >{{ Math.round(progress) }}%</span
                >
              </div>
              <Progress :model-value="progress" class="h-1" />
            </div>

            <!-- Failed files -->
            <div
              v-for="filename in store.uploadBatch.failedFiles"
              :key="`failed-${filename}`"
              class="flex items-center gap-1.5 text-xs text-red-500"
            >
              <AlertCircle class="w-3 h-3 shrink-0" />
              <span class="truncate">{{ filename }}</span>
              <span class="ml-auto shrink-0">Failed</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>

    <!-- Upload Dialog -->
    <FileUploadDialog v-model:open="uploadDialogOpen" />

    <!-- Delete Confirmation Dialog -->
    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "{{ deletingItem?.name }}". This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            @click="confirmDelete"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import type { FileItem } from "~/stores/FileManagerStore";
import FileTreeNode from "./FileTreeNode.vue";
import FileUploadDialog from "./FileUploadDialog.vue";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Upload,
  FilePlus,
  FolderPlus,
  RefreshCcw,
  Folder,
  File as FileIcon,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  ChevronDown,
} from "lucide-vue-next";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useFileTreeInteractions } from "./useFileTreeInteractions";

const store = useFileManagerStore();

// Use composable for file tree interactions
const {
  store: storeRef,
  treeDragOver,
  contextMenuOpen: treeContextMenuOpen,
  contextMenuPosition,
  handleTreeContextMenu,
  handleTreeDragEnter,
  handleTreeDragLeave,
  handleSelect,
  handleEditFile,
  handleDelete,
  handleDropFiles,
  handleMoveItem,
  handleCreateFileInRoot,
  handleCreateFolderInRoot,
  openUploadDialog,
  refresh,
} = useFileTreeInteractions();

// Upload dialog state
const uploadDialogOpen = ref(false);
const uploadDetailsOpen = ref(false);

// Helper to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Root inline create state
const rootInlineCreateName = ref("");
const rootInlineInput = ref<InstanceType<typeof Input> | null>(null);

let dummyFocusTimeout: ReturnType<typeof setTimeout> | null = null;

// Helper to get the real input element from the component ref
function getRootInlineInputEl(): HTMLInputElement | undefined {
  // Try to handle several possible component structures
  if (rootInlineInput.value && "$el" in rootInlineInput.value && rootInlineInput.value.$el instanceof HTMLElement) {
    // Most likely case, Vuetify or similar
    return rootInlineInput.value.$el as HTMLInputElement;
  }
  // Shadcn/Vue/Shallow component, fallback to ref on root
  if ((rootInlineInput.value as any)?.$refs?.input) {
    return (rootInlineInput.value as any).$refs.input as HTMLInputElement;
  }
  // Next tick: check if Input passes through ref directly
  if ((rootInlineInput.value as any) instanceof HTMLInputElement) {
    return rootInlineInput.value as any as HTMLInputElement;
  }
  return undefined;
}

// Watch for pending create at root level, focus input when it appears just like FileTreeNode!
watch(
  () => store.pendingCreate,
  async (pending, prev) => {
    // If inline create at root
    if (pending?.parentPath === "") {
      rootInlineCreateName.value = "";
      await nextTick();
      const inputEl = getRootInlineInputEl();
      if (inputEl && typeof inputEl.focus === "function") {
        inputEl.focus();
        // Scroll into view to help UX if needed
        inputEl.select?.();
        inputEl.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      }
    }
  }
);

// Blur handler: confirm or cancel
function handleRootInlineBlur() {
  if (dummyFocusTimeout) clearTimeout(dummyFocusTimeout);
  dummyFocusTimeout = setTimeout(() => {
    // If still in create mode & value empty, cancel. Otherwise confirm.
    if (store.pendingCreate?.parentPath === "") {
      if (rootInlineCreateName.value.trim()) {
        confirmRootInlineCreate();
      } else {
        cancelRootInlineCreate();
      }
    }
  }, 120);
}

async function confirmRootInlineCreate() {
  if (dummyFocusTimeout) clearTimeout(dummyFocusTimeout);
  if (rootInlineCreateName.value.trim()) {
    await store.confirmInlineCreate(rootInlineCreateName.value.trim());
  }
  rootInlineCreateName.value = "";
}

function cancelRootInlineCreate() {
  if (dummyFocusTimeout) clearTimeout(dummyFocusTimeout);
  store.cancelInlineCreate();
  rootInlineCreateName.value = "";
}

// Delete state
const deleteDialogOpen = ref(false);
const deletingItem = ref<FileItem | null>(null);


// Helper to read a FileSystemEntry as a File
function readEntryAsFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

// Helper to read all entries from a directory
function readDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

// Recursively read all files from a FileSystemEntry (file or directory)
async function readEntriesRecursively(
  entry: FileSystemEntry,
  basePath: string = "",
): Promise<{ file: File; relativePath: string }[]> {
  const results: { file: File; relativePath: string }[] = [];

  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await readEntryAsFile(fileEntry);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    results.push({ file, relativePath });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const newBasePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    // Read all entries (readEntries may not return all at once)
    let entries: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];
    do {
      batch = await readDirectoryEntries(reader);
      entries = entries.concat(batch);
    } while (batch.length > 0);

    // Process all entries recursively
    for (const childEntry of entries) {
      const childResults = await readEntriesRecursively(
        childEntry,
        newBasePath,
      );
      results.push(...childResults);
    }
  }

  return results;
}

async function handleTreeDrop(event: DragEvent) {
  event.preventDefault();
  resetDragState();
  treeDragOver.value = false;

  if (!event.dataTransfer) return;

  // Check if this is an internal move (dragging from within the file tree)
  const sourcePath = event.dataTransfer.getData(
    "application/x-file-manager-path",
  );

  if (sourcePath) {
    // Internal move to root - check if already at root
    const sourceParent = sourcePath.split("/").slice(0, -1).join("/");
    if (sourceParent === "") {
      // Already at root, nothing to do
      return;
    }

    try {
      await store.moveItem(sourcePath, "");
    } catch (error) {
      console.error("Failed to move item to root:", error);
    }
    return;
  }

  // External file drop
  if (!event.dataTransfer.items) return;

  // Use webkitGetAsEntry to properly handle folders
  const items = Array.from(event.dataTransfer.items);
  const fileEntries: { file: File; relativePath: string }[] = [];

  for (const item of items) {
    if (item.kind !== "file") continue;

    const entry = item.webkitGetAsEntry();
    if (entry) {
      const results = await readEntriesRecursively(entry);
      fileEntries.push(...results);
    }
  }

  if (fileEntries.length > 0) {
    await uploadFilesWithPaths(fileEntries, store.currentPath);
  }
}

async function uploadFilesWithPaths(
  fileEntries: { file: File; relativePath: string }[],
  targetPath: string,
) {
  await store.uploadFilesWithPaths(fileEntries, targetPath);
}

async function uploadFilesToPath(files: File[], targetPath: string) {
  // Convert to file entries format (no relative paths, just file names)
  const fileEntries = files.map((file) => ({
    file,
    relativePath: file.name,
  }));
  await uploadFilesWithPaths(fileEntries, targetPath);
}

async function confirmDelete() {
  if (!deletingItem.value) return;

  try {
    await store.deleteItem(deletingItem.value.path);
    deleteDialogOpen.value = false;
    deletingItem.value = null;
  } catch (error) {
    console.error("Failed to delete:", error);
  }
}
</script>
