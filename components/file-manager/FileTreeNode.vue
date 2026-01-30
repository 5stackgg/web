<template>
  <div class="file-tree-node" @contextmenu="handleContextMenu">
    <div
      class="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded-md cursor-pointer transition-opacity"
      :class="{
        'bg-accent': isSelected,
        'bg-primary/20 border border-primary': isDragOver && item.isDirectory,
        'opacity-50': isDragging,
      }"
      draggable="true"
      @click="handleClick"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
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

      <!-- Inline rename input -->
      <Input
        v-if="isRenaming"
        ref="renameInput"
        v-model="renameName"
        class="h-6 text-sm py-0 px-1 flex-1"
        @keydown.enter="confirmRename"
        @keydown.escape="cancelRename"
        @blur="handleRenameBlur"
        @click.stop
        autofocus
      />
      <span v-else class="text-sm truncate">{{ item.name }}</span>
    </div>

    <DropdownMenu v-model:open="contextMenuOpen">
      <DropdownMenuTrigger as-child>
        <div
          class="fixed w-0 h-0"
          :style="{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
          }"
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
        <DropdownMenuItem @click="$emit('rename-item', item)">
          <PenLine class="mr-2 h-4 w-4" />
          <span>Rename</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          @click="$emit('delete', item)"
          class="text-destructive"
        >
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
          :placeholder="
            store.pendingCreate.type === 'directory'
              ? 'folder name'
              : 'file name'
          "
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
        @delete="$emit('delete', $event)"
        @rename-item="$emit('rename-item', $event)"
        @drop-files="$emit('drop-files', $event)"
        @move-item="$emit('move-item', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import type { FileItem } from "~/stores/FileManagerStore";
import {
  Folder,
  File,
  ChevronRight,
  FilePlus,
  FolderPlus,
  Pencil,
  PenLine,
  Trash2,
} from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFileTreeUtilities } from "./useFileTreeUtilities";

const props = defineProps<{
  item: FileItem;
}>();

const emit = defineEmits<{
  select: [item: FileItem];
  "edit-file": [item: FileItem];
  "create-file": [item: FileItem];
  "create-folder": [item: FileItem];
  delete: [item: FileItem];
  "drop-files": [data: { files: File[]; targetPath: string }];
  "move-item": [data: { sourcePath: string; destPath: string }];
  "open-item": [item: FileItem];
  "rename-item": [item: FileItem];
}>();

const store = useFileManagerStore();

// Use composable for common utilities
const {
  contextMenuOpen,
  contextMenuPosition,
  openContextMenu,
  closeContextMenu,
  dragCounter: dragCounterValue,
  handleDragEnter: handleDragEnterWrapper,
  handleDragLeave: handleDragLeaveWrapper,
  resetDragState,
  focusInlineInput,
  handleInlineBlur,
} = useFileTreeUtilities();

// Wrapper functions that accept event parameters
function handleDragEnter(event: DragEvent) {
  handleDragEnterWrapper(event);
  isDragOver.value = true;
}

function handleDragLeave(event: DragEvent) {
  handleDragLeaveWrapper(event);
  if (dragCounterValue.value === 0) {
    isDragOver.value = false;
  }
}

const isDragOver = ref(false);
const isDragging = ref(false);
const inlineCreateName = ref("");
const inlineInput = ref<InstanceType<typeof Input> | null>(null);
const dragCounter = dragCounterValue;

// Inline rename state
const renameName = ref("");
const renameInput = ref<InstanceType<typeof Input> | null>(null);

// Computed for rename state
const isRenaming = computed(
  () => store.pendingRename?.path === props.item.path,
);

// Watch for pending create to focus input
watch(
  () => store.pendingCreate,
  async (pending) => {
    if (pending?.parentPath === props.item.path) {
      inlineCreateName.value = "";
      await nextTick();
      focusInlineInput(inlineInput);
    }
  },
);

// Watch for pending rename to focus input
watch(
  () => store.pendingRename,
  async (pending) => {
    if (pending?.path === props.item.path) {
      renameName.value = pending.currentName;
      await nextTick();
      focusInlineInput(renameInput);
    }
  },
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

async function confirmRename() {
  if (renameName.value.trim()) {
    await store.confirmInlineRename(renameName.value.trim());
  }
  renameName.value = "";
}

function cancelRename() {
  store.cancelInlineRename();
  renameName.value = "";
}

function handleRenameBlur() {
  handleInlineBlur(
    () => confirmRename(),
    () => cancelRename(),
    renameName.value,
    props.item.name,
  );
}

function startCreateFile() {
  store.startInlineCreate(props.item.path, "file");
}

function startCreateFolder() {
  store.startInlineCreate(props.item.path, "directory");
}

const expanded = computed(() => store.expandedPaths.has(props.item.path));

const children = computed(() => {
  if (!props.item.isDirectory) return [];
  return store.fileTree.get(props.item.path) || [];
});

const isSelected = computed(() => store.selectedItem?.path === props.item.path);

function toggleExpand() {
  store.toggleExpand(props.item.path);
}

function handleClick() {
  // If it's a directory, toggle expand instead of selecting
  if (props.item.isDirectory) {
    store.toggleExpand(props.item.path);
    return;
  }
  emit("select", props.item);
  store.selectItem(props.item);
}

function handleContextMenu(event: MouseEvent) {
  openContextMenu(event);
}

function handleDragStart(event: DragEvent) {
  if (!event.dataTransfer) return;

  // Set the data for internal move operations
  event.dataTransfer.setData(
    "application/x-file-manager-path",
    props.item.path,
  );
  event.dataTransfer.setData("text/plain", props.item.name);
  event.dataTransfer.effectAllowed = "move";
  isDragging.value = true;
}

function handleDragEnd(event: DragEvent) {
  // Clean up any drag state
  isDragging.value = false;
  isDragOver.value = false;
  resetDragState();
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  resetDragState();
  isDragOver.value = false;

  if (!props.item.isDirectory || !event.dataTransfer) return;

  // Check if this is an internal move (dragging from within the file tree)
  const sourcePath = event.dataTransfer.getData(
    "application/x-file-manager-path",
  );

  if (sourcePath) {
    // Internal move - don't allow dropping on itself or its children
    if (
      sourcePath === props.item.path ||
      props.item.path.startsWith(sourcePath + "/")
    ) {
      return;
    }

    // Don't move if already in this directory
    const sourceParent = sourcePath.split("/").slice(0, -1).join("/");
    if (sourceParent === props.item.path) {
      return;
    }

    emit("move-item", { sourcePath, destPath: props.item.path });
    return;
  }

  // External file drop
  if (!event.dataTransfer.files?.length) return;

  const files = Array.from(event.dataTransfer.files);
  emit("drop-files", { files, targetPath: props.item.path });
}

function handleDragOver(event: DragEvent) {
  if (props.item.isDirectory && event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}
</script>
