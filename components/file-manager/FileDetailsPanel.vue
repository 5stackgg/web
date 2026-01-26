<template>
  <div
    class="file-details-panel flex-1 flex flex-col"
    @drop="handleDrop"
    @dragover.prevent
    @dragenter.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
  >
    <!-- Toolbar -->
    <div class="border-b p-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <!-- Breadcrumb navigation -->
        <button
          v-if="store.currentPath"
          @click="navigateUp"
          class="p-2 hover:bg-accent rounded-md"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>
        <span class="text-sm text-muted-foreground">
          {{ store.currentPath || "/" }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <Button @click="openUploadDialog" size="sm">
          <Upload class="w-4 h-4 mr-2" />
          Upload
        </Button>
        <Button @click="openCreateDirectoryDialog" size="sm" variant="outline">
          <Plus class="w-4 h-4 mr-2" />
          New Folder
        </Button>
        <Button @click="refresh" size="sm" variant="ghost">
          <RefreshCcw class="w-4 h-4" />
        </Button>
      </div>
    </div>

    <!-- Drag overlay -->
    <div
      v-if="isDragging"
      class="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center z-10"
    >
      <div class="text-center">
        <Upload class="w-12 h-12 mx-auto mb-2" />
        <p class="text-lg font-semibold">Drop files here to upload</p>
      </div>
    </div>

    <!-- File table -->
    <div class="flex-1 overflow-auto p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Modified</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="item in store.currentDirectoryItems"
            :key="item.path"
            class="cursor-pointer hover:bg-accent"
            @dblclick="handleDoubleClick(item)"
          >
            <TableCell class="flex items-center gap-2">
              <Folder class="w-4 h-4" />
                :name="item.isDirectory ? 'radix-icons:folder' : 'radix-icons:file'"
                class="w-4 h-4"
              />
              {{ item.name }}
            </TableCell>
            <TableCell>{{ formatSize(item.size) }}</TableCell>
            <TableCell>{{ formatDate(item.modified) }}</TableCell>
            <TableCell class="text-right">
              <FileActionsMenu :item="item" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        v-if="store.currentDirectoryItems.length === 0 && !store.isLoading"
        class="text-center text-muted-foreground py-8"
      >
        This directory is empty
      </div>

      <div v-if="store.isLoading" class="text-center text-muted-foreground py-8">
        Loading...
      </div>
    </div>

    <!-- Dialogs -->
    <FileUploadDialog v-model:open="uploadDialogOpen" />
    <CreateDirectoryDialog v-model:open="createDirDialogOpen" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FileItem } from "~/stores/FileManagerStore";
import FileUploadDialog from "./FileUploadDialog.vue";
import CreateDirectoryDialog from "./CreateDirectoryDialog.vue";
import FileActionsMenu from "./FileActionsMenu.vue";
import { Upload, Plus, RefreshCcw, Folder, ArrowLeft } from "lucide-vue-next";

const store = useFileManagerStore();
const isDragging = ref(false);
const uploadDialogOpen = ref(false);
const createDirDialogOpen = ref(false);

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;

  if (!event.dataTransfer?.files) return;

  const files = Array.from(event.dataTransfer.files);
  void store.uploadFiles(files);
}

function handleDoubleClick(item: FileItem) {
  if (item.isDirectory) {
    store.navigateToPath(item.path);
  }
}

function navigateUp() {
  const pathParts = store.currentPath.split("/");
  pathParts.pop();
  const parentPath = pathParts.join("/");
  store.navigateToPath(parentPath);
}

function refresh() {
  void store.loadDirectory(store.currentPath);
}

function openUploadDialog() {
  uploadDialogOpen.value = true;
}

function openCreateDirectoryDialog() {
  createDirDialogOpen.value = true;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}
</script>

<style scoped>
.file-details-panel {
  position: relative;
}
</style>
