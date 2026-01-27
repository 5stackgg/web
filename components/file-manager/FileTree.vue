<template>
  <div
    class="file-tree h-full overflow-auto border-r flex flex-col"
    @contextmenu="handleTreeContextMenu"
    @drop="handleTreeDrop"
    @dragover.prevent
    @dragenter.prevent="treeDragOver = true"
    @dragleave.prevent="treeDragOver = false"
  >
    <!-- File Browser Menubar -->
    <Menubar class="rounded-none border-b border-t-0 border-x-0 px-2">
      <MenubarMenu>
        <MenubarTrigger class="text-sm">File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem @click="handleCreateFileInRoot">
            <FilePlus class="mr-2 h-4 w-4" />
            New File
          </MenubarItem>
          <MenubarItem @click="handleCreateFolderInRoot">
            <FolderPlus class="mr-2 h-4 w-4" />
            New Folder
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem @click="openUploadDialog">
            <Upload class="mr-2 h-4 w-4" />
            Upload Files
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem @click="refresh">
            <RefreshCcw class="mr-2 h-4 w-4" />
            Refresh
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>

    <div class="p-4 flex-1 overflow-auto">
      <!-- Inline create at root level -->
      <div
        v-if="store.pendingCreate?.parentPath === ''"
        class="flex items-center gap-2 px-2 py-1 mb-1"
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
          :placeholder="store.pendingCreate.type === 'directory' ? 'folder name' : 'file name'"
          @keydown.enter="confirmRootInlineCreate"
          @keydown.escape="cancelRootInlineCreate"
          @blur="handleRootInlineBlur"
          autofocus
        />
      </div>

      <div class="space-y-1">
        <FileTreeNode
          v-for="item in store.rootItems"
          :key="item.path"
          :item="item"
          @select="handleSelect"
          @edit-file="handleEditFile"
          @rename="handleRename"
          @delete="handleDelete"
          @drop-files="handleDropFiles"
        />
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
          :style="{ left: `${contextMenuPosition.x}px`, top: `${contextMenuPosition.y}px` }"
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

    <!-- Upload Dialog -->
    <FileUploadDialog v-model:open="uploadDialogOpen" />

    <!-- Create File Dialog -->
    <CreateFileDialog
      v-model:open="createFileDialogOpen"
      :parent-path="createParentPath"
    />

    <!-- Create Folder Dialog -->
    <Dialog v-model:open="createFolderDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Folder</DialogTitle>
          <DialogDescription>
            Enter a name for the new folder
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              v-model="newFolderName"
              placeholder="my-folder"
              @keyup.enter="confirmCreateFolder"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="createFolderDialogOpen = false">
            Cancel
          </Button>
          <Button @click="confirmCreateFolder" :disabled="!newFolderName">
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Rename Dialog -->
    <Dialog v-model:open="renameDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>
            Enter a new name
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="new-name">New Name</Label>
            <Input
              id="new-name"
              v-model="newName"
              @keyup.enter="confirmRename"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="renameDialogOpen = false">
            Cancel
          </Button>
          <Button @click="confirmRename" :disabled="!newName">
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete "{{ deletingItem?.name }}". This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmDelete" class="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import type { FileItem } from "~/stores/FileManagerStore";
import FileTreeNode from './FileTreeNode.vue';
import FileUploadDialog from './FileUploadDialog.vue';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Upload, FilePlus, FolderPlus, RefreshCcw, Folder, File as FileIcon } from "lucide-vue-next";
import { Input } from "@/components/ui/input";

const store = useFileManagerStore();

// Tree context menu state
const treeContextMenuOpen = ref(false);
const treeDragOver = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });

// Upload dialog state
const uploadDialogOpen = ref(false);

// Root inline create state
const rootInlineCreateName = ref("");
const rootInlineInput = ref<HTMLInputElement | null>(null);

// Watch for pending create at root level
watch(
  () => store.pendingCreate,
  async (pending) => {
    if (pending?.parentPath === '') {
      rootInlineCreateName.value = "";
      await nextTick();
      rootInlineInput.value?.focus();
    }
  }
);

async function confirmRootInlineCreate() {
  if (rootInlineCreateName.value.trim()) {
    await store.confirmInlineCreate(rootInlineCreateName.value.trim());
  }
  rootInlineCreateName.value = "";
}

function cancelRootInlineCreate() {
  store.cancelInlineCreate();
  rootInlineCreateName.value = "";
}

function handleRootInlineBlur() {
  setTimeout(() => {
    if (store.pendingCreate?.parentPath === '') {
      if (rootInlineCreateName.value.trim()) {
        confirmRootInlineCreate();
      } else {
        cancelRootInlineCreate();
      }
    }
  }, 100);
}

// Rename state
const renameDialogOpen = ref(false);
const renamingItem = ref<FileItem | null>(null);
const newName = ref("");

// Delete state
const deleteDialogOpen = ref(false);
const deletingItem = ref<FileItem | null>(null);

function handleTreeContextMenu(event: MouseEvent) {
  // Only show if not clicking on a file tree node
  const target = event.target as HTMLElement;
  if (!target.closest('.file-tree-node')) {
    event.preventDefault();
    event.stopPropagation();
    contextMenuPosition.value = { x: event.clientX, y: event.clientY };
    treeContextMenuOpen.value = true;
  }
}

function handleTreeDrop(event: DragEvent) {
  event.preventDefault();
  treeDragOver.value = false;

  if (!event.dataTransfer?.files) return;

  const files = Array.from(event.dataTransfer.files);
  // Upload to current path (root by default)
  void uploadFilesToPath(files, store.currentPath);
}

async function uploadFilesToPath(files: File[], targetPath: string) {
  // Temporarily set current path for upload
  const originalPath = store.currentPath;
  store.navigateToPath(targetPath);
  await store.uploadFiles(files);
  store.navigateToPath(originalPath);
}

function handleDropFiles(data: { files: File[]; targetPath: string }) {
  void uploadFilesToPath(data.files, data.targetPath);
}

function handleCreateFileInRoot() {
  createParentPath.value = "";
  createFileDialogOpen.value = true;
}

function handleCreateFolderInRoot() {
  createFolderParentPath.value = "";
  newFolderName.value = "";
  createFolderDialogOpen.value = true;
}

function openUploadDialog() {
  uploadDialogOpen.value = true;
}

function refresh() {
  void store.loadDirectory(store.currentPath);
}

function handleSelect(item: FileItem) {
  if (item.isDirectory) {
    store.navigateToPath(item.path);
  } else {
    // Open file in embedded editor
    handleEditFile(item);
  }
}

function handleEditFile(item: FileItem) {
  // Open file in the embedded Monaco editor (in FileDetailsPanel)
  store.openFile(item.path);
}

function handleCreateFile(parentItem: FileItem) {
  createParentPath.value = parentItem.path;
  createFileDialogOpen.value = true;
}

function handleCreateFolder(parentItem: FileItem) {
  createFolderParentPath.value = parentItem.path;
  newFolderName.value = "";
  createFolderDialogOpen.value = true;
}

async function confirmCreateFolder() {
  if (!newFolderName.value) return;

  // Temporarily set currentPath to the parent path for directory creation
  const originalPath = store.currentPath;
  store.navigateToPath(createFolderParentPath.value);

  try {
    await store.createDirectory(newFolderName.value);
    createFolderDialogOpen.value = false;
    newFolderName.value = "";
  } catch (error) {
    console.error("Failed to create folder:", error);
  } finally {
    // Restore original path
    store.navigateToPath(originalPath);
  }
}

function handleRename(item: FileItem) {
  renamingItem.value = item;
  newName.value = item.name;
  renameDialogOpen.value = true;
}

async function confirmRename() {
  if (!renamingItem.value || !newName.value) return;

  try {
    await store.renameItem(renamingItem.value.path, newName.value);
    renameDialogOpen.value = false;
    renamingItem.value = null;
    newName.value = "";
  } catch (error) {
    console.error("Failed to rename:", error);
  }
}

function handleDelete(item: FileItem) {
  deletingItem.value = item;
  deleteDialogOpen.value = true;
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

<style scoped>
.file-tree {
  min-width: 250px;
  max-width: 350px;
}
</style>
