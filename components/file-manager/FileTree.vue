<template>
  <div class="file-tree h-full overflow-auto border-r">
    <div class="p-4">
      <h3 class="font-semibold mb-2">File Browser</h3>
      <div class="space-y-1">
        <FileTreeNode
          v-for="item in store.rootItems"
          :key="item.path"
          :item="item"
          @select="handleSelect"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FileItem } from "~/stores/FileManagerStore";
import FileTreeNode from './FileTreeNode.vue' 

const store = useFileManagerStore();

function handleSelect(item: FileItem) {
  if (item.isDirectory) {
    store.navigateToPath(item.path);
  }
}
</script>

<style scoped>
.file-tree {
  min-width: 250px;
  max-width: 350px;
}
</style>
