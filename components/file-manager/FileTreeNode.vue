<template>
  <div class="file-tree-node">
    <div
      class="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded-md cursor-pointer"
      :class="{ 'bg-accent': isSelected }"
      @click="handleClick"
    >
      <button
        v-if="item.isDirectory"
        @click.stop="toggleExpand"
        class="w-4 h-4 flex items-center justify-center"
      >
        <ChevronDownIcon
          :name="expanded ? 'radix-icons:chevron-down' : 'radix-icons:chevron-right'"
          class="w-4 h-4"
        />
      </button>
      <span v-else class="w-4"></span>

      <Folder
        :name="item.isDirectory ? 'radix-icons:folder' : 'radix-icons:file'"
        class="w-4 h-4"
      />
      <span class="text-sm truncate">{{ item.name }}</span>
    </div>

    <div v-if="item.isDirectory && expanded" class="ml-4">
      <FileTreeNode
        v-for="child in children"
        :key="child.path"
        :item="child"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { FileItem } from "~/stores/FileManagerStore";
import { Folder } from "lucide-vue-next";

const props = defineProps<{
  item: FileItem;
}>();

const emit = defineEmits<{
  select: [item: FileItem];
}>();

const store = useFileManagerStore();

const expanded = computed(() => store.expandedPaths.has(props.item.path));

const children = computed(() => {
  if (!props.item.isDirectory) return [];
  return store.fileTree.get(props.item.path) || [];
});

const isSelected = computed(
  () => store.selectedItem?.path === props.item.path
);

function toggleExpand() {
  store.toggleExpand(props.item.path);
}

function handleClick() {
  emit("select", props.item);
  store.selectItem(props.item);
}
</script>
