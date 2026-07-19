<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "@/components/ui/toast";
import { Upload, Pencil, Trash2 } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import ImageCropDialog from "~/components/ImageCropDialog.vue";
import RosterImageEditor from "~/components/RosterImageEditor.vue";

interface BulkTeam {
  teamId: string;
  teamName: string;
  hasCustomImage: boolean;
}

// One "image-as-surface" upload control: the image fills the tile, hover reveals
// replace/remove, and an empty tile is a dashed dropzone. Three storage modes:
//   immediate  — POST uploadUrl / DELETE deleteUrl (or uploadFn/deleteFn)
//   deferred   — emit the cropped blob, no network (create-wizard style)
//   roster     — delegate to RosterImageEditor (bg-removal + bulk apply)
const props = withDefaults(
  defineProps<{
    currentSrc?: string | null;
    aspect?: "square" | "banner" | "cover" | number;
    fit?: "cover" | "contain";
    hasCustom?: boolean;
    label?: string;
    hint?: string;
    disabled?: boolean;
    accept?: string;
    maxSize?: number;
    crop?: boolean;
    cropOutput?: { w: number; h: number };
    cropFillColor?: string;
    allowFitWhole?: boolean;
    allowBgRemoval?: boolean;
    mode?: "immediate" | "deferred" | "roster";
    uploadUrl?: string;
    deleteUrl?: string;
    filename?: string;
    uploadFn?: (blob: Blob) => Promise<string | null>;
    deleteFn?: () => Promise<void>;
    kind?: "roster" | "team-roster";
    bulkTeams?: BulkTeam[];
    bulkUrlBuilder?: (teamId: string) => string;
  }>(),
  {
    currentSrc: null,
    aspect: "square",
    hasCustom: false,
    mode: "immediate",
    filename: "image.webp",
    bulkTeams: () => [],
  },
);

const emit = defineEmits<{
  (e: "uploaded", srcOrPath: string): void;
  (e: "removed"): void;
  (e: "apply", blob: Blob): void;
}>();

const { t } = useI18n();

const ACCEPT = computed(
  () => props.accept ?? "image/png,image/jpeg,image/webp",
);
const MAX_SIZE = computed(
  () => props.maxSize ?? (props.mode === "roster" ? 20 : 5) * 1024 * 1024,
);

const aspectRatio = computed(() => {
  if (typeof props.aspect === "number") return props.aspect;
  if (props.aspect === "banner") return 3;
  if (props.aspect === "cover") return 16 / 9;
  return 1;
});
const aspectStyle = computed(() => ({ aspectRatio: String(aspectRatio.value) }));

const effectiveFit = computed(
  () => props.fit ?? (props.aspect === "banner" ? "contain" : "cover"),
);
// The blurred-backdrop letterbox only reads well on wide banners; other
// contain cases (logos, trophies, roster art) sit cleaner centered on the card.
const useBlurBackdrop = computed(
  () => effectiveFit.value === "contain" && props.aspect === "banner",
);

const cropEnabled = computed(
  () => props.mode !== "roster" && (props.crop ?? true),
);
const cropOutput = computed(() => {
  if (props.cropOutput) return props.cropOutput;
  if (props.aspect === "banner") return { w: 1920, h: 640 };
  if (props.aspect === "cover") return { w: 1280, h: 720 };
  return { w: 512, h: 512 };
});
const cropFillColor = computed(
  () => props.cropFillColor ?? (props.aspect === "banner" ? "#000" : "transparent"),
);

const defaultHint = computed(() => {
  if (props.hint) return props.hint;
  if (props.aspect === "banner") return t("image_upload.hint_banner");
  if (props.aspect === "cover") return t("image_upload.hint_cover");
  return t("image_upload.hint_square");
});

const fileInput = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);
const isRemoving = ref(false);
const dragDepth = ref(0);
const isDragOver = ref(false);
const cropOpen = ref(false);
const rosterOpen = ref(false);
const editorFile = ref<File | null>(null);
const deferredPreview = ref<string | null>(null);

const displaySrc = computed(() => deferredPreview.value ?? props.currentSrc);
const hasImage = computed(() => !!displaySrc.value);
const showRemove = computed(
  () =>
    (props.mode === "deferred" && !!deferredPreview.value) ||
    (props.mode !== "deferred" && props.hasCustom),
);
const busy = computed(() => isUploading.value || isRemoving.value);

function triggerPicker() {
  if (props.disabled || busy.value) return;
  fileInput.value?.click();
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (file) await handleFile(file);
}

function onDragEnter(event: DragEvent) {
  if (props.disabled || !event.dataTransfer?.types?.includes("Files")) return;
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
  if (props.disabled) return;
  const file = event.dataTransfer?.files?.[0];
  if (file) await handleFile(file);
}

function matchesAccept(file: File) {
  return ACCEPT.value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .some((token) => {
      if (token.endsWith("/*")) {
        return file.type.startsWith(token.slice(0, -1));
      }
      return token === file.type;
    });
}

async function handleFile(file: File) {
  if (!matchesAccept(file)) {
    toast({
      title: t("avatar.invalid_type") as string,
      variant: "destructive",
    });
    return;
  }
  if (file.size > MAX_SIZE.value) {
    toast({
      title: t("avatar.too_large", {
        size: Math.round(MAX_SIZE.value / 1024 / 1024),
      }) as string,
      variant: "destructive",
    });
    return;
  }

  editorFile.value = file;
  if (props.mode === "roster") {
    rosterOpen.value = true;
    return;
  }
  if (cropEnabled.value) {
    cropOpen.value = true;
    return;
  }
  await store(file);
}

function onCropApply(blob: Blob) {
  void store(blob);
}

function setDeferredPreview(blob: Blob) {
  if (deferredPreview.value) URL.revokeObjectURL(deferredPreview.value);
  deferredPreview.value = URL.createObjectURL(blob);
}

async function store(blob: Blob) {
  if (props.mode === "deferred") {
    setDeferredPreview(blob);
    emit("apply", blob);
    return;
  }

  isUploading.value = true;
  try {
    if (props.uploadFn) {
      const src = await props.uploadFn(blob);
      if (src) {
        toast({ title: t("image_upload.uploaded") as string });
        emit("uploaded", src);
      } else {
        toast({
          title: t("image_upload.upload_failed") as string,
          variant: "destructive",
        });
      }
      return;
    }
    const formData = new FormData();
    formData.append("file", blob, props.filename);
    const response = await fetch(props.uploadUrl as string, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    // Avatar endpoints return { path }; banner/others may return an empty body.
    let path = "";
    try {
      const data = (await response.json()) as { path?: string };
      path = data?.path ?? "";
    } catch {
      /* no JSON body — still a success */
    }
    toast({ title: t("image_upload.uploaded") as string });
    emit("uploaded", path);
  } catch (error: any) {
    toast({
      title: t("image_upload.upload_failed") as string,
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    isUploading.value = false;
  }
}

function onRosterUploaded(path: string) {
  emit("uploaded", path);
}

async function remove() {
  if (props.disabled || busy.value) return;

  if (props.mode === "deferred") {
    if (deferredPreview.value) URL.revokeObjectURL(deferredPreview.value);
    deferredPreview.value = null;
    editorFile.value = null;
    emit("removed");
    return;
  }

  isRemoving.value = true;
  try {
    if (props.deleteFn) {
      await props.deleteFn();
    } else {
      const response = await fetch(props.deleteUrl as string, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
    }
    toast({ title: t("image_upload.removed") as string });
    emit("removed");
  } catch (error: any) {
    toast({
      title: t("image_upload.remove_failed") as string,
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    isRemoving.value = false;
  }
}

onBeforeUnmount(() => {
  if (deferredPreview.value) URL.revokeObjectURL(deferredPreview.value);
});
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <span
      v-if="label"
      class="text-sm font-medium leading-none text-foreground"
    >
      {{ label }}
    </span>

    <div
      class="group relative w-full overflow-hidden rounded-md border transition-colors"
      :class="[
        hasImage
          ? 'border-border'
          : 'cursor-pointer border-dashed border-border/60 bg-card/40 hover:border-[hsl(var(--tac-amber)/0.6)] hover:bg-[hsl(var(--tac-amber)/0.05)]',
        isDragOver && 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.12)]',
        disabled && 'pointer-events-none opacity-60',
      ]"
      :style="aspectStyle"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <!-- Filled -->
      <template v-if="hasImage">
        <template v-if="useBlurBackdrop">
          <img
            :src="displaySrc as string"
            aria-hidden="true"
            class="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
          />
          <img
            :src="displaySrc as string"
            alt=""
            class="absolute inset-0 z-[1] h-full w-full object-contain"
          />
        </template>
        <img
          v-else-if="effectiveFit === 'contain'"
          :src="displaySrc as string"
          alt=""
          class="absolute inset-0 h-full w-full object-contain p-2"
        />
        <img
          v-else
          :src="displaySrc as string"
          alt=""
          class="absolute inset-0 h-full w-full object-cover"
        />

        <div
          v-if="!disabled"
          class="absolute right-2 top-2 z-[3] flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        >
          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/90 hover:text-[hsl(var(--tac-amber))] disabled:opacity-50"
            :title="$t('image_upload.replace')"
            :disabled="busy"
            @click.stop="triggerPicker"
          >
            <Pencil class="h-3.5 w-3.5" />
          </button>
          <button
            v-if="showRemove"
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white/90 backdrop-blur-sm transition-colors hover:bg-black/90 hover:text-destructive disabled:opacity-50"
            :title="$t('image_upload.remove')"
            :disabled="busy"
            @click.stop="remove"
          >
            <Spinner v-if="isRemoving" class="h-3.5 w-3.5" />
            <Trash2 v-else class="h-3.5 w-3.5" />
          </button>
        </div>
      </template>

      <!-- Empty -->
      <button
        v-else
        type="button"
        class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center text-muted-foreground"
        @click="triggerPicker"
      >
        <Upload class="h-5 w-5 text-[hsl(var(--tac-amber))]" />
        <span class="font-mono text-[0.6rem] uppercase tracking-[0.16em]">
          {{ isDragOver ? $t("image_upload.drop_to_upload") : defaultHint }}
        </span>
      </button>

      <!-- Uploading overlay -->
      <div
        v-if="isUploading"
        class="absolute inset-0 z-[4] flex items-center justify-center bg-background/70 backdrop-blur-sm"
      >
        <Spinner class="h-6 w-6 text-[hsl(var(--tac-amber))]" />
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      class="hidden"
      :accept="ACCEPT"
      @change="onFileSelected"
    />

    <ImageCropDialog
      v-if="cropEnabled"
      v-model:open="cropOpen"
      :file="editorFile"
      :output-w="cropOutput.w"
      :output-h="cropOutput.h"
      :fill-color="cropFillColor"
      :allow-fit-whole="allowFitWhole"
      :allow-bg-removal="allowBgRemoval"
      @apply="onCropApply"
    />

    <RosterImageEditor
      v-if="mode === 'roster'"
      v-model:open="rosterOpen"
      :file="editorFile"
      :upload-url="uploadUrl as string"
      :mode="kind === 'team-roster' ? 'team-roster' : 'player-roster'"
      :bulk-teams="bulkTeams"
      :bulk-url-builder="bulkUrlBuilder"
      @uploaded="onRosterUploaded"
    />
  </div>
</template>
