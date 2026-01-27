<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create New File</DialogTitle>
        <DialogDescription> Enter a name for the new file </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="file-name">File Name</Label>
          <Input
            id="file-name"
            v-model="fileName"
            placeholder="my-file.txt"
            @keyup.enter="handleCreate"
          />
        </div>

        <Alert v-if="localError" variant="destructive">
          <AlertTriangle class="w-4 h-4" />
          <AlertDescription>{{ localError }}</AlertDescription>
        </Alert>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleCancel"> Cancel </Button>
        <Button @click="handleCreate" :disabled="!fileName || isCreating">
          {{ isCreating ? "Creating..." : "Create" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const props = defineProps<{
  open: boolean;
  parentPath?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const store = useFileManagerStore();
const fileName = ref("");
const localError = ref<string | null>(null);
const isCreating = ref(false);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      fileName.value = "";
      localError.value = null;
    }
  },
);

async function handleCreate() {
  if (!fileName.value) return;

  isCreating.value = true;
  localError.value = null;

  try {
    // Build full path using parentPath if provided
    const filePath = props.parentPath
      ? `${props.parentPath}/${fileName.value}`
      : fileName.value;

    const success = await store.saveFile(filePath, "");
    if (success) {
      emit("update:open", false);
    } else {
      localError.value = store.error || "Failed to create file";
    }
  } catch (error: any) {
    localError.value = error.message || "Failed to create file";
  } finally {
    isCreating.value = false;
  }
}

function handleCancel() {
  emit("update:open", false);
}
</script>
