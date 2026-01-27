<template>
  <div class="file-tree-node" @contextmenu="handleContextMenu">
    <div
      class="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded-md cursor-pointer"
      :class="{ 'bg-accent': isSelected, 'bg-primary/20 border border-primary': isDragOver && item.isDirectory }"
      @click="handleClick"
      @drop="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragenter.prevent="handleDragEnter"
      @dragleave.prevent="handleDragLeave"
    >
      <button
        v-if="item.isDirectory"
        @click.stop="toggleExpand"
        class="w-4 h-4 flex items-center justify-center"
      >
        <ChevronRight
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-90': expanded }"
        />
      </button>
      <span v-else class="w-4"></span>

      <Folder v-if="item.isDirectory" class="w-4 h-4 text-muted-foreground" />
      <File v-else class="w-4 h-4 text-muted-foreground" />
      <span class="text-sm truncate">{{ item.name }}</span>
    </div>

    <DropdownMenu v-model:open="contextMenuOpen">
      <DropdownMenuTrigger as-child>
        <div
          class="fixed w-0 h-0"
          :style="{ left: `${contextMenuPosition.x}px`, top: `${contextMenuPosition.y}px` }"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-48">
        <template v-if="item.isDirectory">
          <DropdownMenuItem @click="startCreateFile">
            <FilePlus class="mr-2 h-4 w-4" />
            <span>New File</span>
          </DropdownMenuItem>
          <DropdownMenuItem @click="startCreateFolder">
            <FolderPlus class="mr-2 h-4 w-4" />
            <span>New Folder</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </template>
        <template v-else>
          <DropdownMenuItem @click="$emit('edit-file', item)">
            <Pencil class="mr-2 h-4 w-4" />
            <span>Edit</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </template>
        <DropdownMenuItem @click="$emit('rename', item)">
          <PenLine class="mr-2 h-4 w-4" />
          <span>Rename</span>
        </DropdownMenuItem>
        <DropdownMenuItem @click="$emit('delete', item)" class="text-destructive">
          <Trash2 class="mr-2 h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <div v-if="item.isDirectory && expanded" class="ml-4">
      <!-- Inline create input -->
      <div
        v-if="store.pendingCreate?.parentPath === item.path"
        class="flex items-center gap-2 px-2 py-1"
      >
        <span class="w-4"></span>
        <component
          :is="store.pendingCreate.type === 'directory' ? Folder : File"
          class="w-4 h-4 text-muted-foreground"
        />
        <Input
          ref="inlineInput"
          v-model="inlineCreateName"
          class="h-6 text-sm py-0 px-1"
          :placeholder="store.pendingCreate.type === 'directory' ? 'folder name' : 'file name'"
          @keydown.enter="confirmInlineCreate"
          @keydown.escape="cancelInlineCreate"
          @blur="handleInlineBlur"
          autofocus
        />
      </div>
      <FileTreeNode
        v-for="child in children"
        :key="child.path"
        :item="child"
        @select="$emit('select', $event)"
        @edit-file="$emit('edit-file', $event)"
        @create-file="$emit('create-file', $event)"
        @create-folder="$emit('create-folder', $event)"
        @rename="$emit('rename', $event)"
        @delete="$emit('delete', $event)"
        @drop-files="$emit('drop-files', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import type { FileItem } from "~/stores/FileManagerStore";
import { Folder, File, ChevronRight, FilePlus, FolderPlus, Pencil, PenLine, Trash2 } from "lucide-vue-next";
import { Input } from "@/components/ui/input";

const props = defineProps<{
  item: FileItem;
}>();

const emit = defineEmits<{
  select: [item: FileItem];
  'edit-file': [item: FileItem];
  'create-file': [item: FileItem];
  'create-folder': [item: FileItem];
  'rename': [item: FileItem];
  'delete': [item: FileItem];
  'drop-files': [data: { files: File[]; targetPath: string }];
}>();

const store = useFileManagerStore();
const contextMenuOpen = ref(false);
const isDragOver = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const inlineCreateName = ref("");
const inlineInput = ref<HTMLInputElement | null>(null);

// Watch for pending create to focus input
watch(
  () => store.pendingCreate,
  async (pending) => {
    if (pending?.parentPath === props.item.path) {
      inlineCreateName.value = "";
      await nextTick();
      inlineInput.value?.focus();
    }
  }
);

async function confirmInlineCreate() {
  if (inlineCreateName.value.trim()) {
    await store.confirmInlineCreate(inlineCreateName.value.trim());
  }
  inlineCreateName.value = "";
}

function cancelInlineCreate() {
  store.cancelInlineCreate();
  inlineCreateName.value = "";
}

function handleInlineBlur() {
  // Small delay to allow click events to fire first
  setTimeout(() => {
    if (store.pendingCreate?.parentPath === props.item.path) {
      if (inlineCreateName.value.trim()) {
        confirmInlineCreate();
      } else {
        cancelInlineCreate();
      }
    }
  }, 100);
}

function startCreateFile() {
  store.startInlineCreate(props.item.path, 'file');
}

function startCreateFolder() {
  store.startInlineCreate(props.item.path, 'directory');
}

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

function handleContextMenu(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  contextMenuPosition.value = { x: event.clientX, y: event.clientY };
  contextMenuOpen.value = true;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  isDragOver.value = false;

  if (!props.item.isDirectory || !event.dataTransfer?.files) return;

  const files = Array.from(event.dataTransfer.files);
  emit('drop-files', { files, targetPath: props.item.path });
}

function handleDragOver(event: DragEvent) {
  if (props.item.isDirectory) {
    event.preventDefault();
  }
}

function handleDragEnter(event: DragEvent) {
  if (props.item.isDirectory) {
    isDragOver.value = true;
  }
}

function handleDragLeave(event: DragEvent) {
  isDragOver.value = false;
}
</script>
