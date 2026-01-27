<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Upload Files</DialogTitle>
        <DialogDescription>
          Select files to upload to the current directory
        </DialogDescription>
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
            Drag and drop files here or click to browse
          </p>
          <p class="text-xs text-muted-foreground">Maximum file size: 100MB</p>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          multiple
          class="hidden"
          @change="handleFileSelect"
        />

        <!-- Upload progress -->
        <div v-if="store.uploadProgress.size > 0" class="space-y-2">
          <div
            v-for="[filename, progress] in store.uploadProgress"
            :key="filename"
            class="space-y-1"
          >
            <div class="flex items-center justify-between text-sm">
              <span class="truncate">{{ filename }}</span>
              <span class="text-muted-foreground"
                >{{ Math.round(progress) }}%</span
              >
            </div>
            <Progress :model-value="progress" />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">
          Close
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

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const store = useFileManagerStore();
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

function triggerFileInput() {
  fileInputRef.value?.click();
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files) return;

  const files = Array.from(target.files);
  await store.uploadFiles(files);

  // Clear input
  target.value = "";
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;

  if (!event.dataTransfer?.files) return;

  const files = Array.from(event.dataTransfer.files);
  await store.uploadFiles(files);
}
</script>
