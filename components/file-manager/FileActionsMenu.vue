<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm">
        <EllipsisVertical class="w-4 h-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem v-if="!item.isDirectory" @click="handleEdit">
        <Pencil class="w-4 h-4 mr-2" />
        Edit
      </DropdownMenuItem>
      <DropdownMenuItem @click="handleRename">
        <Text class="w-4 h-4 mr-2" />
        Rename
      </DropdownMenuItem>
      <DropdownMenuItem @click="handleDelete" class="text-destructive">
        <Trash class="w-4 h-4 mr-2" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <FileEditorDialog v-model:open="editorDialogOpen" :file-path="item.path" />
  <RenameDialog v-model:open="renameDialogOpen" :item="item" />
  <DeleteConfirmDialog v-model:open="deleteDialogOpen" :item="item" />
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FileItem } from "~/stores/FileManagerStore";

const props = defineProps<{
  item: FileItem;
}>();

const editorDialogOpen = ref(false);
const renameDialogOpen = ref(false);
const deleteDialogOpen = ref(false);

function handleEdit() {
  editorDialogOpen.value = true;
}

function handleRename() {
  renameDialogOpen.value = true;
}

function handleDelete() {
  deleteDialogOpen.value = true;
}
</script>
