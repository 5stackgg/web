<script setup lang="ts">
import { ref, computed } from "vue";
import { toast } from "@/components/ui/toast";
import { Upload, Trash2, X } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import RosterImageEditor from "@/components/RosterImageEditor.vue";

interface BulkTeam {
  teamId: string;
  teamName: string;
  hasCustomImage: boolean;
}

const props = withDefaults(
  defineProps<{
    uploadUrl: string;
    deleteUrl: string;
    hasCustom: boolean;
    variant?: "inline" | "dropzone";
    currentSrc?: string | null;
    maxSize?: number;
    kind?: "avatar" | "roster" | "team-roster";
    bulkTeams?: BulkTeam[];
    bulkUrlBuilder?: (teamId: string) => string;
  }>(),
  {
    variant: "inline",
    currentSrc: null,
    kind: "avatar",
    bulkTeams: () => [],
  },
);

const uploadKey = computed(() =>
  props.kind === "roster" ? "avatar.upload_roster" : "avatar.upload",
);
const changeKey = computed(() =>
  props.kind === "roster" ? "avatar.change_roster" : "avatar.change",
);
const removeKey = computed(() =>
  props.kind === "roster" ? "avatar.remove_roster" : "avatar.remove",
);

const emit = defineEmits<{
  (e: "uploaded", path: string): void;
  (e: "removed"): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const isRemoving = ref(false);
const dragDepth = ref(0);
const isDragOver = ref(false);

const editorOpen = ref(false);
const editorFile = ref<File | null>(null);

const ACCEPT = "image/png,image/jpeg,image/webp";
const DEFAULT_MAX_SIZE =
  props.kind === "roster" || props.kind === "team-roster"
    ? 20 * 1024 * 1024
    : 5 * 1024 * 1024;
const MAX_SIZE = props.maxSize ?? DEFAULT_MAX_SIZE;

const useEditor = computed(
  () => props.kind === "roster" || props.kind === "team-roster",
);
const editorMode = computed<"player-roster" | "team-roster">(() =>
  props.kind === "team-roster" ? "team-roster" : "player-roster",
);

function triggerPicker() {
  if (isUploading.value || isRemoving.value) return;
  fileInput.value?.click();
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) await handleFile(file);
}

function onDragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types?.includes("Files")) return;
  dragDepth.value++;
  isDragOver.value = true;
}

function onDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1);
  if (dragDepth.value === 0) isDragOver.value = false;
}

async function onDrop(event: DragEvent) {
  dragDepth.value = 0;
  isDragOver.value = false;

  const file = event.dataTransfer?.files?.[0];
  if (file) await handleFile(file);
}

async function handleFile(file: File) {
  if (!ACCEPT.split(",").includes(file.type)) {
    toast({
      title: useNuxtApp().$i18n.t("avatar.invalid_type") as string,
      variant: "destructive",
    });
    return;
  }

  if (file.size > MAX_SIZE) {
    toast({
      title: useNuxtApp().$i18n.t("avatar.too_large", {
        size: Math.round(MAX_SIZE / 1024 / 1024),
      }) as string,
      variant: "destructive",
    });
    return;
  }

  if (useEditor.value) {
    editorFile.value = file;
    editorOpen.value = true;
    return;
  }

  isUploading.value = true;
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(props.uploadUrl, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { path: string };

    toast({
      title: useNuxtApp().$i18n.t("avatar.upload_success") as string,
    });

    emit("uploaded", data.path);
  } catch (error: any) {
    toast({
      title: useNuxtApp().$i18n.t("avatar.upload_failed") as string,
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    isUploading.value = false;
  }
}

function onEditorUploaded(path: string) {
  emit("uploaded", path);
}

async function remove() {
  if (isRemoving.value) return;
  isRemoving.value = true;
  try {
    const response = await fetch(props.deleteUrl, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    toast({
      title: useNuxtApp().$i18n.t("avatar.remove_success") as string,
    });

    emit("removed");
  } catch (error: any) {
    toast({
      title: useNuxtApp().$i18n.t("avatar.remove_failed") as string,
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    isRemoving.value = false;
  }
}
</script>

<template>
  <div v-if="variant === 'dropzone'">
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      :accept="ACCEPT"
      @change="onFileSelected"
    />
    <div
      role="button"
      tabindex="0"
      class="group relative flex items-center gap-4 rounded-md border border-dashed border-border/60 bg-card/40 p-3 transition-colors cursor-pointer hover:border-[hsl(var(--tac-amber)_/_0.6)] hover:bg-[hsl(var(--tac-amber)_/_0.05)]"
      :class="{
        'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)_/_0.12)]':
          isDragOver,
        'opacity-60 pointer-events-none': isUploading,
      }"
      @click="triggerPicker"
      @keydown.enter.prevent="triggerPicker"
      @keydown.space.prevent="triggerPicker"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <div class="relative shrink-0">
        <div
          class="relative h-16 w-16 border border-[hsl(var(--tac-amber)_/_0.4)] bg-[hsl(var(--tac-amber)_/_0.1)] overflow-hidden flex items-center justify-center"
        >
          <img
            v-if="currentSrc"
            :src="currentSrc"
            alt=""
            class="h-full w-full object-cover"
          />
          <Upload v-else class="w-6 h-6 text-[hsl(var(--tac-amber))]" />
        </div>
        <button
          v-if="hasCustom"
          type="button"
          :title="$t(removeKey)"
          :aria-label="$t(removeKey)"
          class="absolute -top-1.5 -right-1.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[hsl(var(--tac-amber)_/_0.6)] bg-background text-red-500 shadow-sm transition-colors hover:bg-red-500 hover:text-white hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isUploading || isRemoving"
          @click.prevent.stop="remove"
        >
          <Spinner v-if="isRemoving" class="h-3 w-3" />
          <X v-else class="h-3 w-3" />
        </button>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-foreground">
          <template v-if="isUploading">{{ $t("avatar.uploading") }}</template>
          <template v-else-if="isDragOver">{{
            $t("avatar.drop_to_upload")
          }}</template>
          <template v-else>{{
            hasCustom ? $t(changeKey) : $t(uploadKey)
          }}</template>
        </div>
        <div
          class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground mt-1"
        >
          {{ useEditor ? $t("avatar.roster_hint") : $t("avatar.hint") }}
        </div>
      </div>
      <Spinner
        v-if="isUploading"
        class="w-5 h-5 text-[hsl(var(--tac-amber))]"
      />
    </div>

    <div v-if="hasCustom" class="mt-2 flex justify-end">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="isUploading || isRemoving"
        @click.prevent.stop="remove"
      >
        <Spinner v-if="isRemoving" class="w-3.5 h-3.5" />
        <Trash2 v-else class="w-3.5 h-3.5" />
        <span>{{ $t(removeKey) }}</span>
      </button>
    </div>
  </div>

  <div v-else class="flex items-center gap-2">
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      :accept="ACCEPT"
      @change="onFileSelected"
    />
    <button
      type="button"
      class="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="isUploading || isRemoving"
      @click.prevent="triggerPicker"
    >
      <Spinner v-if="isUploading" class="w-4 h-4" />
      <Upload v-else class="w-4 h-4" />
      <span>{{ hasCustom ? $t(changeKey) : $t(uploadKey) }}</span>
    </button>
    <button
      v-if="hasCustom"
      type="button"
      class="inline-flex items-center gap-1.5 text-sm text-red-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="isUploading || isRemoving"
      @click.prevent="remove"
    >
      <Spinner v-if="isRemoving" class="w-4 h-4" />
      <Trash2 v-else class="w-4 h-4" />
      <span>{{ $t(removeKey) }}</span>
    </button>
  </div>

  <RosterImageEditor
    v-if="useEditor"
    v-model:open="editorOpen"
    :file="editorFile"
    :upload-url="uploadUrl"
    :mode="editorMode"
    :bulk-teams="bulkTeams"
    :bulk-url-builder="bulkUrlBuilder"
    @uploaded="onEditorUploaded"
  />
</template>
