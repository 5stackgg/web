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
import { RotateCcw, Sparkles, Check, Minimize2 } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import {
  downscaleFileToObjectUrl,
  retryDynamicImport,
} from "@/utilities/imagePipeline";

// Generic crop dialog: fixed crop box at the requested aspect, the user moves /
// zooms the image behind it. Pure — it only emits the cropped blob; callers
// decide how to store it. Supersedes the banner/cover-specific editors.
const props = withDefaults(
  defineProps<{
    open: boolean;
    file: File | null;
    outputW: number;
    outputH: number;
    aspect?: number;
    fillColor?: string;
    quality?: number;
    maxSourceEdge?: number;
    allowFitWhole?: boolean;
    allowBgRemoval?: boolean;
    title?: string;
    description?: string;
    hint?: string;
  }>(),
  {
    fillColor: "#000",
    quality: 0.92,
    maxSourceEdge: 3000,
    allowFitWhole: false,
    allowBgRemoval: false,
  },
);

const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
  (e: "apply", blob: Blob): void;
}>();

const aspect = computed(() => props.aspect ?? props.outputW / props.outputH);

const imgEl = ref<HTMLImageElement | null>(null);
const sourceUrl = ref<string | null>(null);
const workingSrc = ref<string | null>(null);
const cropper = shallowRef<Cropper | null>(null);
const removingBg = ref(false);
const rendering = ref(false);

const displaySrc = computed(() => workingSrc.value ?? sourceUrl.value);

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
    aspectRatio: aspect.value,
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
      sourceUrl.value = await downscaleFileToObjectUrl(
        file,
        props.maxSourceEdge,
      );
    } catch {
      sourceUrl.value = URL.createObjectURL(file);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  teardownCropper();
  revokeSource();
});

function reset() {
  cropper.value?.reset();
}

// Shrinks the whole image inside the crop frame (art that must not be cropped);
// the letterbox fills the remaining space with fillColor / transparency.
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function removeBackground() {
  if (!displaySrc.value && !props.file) {
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

async function apply() {
  const c = cropper.value;
  if (!c) {
    return;
  }
  rendering.value = true;
  try {
    const canvas = c.getCroppedCanvas({
      width: props.outputW,
      height: props.outputH,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      fillColor: props.fillColor,
    });
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/webp",
        props.quality,
      ),
    );
    emit("apply", blob);
    emit("update:open", false);
  } finally {
    rendering.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-4xl">
      <DialogHeader>
        <DialogTitle>{{
          title ?? $t("image_upload.crop.title")
        }}</DialogTitle>
        <DialogDescription>
          {{ description ?? $t("image_upload.crop.description") }}
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
            @load="setupCropper"
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
        v-if="hint"
        class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{ hint }}
      </p>

      <DialogFooter class="gap-2 sm:justify-between">
        <div class="flex flex-wrap gap-2">
          <Button
            v-if="allowFitWhole"
            type="button"
            variant="outline"
            size="sm"
            :disabled="removingBg || rendering || !displaySrc"
            @click="fitWhole"
          >
            <Minimize2 class="mr-1.5 h-3.5 w-3.5" />
            {{ $t("image_upload.crop.fit_whole") }}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            :disabled="removingBg || rendering"
            @click="reset"
          >
            <RotateCcw class="mr-1.5 h-3.5 w-3.5" />
            {{ $t("common.reset") }}
          </Button>
          <Button
            v-if="allowBgRemoval"
            type="button"
            variant="outline"
            size="sm"
            :disabled="removingBg || rendering || !displaySrc"
            @click="removeBackground"
          >
            <Spinner v-if="removingBg" class="mr-1.5 h-3.5 w-3.5" />
            <Sparkles v-else class="mr-1.5 h-3.5 w-3.5" />
            {{ $t("avatar.roster_editor.remove_bg") }}
          </Button>
        </div>
        <Button
          type="button"
          :loading="rendering"
          :disabled="removingBg || !displaySrc"
          @click="apply"
        >
          <Check class="mr-1.5 h-4 w-4" />
          {{ $t("image_upload.crop.apply") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
