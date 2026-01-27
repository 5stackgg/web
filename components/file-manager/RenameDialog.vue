<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle
          >Rename {{ item?.isDirectory ? "Directory" : "File" }}</DialogTitle
        >
        <DialogDescription>
          Enter a new name for "{{ item?.name }}"
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="new-name">New Name</Label>
          <Input id="new-name" v-model="newName" @keyup.enter="handleRename" />
        </div>

        <Alert v-if="store.error" variant="destructive">
          <AlertTriangle class="w-4 h-4" />
          <AlertDescription>{{ store.error }}</AlertDescription>
        </Alert>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleCancel"> Cancel </Button>
        <Button @click="handleRename" :disabled="!newName || store.isLoading">
          Rename
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FileItem } from "~/stores/FileManagerStore";
import { AlertTriangle } from "lucide-vue-next";

const props = defineProps<{
  open: boolean;
  item: FileItem;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const store = useFileManagerStore();
const newName = ref("");

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      newName.value = props.item.name;
    } else {
      store.clearError();
    }
  },
);

async function handleRename() {
  if (!newName.value || !props.item) return;

  try {
    await store.renameItem(props.item.path, newName.value);
    emit("update:open", false);
  } catch (error) {
    // Error handled by store
  }
}

function handleCancel() {
  emit("update:open", false);
}
</script>
