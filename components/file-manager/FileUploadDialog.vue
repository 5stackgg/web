<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ $t("file_manager.upload.title") }}</DialogTitle>
        <DialogDescription>{{ $t("file_manager.upload.description") }}</DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div
          class="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-accent/50 transition"
          @click="triggerFileInput"
          @drop="handleDrop"
          @dragover.prevent
          @dragenter.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          :class="{ 'bg-accent': isDragging }"
        >
          <Upload class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p class="text-sm font-medium mb-1">
            {{ $t("file_manager.upload.drag_drop") }}
          </p>
          <p class="text-xs text-muted-foreground">{{ $t("file_manager.upload.max_size") }}</p>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          multiple
          class="hidden"
          @change="handleFileSelect"
        />

        <!-- Upload progress -->
        <div
          v-if="
            store.uploadBatch.isUploading ||
            store.uploadBatch.completedFiles > 0
          "
          class="space-y-3"
        >
          <!-- Overall progress -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium">
                {{
                  store.uploadBatch.isUploading
                    ? $t("file_manager.upload.uploading")
                    : $t("file_manager.upload.complete")
                }}
              </span>
              <span class="text-muted-foreground">
                {{ store.uploadBatch.completedFiles }} /
                {{ store.uploadBatch.totalFiles }} {{ $t("file_manager.tree.files") }}
              </span>
            </div>
            <Progress :model-value="store.uploadOverallProgress" class="h-2" />
          </div>

          <!-- Current file progress -->
          <div
            v-if="store.uploadBatch.currentFile"
            class="text-xs text-muted-foreground"
          >
            {{ $t("file_manager.tree.current") }}: {{ store.uploadBatch.currentFile }}
          </div>

          <!-- Failed files warning -->
          <div
            v-if="store.uploadBatch.failedFiles.length > 0"
            class="text-xs text-destructive"
          >
            {{ $t("file_manager.upload.files_failed", { count: store.uploadBatch.failedFiles.length }) }}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">
          {{ $t("common.close") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Upload } from "lucide-vue-next";
import { useFileUpload } from "./useFileUpload";

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const store = useFileManagerStore();
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const { processFileInput, processDropEvent } = useFileUpload();

function triggerFileInput() {
  fileInputRef.value?.click();
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files) return;

  // Use the composable to process files (supports directories if browser allows)
  const fileEntries = await processFileInput(target.files);
  await store.uploadFilesWithPaths(fileEntries, store.currentPath);

  // Clear input
  target.value = "";
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;

  if (!event.dataTransfer) return;

  // Use the composable to process drop event (supports directories)
  const fileEntries = await processDropEvent(event.dataTransfer);
  if (fileEntries.length > 0) {
    await store.uploadFilesWithPaths(fileEntries, store.currentPath);
  }
}
</script>
