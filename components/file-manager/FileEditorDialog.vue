<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-4xl max-h-[80vh]">
      <DialogHeader>
        <DialogTitle>Edit File: {{ filePath }}</DialogTitle>
        <DialogDescription>
          Make changes to the file content
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 flex-1 overflow-hidden">
        <div v-if="isLoading" class="text-center py-8 text-muted-foreground">
          Loading file...
        </div>

        <div v-else-if="fileContent !== null" class="h-[400px] overflow-auto">
          <textarea
            v-model="fileContent"
            class="w-full h-full p-4 font-mono text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            :disabled="isSaving"
          />
        </div>

        <Alert v-if="error" variant="destructive">
          <AlertTriangle class="w-4 h-4" />
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>

        <Alert v-if="saveSuccess" variant="default" class="bg-green-50 border-green-200">
          <Check class="w-4 h-4 text-green-600" />
          <AlertDescription class="text-green-800">File saved successfully!</AlertDescription>
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
import { ref, watch, computed } from "vue";
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

const props = defineProps<{
  open: boolean;
  filePath: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const store = useFileManagerStore();
const fileContent = ref<string | null>(null);
const originalContent = ref<string | null>(null);
const isLoading = ref(false);
const isSaving = ref(false);
const error = ref<string | null>(null);
const saveSuccess = ref(false);

const hasChanges = computed(() => fileContent.value !== originalContent.value);

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await loadFile();
    } else {
      resetState();
    }
  }
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
  if (!fileContent.value) return;

  isSaving.value = true;
  error.value = null;
  saveSuccess.value = false;

  try {
    // Create a file from the content
    const blob = new Blob([fileContent.value], { type: "text/plain" });
    const file = new File([blob], props.filePath.split("/").pop() || "file.txt");

    // Delete the old file first
    await store.deleteItem(props.filePath);

    // Upload the new version
    await store.uploadFiles([file]);

    originalContent.value = fileContent.value;
    saveSuccess.value = true;

    // Auto-close after 2 seconds
    setTimeout(() => {
      emit("update:open", false);
    }, 2000);
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
</script>
