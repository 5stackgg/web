/**
 * Composable for handling file uploads with directory support
 * Provides utilities to read files and directories recursively
 */

// Helper to read a FileSystemEntry as a File
function readEntryAsFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

// Helper to read all entries from a directory
function readDirectoryEntries(
  reader: FileSystemDirectoryReader,
): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

// Recursively read all files from a FileSystemEntry (file or directory)
async function readEntriesRecursively(
  entry: FileSystemEntry,
  basePath: string = "",
): Promise<{ file: File; relativePath: string }[]> {
  const results: { file: File; relativePath: string }[] = [];

  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await readEntryAsFile(fileEntry);
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    results.push({ file, relativePath });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const newBasePath = basePath ? `${basePath}/${entry.name}` : entry.name;

    // Read all entries (readEntries may not return all at once)
    let entries: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];
    do {
      batch = await readDirectoryEntries(reader);
      entries = entries.concat(batch);
    } while (batch.length > 0);

    // Process all entries recursively
    for (const childEntry of entries) {
      const childResults = await readEntriesRecursively(
        childEntry,
        newBasePath,
      );
      results.push(...childResults);
    }
  }

  return results;
}

export function useFileUpload() {
  /**
   * Process files from a drop event or file input
   * Handles both files and directories recursively
   */
  async function processFiles(
    items: DataTransferItemList | FileList,
  ): Promise<{ file: File; relativePath: string }[]> {
    const fileEntries: { file: File; relativePath: string }[] = [];

    // Check if it's a DataTransferItemList (drag & drop)
    if ("length" in items && items.length > 0) {
      // Try to use webkitGetAsEntry for better directory support
      const firstItem = items[0];
      if ("webkitGetAsEntry" in firstItem) {
        // This is DataTransferItemList with drag & drop
        const itemArray = Array.from(items as DataTransferItemList);
        for (const item of itemArray) {
          if (item.kind !== "file") continue;

          const entry = item.webkitGetAsEntry();
          if (entry) {
            const results = await readEntriesRecursively(entry);
            fileEntries.push(...results);
          }
        }
      } else {
        // This is FileList from input element
        const fileArray = Array.from(items as FileList);
        for (const file of fileArray) {
          fileEntries.push({
            file,
            relativePath: file.name,
          });
        }
      }
    }

    return fileEntries;
  }

  /**
   * Process files from a file input change event
   * Note: File inputs don't support webkitGetAsEntry, so directories won't be recursive
   */
  async function processFileInput(
    files: FileList,
  ): Promise<{ file: File; relativePath: string }[]> {
    const fileArray = Array.from(files);
    return fileArray.map((file) => ({
      file,
      // For file inputs with webkitdirectory, use webkitRelativePath if available
      relativePath: (file as any).webkitRelativePath || file.name,
    }));
  }

  /**
   * Process files from a drag & drop event
   * Uses webkitGetAsEntry for proper directory support
   */
  async function processDropEvent(
    dataTransfer: DataTransfer,
  ): Promise<{ file: File; relativePath: string }[]> {
    if (!dataTransfer.items) {
      // Fallback to files if items is not available
      return processFileInput(dataTransfer.files);
    }

    return processFiles(dataTransfer.items);
  }

  return {
    processFiles,
    processFileInput,
    processDropEvent,
  };
}
