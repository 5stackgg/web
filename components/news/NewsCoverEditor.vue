<script setup lang="ts">
import { ref, watch, onBeforeUnmount, shallowRef, computed } from "vue";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, Sparkles, Upload, Minimize2 } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import {
  downscaleFileToObjectUrl,
  retryDynamicImport,
} from "@/utilities/imagePipeline";

const OUTPUT_W = 1280;
const OUTPUT_H = 720;
const ASPECT = OUTPUT_W / OUTPUT_H;
const MAX_SOURCE_EDGE = 2000;

const props = defineProps<{
  open: boolean;
  file: File | null;
}>();

const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
  (e: "uploaded", url: string): void;
}>();

const { upload } = useNewsImageUpload();

const imgEl = ref<HTMLImageElement | null>(null);
const sourceUrl = ref<string | null>(null);
const cropper = shallowRef<Cropper | null>(null);
const removingBg = ref(false);
const uploading = ref(false);
const workingSrc = ref<string | null>(null);

function teardownCropper() {
  cropper.value?.destroy();
  cropper.value = null;
}

function setupCropper() {
  if (!imgEl.value) {
    return;
  }
  teardownCropper();
  cropper.value = new Cropper(imgEl.value, {
    aspectRatio: ASPECT,
    viewMode: 0,
    autoCropArea: 1,
    background: true,
    responsive: true,
    movable: true,
    zoomable: true,
    scalable: false,
    rotatable: false,
    dragMode: "move",
    cropBoxMovable: false,
    cropBoxResizable: false,
    minCropBoxWidth: 0,
    minCropBoxHeight: 0,
  });
}

function revokeSource() {
  if (sourceUrl.value && sourceUrl.value.startsWith("blob:")) {
    URL.revokeObjectURL(sourceUrl.value);
  }
  sourceUrl.value = null;
}

watch(
  () => [props.open, props.file] as const,
  async ([open, file]) => {
    if (!open) {
      teardownCropper();
      revokeSource();
      workingSrc.value = null;
      return;
    }
    if (!file) {
      return;
    }
    revokeSource();
    workingSrc.value = null;
    try {
      sourceUrl.value = await downscaleFileToObjectUrl(file, MAX_SOURCE_EDGE);
    } catch {
      sourceUrl.value = URL.createObjectURL(file);
    }
  },
  { immediate: true },
);

function onImgLoad() {
  setupCropper();
}

onBeforeUnmount(() => {
  teardownCropper();
  revokeSource();
});

function reset() {
  cropper.value?.reset();
}

function fitWhole() {
  const c = cropper.value;
  if (!c) {
    return;
  }
  const cropBox = c.getCropBoxData();
  const image = c.getImageData();
  const scale = Math.min(
    cropBox.width / image.naturalWidth,
    cropBox.height / image.naturalHeight,
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  c.setCanvasData({
    left: cropBox.left + (cropBox.width - width) / 2,
    top: cropBox.top + (cropBox.height - height) / 2,
    width,
    height,
  });
}

async function removeBackground() {
  if (!props.file && !workingSrc.value && !sourceUrl.value) {
    return;
  }
  removingBg.value = true;
  try {
    const { removeBackground: imglyRemove } = await retryDynamicImport(
      () => import("@imgly/background-removal"),
    );
    const input = workingSrc.value ?? sourceUrl.value ?? props.file!;
    const blob = await imglyRemove(input as any);
    workingSrc.value = await blobToDataUrl(blob);
  } catch (err: any) {
    toast({
      title: useNuxtApp().$i18n.t("avatar.bg_removal_failed") as string,
      description: err?.message,
      variant: "destructive",
    });
  } finally {
    removingBg.value = false;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function renderBlob(): Promise<Blob> {
  if (!cropper.value) {
    throw new Error("Cropper not ready");
  }
  const canvas = cropper.value.getCroppedCanvas({
    width: OUTPUT_W,
    height: OUTPUT_H,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
    fillColor: "transparent",
  });
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/webp",
      0.92,
    ),
  );
}

async function save() {
  if (!cropper.value) {
    return;
  }
  uploading.value = true;
  try {
    const blob = await renderBlob();
    const url = await upload(blob);
    if (url) {
      emit("uploaded", url);
      emit("update:open", false);
    }
  } finally {
    uploading.value = false;
  }
}

const displaySrc = computed(() => workingSrc.value ?? sourceUrl.value);
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ $t("pages.news.cover_editor.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("pages.news.cover_editor.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="relative w-full overflow-hidden rounded-md bg-card/40">
        <div class="flex max-h-[60vh] items-center justify-center p-2">
          <img
            v-if="displaySrc"
            ref="imgEl"
            :src="displaySrc"
            class="block max-w-full"
            alt=""
            @load="onImgLoad"
          />
        </div>

        <div
          v-if="removingBg"
          class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm"
        >
          <Spinner class="h-6 w-6 text-[hsl(var(--tac-amber))]" />
          <div
            class="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("avatar.roster_editor.removing_bg") }}
          </div>
        </div>
      </div>

      <p
        class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{ $t("pages.news.cover_editor.hint") }}
      </p>

      <DialogFooter class="gap-2 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          :disabled="removingBg || uploading || !displaySrc"
          @click="fitWhole"
        >
          <Minimize2 class="mr-1 h-4 w-4" />
          {{ $t("pages.news.cover_editor.fit") }}
        </Button>
        <Button
          type="button"
          variant="outline"
          :disabled="removingBg || uploading"
          @click="reset"
        >
          <RotateCcw class="mr-1 h-4 w-4" />
          {{ $t("common.reset") }}
        </Button>
        <Button
          type="button"
          variant="outline"
          :disabled="removingBg || uploading || !displaySrc"
          @click="removeBackground"
        >
          <Spinner v-if="removingBg" class="mr-1 h-4 w-4" />
          <Sparkles v-else class="mr-1 h-4 w-4" />
          {{ $t("avatar.roster_editor.remove_bg") }}
        </Button>
        <Button
          type="button"
          :disabled="removingBg || uploading || !displaySrc"
          @click="save"
        >
          <Spinner v-if="uploading" class="mr-1 h-4 w-4" />
          <Upload v-else class="mr-1 h-4 w-4" />
          {{ $t("common.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
