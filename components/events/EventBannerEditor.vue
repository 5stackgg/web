<script setup lang="ts">
import { ref, watch, onBeforeUnmount, shallowRef } from "vue";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, Minimize2, Check } from "lucide-vue-next";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import { downscaleFileToObjectUrl } from "@/utilities/imagePipeline";

// The event hero renders width-first with a ~440px height cap, so 3:1 fills
// a desktop content column edge to edge without triggering the blur
// letterbox. 1920x640 keeps retina banners sharp at webp-friendly weight.
const OUTPUT_W = 1920;
const OUTPUT_H = 640;
const ASPECT = OUTPUT_W / OUTPUT_H;
const MAX_SOURCE_EDGE = 3000;

const props = defineProps<{
  open: boolean;
  file: File | null;
}>();

const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
  (e: "apply", blob: Blob): void;
}>();

const imgEl = ref<HTMLImageElement | null>(null);
const sourceUrl = ref<string | null>(null);
const cropper = shallowRef<Cropper | null>(null);
const rendering = ref(false);

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
      return;
    }
    if (!file) {
      return;
    }
    revokeSource();
    try {
      sourceUrl.value = await downscaleFileToObjectUrl(file, MAX_SOURCE_EDGE);
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

// Shrinks the whole image inside the 3:1 frame (art that must not be
// cropped); the page's blur letterbox fills the remaining space.
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

async function apply() {
  const c = cropper.value;
  if (!c) {
    return;
  }
  rendering.value = true;
  try {
    const canvas = c.getCroppedCanvas({
      width: OUTPUT_W,
      height: OUTPUT_H,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
      fillColor: "#000",
    });
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/webp",
        0.92,
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
        <DialogTitle>{{ $t("event.banner.editor.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("event.banner.editor.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="relative w-full overflow-hidden rounded-md bg-card/40">
        <div class="flex max-h-[60vh] items-center justify-center p-2">
          <img
            v-if="sourceUrl"
            ref="imgEl"
            :src="sourceUrl"
            class="block max-w-full"
            alt=""
            @load="setupCropper"
          />
        </div>
      </div>

      <DialogFooter class="gap-2 sm:justify-between">
        <div class="flex gap-2">
          <Button type="button" variant="outline" size="sm" @click="fitWhole">
            <Minimize2 class="mr-1.5 h-3.5 w-3.5" />
            {{ $t("event.banner.editor.fit_whole") }}
          </Button>
          <Button type="button" variant="ghost" size="sm" @click="reset">
            <RotateCcw class="mr-1.5 h-3.5 w-3.5" />
            {{ $t("event.banner.editor.reset") }}
          </Button>
        </div>
        <Button type="button" :loading="rendering" @click="apply">
          <Check class="mr-1.5 h-4 w-4" />
          {{ $t("event.banner.editor.apply") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
