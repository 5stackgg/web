<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";
import { Upload, FileCheck2, FileWarning, X } from "lucide-vue-next";

const { t } = useI18n();

const uploadingDemo = ref(false);
const uploadProgress = ref(0);
const uploadedFile = ref<{ name: string; size: number } | null>(null);
const uploadResult = ref<{
  status: "success" | "error";
  message: string;
} | null>(null);
const isDragging = ref(false);
const apiDomain = useRuntimeConfig().public.apiDomain;
const fileInput = ref<HTMLInputElement | null>(null);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function triggerFileInput() {
  if (uploadingDemo.value) return;
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) void uploadDemo(file);
  target.value = "";
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  if (uploadingDemo.value) return;
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".dem")) {
    toast({
      title: t("pages.settings.linked_accounts.toast_wrong_file_type"),
      description: t("pages.settings.linked_accounts.toast_drop_dem_file"),
      variant: "destructive",
    });
    return;
  }
  void uploadDemo(file);
}

function clearUpload() {
  uploadedFile.value = null;
  uploadResult.value = null;
  uploadProgress.value = 0;
}

function putChunk(
  url: string,
  chunk: Blob,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`chunk upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(chunk);
  });
}

async function uploadDemo(file: File) {
  uploadingDemo.value = true;
  uploadProgress.value = 0;
  uploadedFile.value = { name: file.name, size: file.size };
  uploadResult.value = null;

  let uploadId: string | null = null;
  let key: string | null = null;

  try {
    const magic = [0x50, 0x42, 0x44, 0x45, 0x4d, 0x53, 0x32, 0x00];
    const header = new Uint8Array(
      await file.slice(0, magic.length).arrayBuffer(),
    );
    if (header.length < magic.length || !magic.every((b, i) => header[i] === b)) {
      throw new Error(t("pages.settings.linked_accounts.error_invalid_demo"));
    }

    const initiate = await fetch(
      `https://${apiDomain}/steam-match-history/upload/initiate`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      },
    );
    if (!initiate.ok) {
      throw new Error(
        (await initiate.text()) || `could not start upload (${initiate.status})`,
      );
    }
    const session = (await initiate.json()) as {
      uploadId: string;
      key: string;
      chunkSize: number;
      parts: Array<{ partNumber: number; url: string }>;
    };
    uploadId = session.uploadId;
    key = session.key;

    let uploadedBytes = 0;
    for (const part of session.parts) {
      const start = (part.partNumber - 1) * session.chunkSize;
      const chunk = file.slice(start, start + session.chunkSize);
      await putChunk(part.url, chunk, (loaded) => {
        uploadProgress.value = Math.round(
          ((uploadedBytes + loaded) / file.size) * 100,
        );
      });
      uploadedBytes += chunk.size;
    }

    uploadProgress.value = 100;

    const complete = await fetch(
      `https://${apiDomain}/steam-match-history/upload/complete`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, key, fileName: file.name }),
      },
    );
    if (!complete.ok) {
      throw new Error(
        (await complete.text()) || `import failed (${complete.status})`,
      );
    }
    await complete.json();

    uploadResult.value = {
      status: "success",
      message: t("pages.settings.linked_accounts.upload_success_message"),
    };
    toast({
      title: t("pages.settings.linked_accounts.toast_demo_uploaded"),
      description: t(
        "pages.settings.linked_accounts.toast_demo_uploaded_description",
      ),
    });
  } catch (err) {
    const message = (err as Error).message;
    uploadResult.value = { status: "error", message };
    toast({
      title: t("pages.settings.linked_accounts.toast_upload_failed"),
      description: message,
      variant: "destructive",
    });
    if (uploadId && key) {
      void fetch(`https://${apiDomain}/steam-match-history/upload/abort`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId, key }),
      }).catch(() => {});
    }
  } finally {
    uploadingDemo.value = false;
  }
}
</script>

<template>
  <div class="grid gap-3">
    <div
      class="rounded-lg border-2 border-dashed transition-colors p-6 text-center"
      :class="[
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-border/80 hover:bg-accent/30',
        uploadingDemo ? 'cursor-progress opacity-80' : 'cursor-pointer',
      ]"
      role="button"
      tabindex="0"
      @click="triggerFileInput"
      @keydown.enter.prevent="triggerFileInput"
      @keydown.space.prevent="triggerFileInput"
      @drop="handleDrop"
      @dragover.prevent
      @dragenter.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
    >
      <Upload
        class="w-8 h-8 mx-auto mb-2"
        :class="isDragging ? 'text-primary' : 'text-muted-foreground'"
      />
      <p class="text-sm font-medium mb-1">
        <template v-if="isDragging">{{
          $t("pages.settings.linked_accounts.drop_to_upload")
        }}</template>
        <template v-else>{{
          $t("pages.settings.linked_accounts.click_to_choose")
        }}</template>
      </p>
      <p class="text-xs text-muted-foreground">
        {{ $t("pages.settings.linked_accounts.demo_files_only") }}
      </p>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".dem"
      :disabled="uploadingDemo"
      class="hidden"
      @change="handleFileSelect"
    />

    <div
      v-if="uploadedFile"
      class="rounded-lg border border-border bg-card/50 p-3 space-y-2"
    >
      <div class="flex items-center gap-3">
        <div
          class="shrink-0 w-9 h-9 rounded-md flex items-center justify-center"
          :class="[
            uploadResult?.status === 'success'
              ? 'bg-emerald-500/15 text-emerald-400'
              : uploadResult?.status === 'error'
                ? 'bg-destructive/15 text-destructive'
                : 'bg-muted text-muted-foreground',
          ]"
        >
          <FileCheck2 v-if="uploadResult?.status === 'success'" class="w-5 h-5" />
          <FileWarning
            v-else-if="uploadResult?.status === 'error'"
            class="w-5 h-5"
          />
          <Upload v-else class="w-5 h-5" />
        </div>

        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium truncate">{{ uploadedFile.name }}</div>
          <div class="text-xs text-muted-foreground font-mono">
            {{ formatBytes(uploadedFile.size) }}
            <template v-if="uploadingDemo">
              ·
              {{
                uploadProgress < 100
                  ? $t("pages.settings.linked_accounts.uploading")
                  : $t("pages.settings.linked_accounts.finishing")
              }}
            </template>
          </div>
        </div>

        <Button
          v-if="!uploadingDemo"
          variant="ghost"
          size="icon"
          class="shrink-0 h-7 w-7"
          @click.stop="clearUpload"
        >
          <X class="w-4 h-4" />
        </Button>
      </div>

      <Progress
        v-if="uploadingDemo || uploadProgress > 0"
        :model-value="uploadProgress"
        class="h-1.5"
      />

      <p
        v-if="uploadResult && !uploadingDemo"
        class="text-xs font-mono break-all"
        :class="
          uploadResult.status === 'success'
            ? 'text-emerald-400'
            : 'text-destructive'
        "
      >
        {{ uploadResult.message }}
      </p>
    </div>
  </div>
</template>
