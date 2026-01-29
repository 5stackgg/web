import { ref, watch, nextTick } from "vue";
import type { FileItem } from "~/stores/FileManagerStore";
import { useFileManagerStore } from "~/stores/FileManagerStore";
import { useFileTreeUtilities } from "./useFileTreeUtilities";

/**
 * Composable for file tree interactions
 * Handles create, delete, rename, move, and file operations
 */
export function useFileTreeInteractions() {
  const store = useFileManagerStore();
  const {
    contextMenuOpen,
    contextMenuPosition,
    openContextMenu,
    closeContextMenu,
    dragCounter,
    handleDragEnter,
    handleDragLeave,
    resetDragState,
    focusInlineInput,
    handleInlineBlur,
  } = useFileTreeUtilities();

  // Drag state for the tree
  const treeDragOver = ref(false);

  // Context menu handlers
  function handleTreeContextMenu(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".file-tree-node")) {
      openContextMenu(event);
    }
  }

  function handleTreeDragEnter() {
    handleDragEnter();
    treeDragOver.value = true;
  }

  function handleTreeDragLeave() {
    handleDragLeave();
    if (dragCounter.value === 0) {
      treeDragOver.value = false;
    }
  }

  // File operations
  async function handleSelect(item: FileItem) {
    if (item.isDirectory) {
      store.navigateToPath(item.path);
    } else {
      store.openFile(item.path);
    }
  }

  async function handleEditFile(item: FileItem) {
    store.openFile(item.path);
  }

  async function handleDelete(item: FileItem) {
    await store.deleteItem(item.path);
  }

  async function handleDropFiles(data: { files: File[]; targetPath: string }) {
    await store.uploadFilesWithPaths(
      data.files.map((f) => ({ file: f, relativePath: f.name })),
      data.targetPath,
    );
  }

  async function handleMoveItem(data: {
    sourcePath: string;
    destPath: string;
  }) {
    await store.moveItem(data.sourcePath, data.destPath);
  }

  // Create operations
  function handleCreateFileInRoot() {
    store.startInlineCreate("", "file");
  }

  function handleCreateFolderInRoot() {
    store.startInlineCreate("", "directory");
  }

  function openUploadDialog() {
    // This would be handled by the parent component
  }

  function refresh() {
    void store.loadDirectory(store.currentPath);
  }

  return {
    // Store
    store,
    // Drag state
    treeDragOver,
    // Context menu
    contextMenuOpen,
    contextMenuPosition,
    handleTreeContextMenu,
    // Drag handlers
    handleTreeDragEnter,
    handleTreeDragLeave,
    // File operations
    handleSelect,
    handleEditFile,
    handleDelete,
    handleDropFiles,
    handleMoveItem,
    // Create operations
    handleCreateFileInRoot,
    handleCreateFolderInRoot,
    openUploadDialog,
    refresh,
  };
}
