import { ref, computed } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import {
  generateQuery,
  generateMutation,
  generateSubscription,
} from "~/graphql/graphqlGen";
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

  // Enhanced upload tracking
  const uploadBatch = ref<{
    totalFiles: number;
    completedFiles: number;
    totalBytes: number;
    uploadedBytes: number;
    currentFile: string | null;
    isUploading: boolean;
    failedFiles: string[];
    cancelRequested: boolean;
  }>({
    totalFiles: 0,
    completedFiles: 0,
    totalBytes: 0,
    uploadedBytes: 0,
    currentFile: null,
    isUploading: false,
    failedFiles: [],
    cancelRequested: false,
  });
  const activeXHRRequests = ref<Map<string, XMLHttpRequest>>(new Map());
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const expandedPaths = ref<Set<string>>(new Set([""]));

  // Editor state
  const openFiles = ref<
    Map<string, { content: string; originalContent: string; isDirty: boolean }>
  >(new Map());
  const activeFilePath = ref<string | null>(null);

  // Inline create state (VS Code style)
  const pendingCreate = ref<{
    parentPath: string;
    type: "file" | "directory";
  } | null>(null);

  // Inline rename state (VS Code style)
  const pendingRename = ref<{ path: string; currentName: string } | null>(null);

  // Computed
  const currentDirectoryItems = computed(
    () => fileTree.value.get(currentPath.value) || [],
  );
  const rootItems = computed(() => fileTree.value.get("") || []);
  const isCustomPlugins = computed(() => !serverId.value);
  const activeFile = computed(() =>
    activeFilePath.value ? openFiles.value.get(activeFilePath.value) : null,
  );
  const hasUnsavedChanges = computed(() => {
    for (const file of openFiles.value.values()) {
      if (file.isDirty) return true;
    }
    return false;
  });

  const uploadOverallProgress = computed(() => {
    if (uploadBatch.value.totalBytes === 0) return 0;
    return Math.min(
      100,
      (uploadBatch.value.uploadedBytes / uploadBatch.value.totalBytes) * 100,
    );
  });

  function resetUploadBatch() {
    uploadBatch.value = {
      totalFiles: 0,
      completedFiles: 0,
      totalBytes: 0,
      uploadedBytes: 0,
      currentFile: null,
      isUploading: false,
      failedFiles: [],
      cancelRequested: false,
    };
    uploadProgress.value.clear();
    activeXHRRequests.value.clear();
  }

  function cancelUpload() {
    uploadBatch.value.cancelRequested = true;

    // Abort all active XHR requests
    for (const xhr of activeXHRRequests.value.values()) {
      xhr.abort();
    }

    activeXHRRequests.value.clear();
    uploadProgress.value.clear();
    uploadBatch.value.isUploading = false;
    uploadBatch.value.currentFile = null;
  }

  function startUploadBatch(files: { file: File; relativePath: string }[]) {
    const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0);
    uploadBatch.value = {
      totalFiles: files.length,
      completedFiles: 0,
      totalBytes,
      uploadedBytes: 0,
      currentFile: null,
      isUploading: true,
      failedFiles: [],
    };
  }

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

  async function readFile(
    filePath: string,
  ): Promise<FileContentResponse | null> {
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

      // Calculate parent directory of the deleted item
      const pathParts = path.split("/");
      pathParts.pop();
      const parentPath = pathParts.join("/");

      // If currentPath is the deleted path or inside it, navigate to parent
      if (
        currentPath.value === path ||
        currentPath.value.startsWith(path + "/")
      ) {
        currentPath.value = parentPath;
      }

      // Close any open files that were inside the deleted path
      for (const filePath of openFiles.value.keys()) {
        if (filePath === path || filePath.startsWith(path + "/")) {
          openFiles.value.delete(filePath);
        }
      }

      // Update activeFilePath if the active file was deleted
      if (
        activeFilePath.value &&
        (activeFilePath.value === path ||
          activeFilePath.value.startsWith(path + "/"))
      ) {
        const openPaths = Array.from(openFiles.value.keys());
        activeFilePath.value =
          openPaths.length > 0 ? openPaths[openPaths.length - 1] : null;
      }

      // Remove deleted paths from expandedPaths
      for (const expandedPath of expandedPaths.value) {
        if (expandedPath === path || expandedPath.startsWith(path + "/")) {
          expandedPaths.value.delete(expandedPath);
        }
      }

      // Remove deleted paths from fileTree cache
      for (const treePath of fileTree.value.keys()) {
        if (treePath === path || treePath.startsWith(path + "/")) {
          fileTree.value.delete(treePath);
        }
      }

      // Refresh the parent directory
      await loadDirectory(parentPath);
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
      // Check if upload was cancelled
      if (uploadBatch.value.cancelRequested) {
        break;
      }

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
        let apiDomain = config.public.apiDomain;
        // Ensure apiDomain has protocol
        if (
          apiDomain &&
          !apiDomain.startsWith("http://") &&
          !apiDomain.startsWith("https://")
        ) {
          apiDomain = `https://${apiDomain}`;
        }
        const apiUrl = `${apiDomain}/file-manager/upload/${nodeId.value}${serverPath}`;

        const xhr = new XMLHttpRequest();

        // Store XHR reference for cancellation
        activeXHRRequests.value.set(file.name, xhr);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.min(100, (e.loaded / e.total) * 100);
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
          xhr.onabort = () => reject(new Error("Upload cancelled"));
          xhr.open("POST", apiUrl);
          xhr.send(formData);
        });

        uploadProgress.value.delete(file.name);
        activeXHRRequests.value.delete(file.name);
      } catch (err: any) {
        uploadProgress.value.delete(file.name);
        activeXHRRequests.value.delete(file.name);

        // Don't throw error if upload was cancelled
        if (!uploadBatch.value.cancelRequested) {
          error.value = err.message || `Failed to upload ${file.name}`;
          console.error("Error uploading file:", err);
          throw err;
        }
      }
    }

    await loadDirectory(currentPath.value);
  }

  async function uploadFilesWithPaths(
    fileEntries: { file: File; relativePath: string }[],
    targetPath: string,
  ) {
    if (!nodeId.value) return;

    // Start batch tracking
    startUploadBatch(fileEntries);
    let bytesUploadedSoFar = 0;
    const completedFileSizes = new Map<string, number>();

    // Collect unique directories that need to be created
    const dirsToCreate = new Set<string>();
    for (const { relativePath } of fileEntries) {
      const parts = relativePath.split("/");
      // Remove the file name, keep only directories
      parts.pop();
      let currentDir = targetPath;
      for (const part of parts) {
        currentDir = currentDir ? `${currentDir}/${part}` : part;
        dirsToCreate.add(currentDir);
      }
    }

    // Create directories in order (shorter paths first)
    const sortedDirs = Array.from(dirsToCreate).sort(
      (a, b) => a.length - b.length,
    );
    for (const dirPath of sortedDirs) {
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
      } catch (err) {
        // Directory might already exist, continue
        console.log("Directory may already exist:", dirPath);
      }
    }

    // Upload files with concurrency limit of 10
    const CONCURRENCY_LIMIT = 10;
    const uploadQueue = [...fileEntries];
    const activeUploads = new Set<Promise<void>>();

    const uploadFile = async (entry: { file: File; relativePath: string }) => {
      const { file, relativePath } = entry;
      const filePath = targetPath
        ? `${targetPath}/${relativePath}`
        : relativePath;

      // Check if upload was cancelled before starting
      if (uploadBatch.value.cancelRequested) {
        return;
      }

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("filePath", filePath);
        formData.append("userId", useAuthStore().me?.steam_id || "");

        const config = useRuntimeConfig();
        const serverPath = serverId.value ? `/${serverId.value}` : "";
        let apiDomain = config.public.apiDomain;
        if (
          apiDomain &&
          !apiDomain.startsWith("http://") &&
          !apiDomain.startsWith("https://")
        ) {
          apiDomain = `https://${apiDomain}`;
        }
        const apiUrl = `${apiDomain}/file-manager/upload/${nodeId.value}${serverPath}`;

        const xhr = new XMLHttpRequest();
        const fileSize = file.size;

        // Store XHR reference for cancellation
        activeXHRRequests.value.set(relativePath, xhr);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const fileProgress = Math.min(100, (e.loaded / e.total) * 100);
            uploadProgress.value.set(relativePath, fileProgress);
            // Calculate total uploaded bytes across all completed and in-progress files
            let totalUploaded = 0;
            for (const size of completedFileSizes.values()) {
              totalUploaded += size;
            }
            totalUploaded += e.loaded;
            uploadBatch.value.uploadedBytes = totalUploaded;
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
          xhr.onabort = () => reject(new Error("Upload cancelled"));
          xhr.open("POST", apiUrl);
          xhr.send(formData);
        });

        // File completed successfully
        completedFileSizes.set(relativePath, fileSize);
        uploadBatch.value.completedFiles++;
        uploadProgress.value.delete(relativePath);
        activeXHRRequests.value.delete(relativePath);
      } catch (err: any) {
        uploadProgress.value.delete(relativePath);
        activeXHRRequests.value.delete(relativePath);

        // Don't mark as failed if it was cancelled
        if (!uploadBatch.value.cancelRequested) {
          uploadBatch.value.failedFiles.push(relativePath);
          error.value = err.message || `Failed to upload ${relativePath}`;
          console.error("Error uploading file:", err);
        }
        // Continue with other files instead of throwing
      }
    };

    // Process uploads with concurrency limit
    while (uploadQueue.length > 0 || activeUploads.size > 0) {
      // Check if upload was cancelled
      if (uploadBatch.value.cancelRequested) {
        // Wait for active uploads to finish aborting
        await Promise.allSettled(activeUploads);
        break;
      }

      // Start new uploads up to the concurrency limit
      while (
        uploadQueue.length > 0 &&
        activeUploads.size < CONCURRENCY_LIMIT &&
        !uploadBatch.value.cancelRequested
      ) {
        const entry = uploadQueue.shift()!;
        uploadBatch.value.currentFile = entry.relativePath;

        const uploadPromise = uploadFile(entry).finally(() => {
          activeUploads.delete(uploadPromise);
        });

        activeUploads.add(uploadPromise);
      }

      // Wait for at least one upload to complete before continuing
      if (activeUploads.size > 0) {
        await Promise.race(activeUploads);
      }
    }

    // Upload complete
    uploadBatch.value.isUploading = false;
    uploadBatch.value.currentFile = null;

    // Reload directories that were affected
    await loadDirectory(targetPath || "");
    for (const dir of sortedDirs) {
      if (fileTree.value.has(dir)) {
        await loadDirectory(dir);
      }
    }

    // Reset batch after a delay to show completion state
    setTimeout(() => {
      if (!uploadBatch.value.isUploading) {
        resetUploadBatch();
      }
    }, 3000);
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

  async function createFile(
    fileName: string,
    content: string = "",
  ): Promise<boolean> {
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
    if (
      dirPath === currentPath.value ||
      operation.path.startsWith(currentPath.value)
    ) {
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
      activeFilePath.value =
        openPaths.length > 0 ? openPaths[openPaths.length - 1] : null;
    }
  }

  function setActiveFile(filePath: string) {
    if (openFiles.value.has(filePath)) {
      activeFilePath.value = filePath;
    }
  }

  function startInlineCreate(parentPath: string, type: "file" | "directory") {
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
      if (type === "directory") {
        // Temporarily set current path for directory creation
        const originalPath = currentPath.value;
        currentPath.value = parentPath;
        await createDirectory(name);
        currentPath.value = originalPath;
      } else {
        await saveFile(fullPath, "");
        // Open the new file in editor
        await openFile(fullPath);
      }
      pendingCreate.value = null;
      return true;
    } catch (err) {
      console.error("Failed to create:", err);
      pendingCreate.value = null;
      return false;
    }
  }

  function startInlineRename(path: string, currentName: string) {
    pendingRename.value = { path, currentName };
  }

  function cancelInlineRename() {
    pendingRename.value = null;
  }

  async function confirmInlineRename(newName: string): Promise<boolean> {
    if (!pendingRename.value || !newName.trim()) {
      pendingRename.value = null;
      return false;
    }

    const { path, currentName } = pendingRename.value;

    // Don't rename if name hasn't changed
    if (newName.trim() === currentName) {
      pendingRename.value = null;
      return true;
    }

    try {
      await renameItem(path, newName.trim());
      pendingRename.value = null;
      return true;
    } catch (err) {
      console.error("Failed to rename:", err);
      pendingRename.value = null;
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
    uploadBatch,
    isLoading,
    error,
    expandedPaths,
    openFiles,
    activeFilePath,
    pendingCreate,
    pendingRename,

    // Computed
    currentDirectoryItems,
    rootItems,
    isCustomPlugins,
    activeFile,
    hasUnsavedChanges,
    uploadOverallProgress,

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
    uploadFilesWithPaths,
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
    startInlineRename,
    cancelInlineRename,
    confirmInlineRename,
    resetUploadBatch,
    cancelUpload,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useFileManagerStore, import.meta.hot));
}
