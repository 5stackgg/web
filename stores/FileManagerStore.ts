import { ref, computed } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { generateQuery, generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import type { GraphQLTypes } from "~/generated/zeus";

export interface FileItem {
  name: string;
  path: string;
  type: string;
  size: number;
  modified: string;
  isDirectory: boolean;
}

export interface FileListResponse {
  items: FileItem[];
  currentPath: string;
}

export interface FileContentResponse {
  content: string;
  path: string;
  size: number;
}

export const useFileManagerStore = defineStore("fileManager", () => {
  // State
  const nodeId = ref<string | null>(null);
  const serverId = ref<string | null>(null);
  const currentPath = ref<string>("");
  const fileTree = ref<Map<string, FileItem[]>>(new Map());
  const selectedItem = ref<FileItem | null>(null);
  const uploadProgress = ref<Map<string, number>>(new Map());
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const expandedPaths = ref<Set<string>>(new Set([""]));

  // Editor state
  const openFiles = ref<Map<string, { content: string; originalContent: string; isDirty: boolean }>>(new Map());
  const activeFilePath = ref<string | null>(null);

  // Inline create state (VS Code style)
  const pendingCreate = ref<{ parentPath: string; type: 'file' | 'directory' } | null>(null);

  // Computed
  const currentDirectoryItems = computed(
    () => fileTree.value.get(currentPath.value) || []
  );
  const rootItems = computed(() => fileTree.value.get("") || []);
  const isCustomPlugins = computed(() => !serverId.value);
  const activeFile = computed(() => activeFilePath.value ? openFiles.value.get(activeFilePath.value) : null);
  const hasUnsavedChanges = computed(() => {
    for (const file of openFiles.value.values()) {
      if (file.isDirty) return true;
    }
    return false;
  });

  // Actions
  async function initialize(nId: string, sId?: string) {
    nodeId.value = nId;
    serverId.value = sId || null;
    currentPath.value = "";
    fileTree.value.clear();
    expandedPaths.value.clear();
    expandedPaths.value.add("");

    await loadDirectory("");
    subscribeToFileOperations();
  }

  async function loadDirectory(path: string) {
    if (!nodeId.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await getGraphqlClient().query({
        query: generateQuery({
          listServerFiles: [
            {
              node_id: nodeId.value,
              ...(serverId.value && { server_id: serverId.value }),
              path: path || undefined,
            },
            {
              items: {
                name: true,
                path: true,
                type: true,
                size: true,
                modified: true,
                isDirectory: true,
              },
              currentPath: true,
            },
          ],
        }),
        fetchPolicy: "network-only",
      });

      if (response.data.listServerFiles) {
        fileTree.value.set(path, response.data.listServerFiles.items);
      }
    } catch (err: any) {
      error.value = err.message || "Failed to load directory";
      console.error("Error loading directory:", err);
    } finally {
      isLoading.value = false;
    }
  }

  async function readFile(filePath: string): Promise<FileContentResponse | null> {
    if (!nodeId.value) return null;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await getGraphqlClient().query({
        query: generateQuery({
          readServerFile: [
            {
              node_id: nodeId.value,
              ...(serverId.value && { server_id: serverId.value }),
              file_path: filePath,
            },
            {
              content: true,
              path: true,
              size: true,
            },
          ],
        }),
        fetchPolicy: "network-only",
      });

      return response.data.readServerFile;
    } catch (err: any) {
      error.value = err.message || "Failed to read file";
      console.error("Error reading file:", err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function createDirectory(dirName: string) {
    if (!nodeId.value) return;

    isLoading.value = true;
    error.value = null;

    const dirPath = currentPath.value
      ? `${currentPath.value}/${dirName}`
      : dirName;

    try {
      await getGraphqlClient().mutate({
        mutation: generateMutation({
          createServerDirectory: [
            {
              node_id: nodeId.value,
              ...(serverId.value && { server_id: serverId.value }),
              dir_path: dirPath,
            },
            {
              success: true,
            },
          ],
        }),
      });

      await loadDirectory(currentPath.value);
    } catch (err: any) {
      error.value = err.message || "Failed to create directory";
      console.error("Error creating directory:", err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteItem(path: string) {
    if (!nodeId.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      await getGraphqlClient().mutate({
        mutation: generateMutation({
          deleteServerItem: [
            {
              node_id: nodeId.value,
              ...(serverId.value && { server_id: serverId.value }),
              path,
            },
            {
              success: true,
            },
          ],
        }),
      });

      await loadDirectory(currentPath.value);
    } catch (err: any) {
      error.value = err.message || "Failed to delete item";
      console.error("Error deleting item:", err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function renameItem(oldPath: string, newName: string) {
    if (!nodeId.value) return;

    isLoading.value = true;
    error.value = null;

    const pathParts = oldPath.split("/");
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join("/");

    try {
      await getGraphqlClient().mutate({
        mutation: generateMutation({
          renameServerItem: [
            {
              node_id: nodeId.value,
              ...(serverId.value && { server_id: serverId.value }),
              old_path: oldPath,
              new_path: newPath,
            },
            {
              success: true,
            },
          ],
        }),
      });

      await loadDirectory(currentPath.value);
    } catch (err: any) {
      error.value = err.message || "Failed to rename item";
      console.error("Error renaming item:", err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function moveItem(sourcePath: string, destPath: string) {
    if (!nodeId.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      await getGraphqlClient().mutate({
        mutation: generateMutation({
          moveServerItem: [
            {
              node_id: nodeId.value,
              ...(serverId.value && { server_id: serverId.value }),
              source_path: sourcePath,
              dest_path: destPath,
            },
            {
              success: true,
            },
          ],
        }),
      });

      const sourceDir = sourcePath.split("/").slice(0, -1).join("/");
      await loadDirectory(sourceDir);
      await loadDirectory(destPath);
    } catch (err: any) {
      error.value = err.message || "Failed to move item";
      console.error("Error moving item:", err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function uploadFiles(files: File[]) {
    if (!nodeId.value) return;

    for (const file of files) {
      const filePath = currentPath.value
        ? `${currentPath.value}/${file.name}`
        : file.name;

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("filePath", filePath);
        formData.append("userId", useAuthStore().me?.steam_id || "");

        const config = useRuntimeConfig();
        const serverPath = serverId.value ? `/${serverId.value}` : "";
        const apiUrl = `${config.public.apiDomain}/file-manager/upload/${nodeId.value}${serverPath}`;

        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            uploadProgress.value.set(file.name, progress);
          }
        };

        await new Promise((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.response);
            } else {
              reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
          };
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.open("POST", apiUrl);
          xhr.send(formData);
        });

        uploadProgress.value.delete(file.name);
      } catch (err: any) {
        uploadProgress.value.delete(file.name);
        error.value = err.message || `Failed to upload ${file.name}`;
        console.error("Error uploading file:", err);
        throw err;
      }
    }

    await loadDirectory(currentPath.value);
  }

  async function saveFile(filePath: string, content: string): Promise<boolean> {
    if (!nodeId.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      await getGraphqlClient().mutate({
        mutation: generateMutation({
          writeServerFile: [
            {
              node_id: nodeId.value,
              ...(serverId.value && { server_id: serverId.value }),
              file_path: filePath,
              content,
            },
            {
              success: true,
            },
          ],
        }),
      });

      // Reload the directory containing the file
      const pathParts = filePath.split("/");
      pathParts.pop();
      const dirPath = pathParts.join("/");
      await loadDirectory(dirPath || currentPath.value);

      return true;
    } catch (err: any) {
      error.value = err.message || "Failed to save file";
      console.error("Error saving file:", err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function createFile(fileName: string, content: string = ""): Promise<boolean> {
    if (!nodeId.value) return false;

    const filePath = currentPath.value
      ? `${currentPath.value}/${fileName}`
      : fileName;

    return await saveFile(filePath, content);
  }

  function subscribeToFileOperations() {
    if (!nodeId.value) return;

    const whereClause: any = {
      node_id: { _eq: nodeId.value },
    };

    if (serverId.value) {
      whereClause.server_id = { _eq: serverId.value };
    } else {
      whereClause.server_id = { _is_null: true };
    }

    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        file_operations_log: [
          {
            where: whereClause,
            order_by: [{ created_at: "desc" as const }],
            limit: 50,
          },
          {
            id: true,
            operation: true,
            path: true,
            details: true,
            created_at: true,
          },
        ],
      }),
    });

    subscription.subscribe({
      next: ({ data }) => {
        if (data?.file_operations_log && data.file_operations_log.length > 0) {
          const operation = data.file_operations_log[0];
          handleFileOperation(operation);
        }
      },
      error: (err) => {
        console.error("Subscription error:", err);
      },
    });
  }

  function handleFileOperation(operation: any) {
    // Reload the affected directory
    const pathParts = operation.path.split("/");
    pathParts.pop(); // Remove filename
    const dirPath = pathParts.join("/");

    if (fileTree.value.has(dirPath)) {
      void loadDirectory(dirPath);
    }

    // Also reload current directory if it matches
    if (dirPath === currentPath.value || operation.path.startsWith(currentPath.value)) {
      void loadDirectory(currentPath.value);
    }
  }

  function toggleExpand(path: string) {
    if (expandedPaths.value.has(path)) {
      expandedPaths.value.delete(path);
    } else {
      expandedPaths.value.add(path);
      void loadDirectory(path);
    }
  }

  function navigateToPath(path: string) {
    currentPath.value = path;
    if (!fileTree.value.has(path)) {
      void loadDirectory(path);
    }
  }

  function selectItem(item: FileItem) {
    selectedItem.value = item;
    if (item.isDirectory) {
      navigateToPath(item.path);
    }
  }

  function clearError() {
    error.value = null;
  }

  async function openFile(filePath: string) {
    // Check if file is already open
    if (openFiles.value.has(filePath)) {
      activeFilePath.value = filePath;
      return true;
    }

    // Load file content
    const response = await readFile(filePath);
    if (response) {
      openFiles.value.set(filePath, {
        content: response.content,
        originalContent: response.content,
        isDirty: false,
      });
      activeFilePath.value = filePath;
      return true;
    }
    return false;
  }

  function updateFileContent(filePath: string, content: string) {
    const file = openFiles.value.get(filePath);
    if (file) {
      file.content = content;
      file.isDirty = content !== file.originalContent;
    }
  }

  async function saveActiveFile(): Promise<boolean> {
    if (!activeFilePath.value) return false;

    const file = openFiles.value.get(activeFilePath.value);
    if (!file) return false;

    const success = await saveFile(activeFilePath.value, file.content);
    if (success) {
      file.originalContent = file.content;
      file.isDirty = false;
    }
    return success;
  }

  function closeFile(filePath: string) {
    openFiles.value.delete(filePath);

    // If closing the active file, switch to another open file or null
    if (activeFilePath.value === filePath) {
      const openPaths = Array.from(openFiles.value.keys());
      activeFilePath.value = openPaths.length > 0 ? openPaths[openPaths.length - 1] : null;
    }
  }

  function setActiveFile(filePath: string) {
    if (openFiles.value.has(filePath)) {
      activeFilePath.value = filePath;
    }
  }

  function startInlineCreate(parentPath: string, type: 'file' | 'directory') {
    pendingCreate.value = { parentPath, type };
    // Make sure parent is expanded
    if (parentPath && !expandedPaths.value.has(parentPath)) {
      expandedPaths.value.add(parentPath);
      void loadDirectory(parentPath);
    }
  }

  function cancelInlineCreate() {
    pendingCreate.value = null;
  }

  async function confirmInlineCreate(name: string): Promise<boolean> {
    if (!pendingCreate.value || !name.trim()) {
      pendingCreate.value = null;
      return false;
    }

    const { parentPath, type } = pendingCreate.value;
    const fullPath = parentPath ? `${parentPath}/${name}` : name;

    try {
      if (type === 'directory') {
        // Temporarily set current path for directory creation
        const originalPath = currentPath.value;
        currentPath.value = parentPath;
        await createDirectory(name);
        currentPath.value = originalPath;
      } else {
        await saveFile(fullPath, '');
        // Open the new file in editor
        await openFile(fullPath);
      }
      pendingCreate.value = null;
      return true;
    } catch (err) {
      console.error('Failed to create:', err);
      pendingCreate.value = null;
      return false;
    }
  }

  return {
    // State
    nodeId,
    serverId,
    currentPath,
    fileTree,
    selectedItem,
    uploadProgress,
    isLoading,
    error,
    expandedPaths,
    openFiles,
    activeFilePath,
    pendingCreate,

    // Computed
    currentDirectoryItems,
    rootItems,
    isCustomPlugins,
    activeFile,
    hasUnsavedChanges,

    // Actions
    initialize,
    loadDirectory,
    readFile,
    createDirectory,
    createFile,
    saveFile,
    deleteItem,
    renameItem,
    moveItem,
    uploadFiles,
    toggleExpand,
    navigateToPath,
    selectItem,
    clearError,
    openFile,
    updateFileContent,
    saveActiveFile,
    closeFile,
    setActiveFile,
    startInlineCreate,
    cancelInlineCreate,
    confirmInlineCreate,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useFileManagerStore, import.meta.hot)
  );
}
