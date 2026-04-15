<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {{
            item?.isDirectory
              ? $t("file_manager.delete_confirm.title_directory")
              : $t("file_manager.delete_confirm.title_file")
          }}
        </DialogTitle>
        <DialogDescription>
          {{
            item?.isDirectory
              ? $t("file_manager.delete_confirm.description_directory", { name: item?.name })
              : $t("file_manager.delete_confirm.description_file", { name: item?.name })
          }}
        </DialogDescription>
      </DialogHeader>

      <Alert v-if="store.error" variant="destructive">
        <AlertTriangle class="w-4 h-4" />
        <AlertDescription>{{ store.error }}</AlertDescription>
      </Alert>

      <DialogFooter>
        <Button variant="outline" @click="handleCancel">{{ $t("common.cancel") }}</Button>
        <Button
          variant="destructive"
          @click="handleDelete"
          :disabled="store.isLoading"
        >
          {{ $t("common.delete") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { watch } from "vue";
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

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      store.clearError();
    }
  },
);

async function handleDelete() {
  if (!props.item) return;

  try {
    await store.deleteItem(props.item.path);
    emit("update:open", false);
  } catch (error) {
    // Error handled by store
  }
}

function handleCancel() {
  emit("update:open", false);
}
</script>
