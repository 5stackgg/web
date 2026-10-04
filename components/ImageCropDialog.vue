<script setup lang="ts">
import { ref, watch, onBeforeUnmount, shallowRef, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  RotateCcw,
  Sparkles,
  Check,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  CircleCheck,
  TriangleAlert,
} from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import {
  downscaleFileToObjectUrl,
  retryDynamicImport,
} from "@/utilities/imagePipeline";
import { cropRect, safeZone, type CropFrame } from "@/utilities/cropFrames";

// Generic crop dialog: fixed crop box at the requested aspect, the user moves /
// zooms the image behind it. Pure — it only emits the cropped blob; callers
// decide how to store it. With `frames` it also previews every surface the
// image is shown in and outlines the safe zone they all keep.
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
    frames?: CropFrame[];
    recommendedWidth?: number;
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

const { t, te } = useI18n();

const aspect = computed(() => props.aspect ?? props.outputW / props.outputH);

const imgEl = ref<HTMLImageElement | null>(null);
const sourceUrl = ref<string | null>(null);
const workingSrc = ref<string | null>(null);
const cropper = shallowRef<Cropper | null>(null);
const removingBg = ref(false);
const rendering = ref(false);
// The crop box element cropper.js builds; the safe-zone overlay teleports into it.
const cropBoxEl = shallowRef<HTMLElement | null>(null);
// Current crop in natural image pixels, for the live frame previews.
const crop = ref<{ x: number; y: number; w: number; h: number } | null>(null);
const natural = ref<{ w: number; h: number } | null>(null);
const sourceSize = ref<{ w: number; h: number } | null>(null);
const activeFrame = ref<number | null>(null);

const displaySrc = computed(() => workingSrc.value ?? sourceUrl.value);

const label = (key?: string) => (key ? (te(key) ? t(key) : key) : "");

// Logo-style frames share the output's aspect, so there is no zone to show.
const zone = computed(() => {
  if (!props.frames?.length) {
    return null;
  }
  const z = safeZone(aspect.value, props.frames);
  return z.w > 0.98 && z.h > 0.98 ? null : z;
});
const outlined = computed(() =>
  activeFrame.value === null || !props.frames
    ? null
    : cropRect(aspect.value, props.frames[activeFrame.value]),
);

function pct(rect: { x: number; y: number; w: number; h: number }) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  };
}

// Positions the source image inside a frame thumbnail so it shows exactly what
// that surface will show of the cropped output.
function previewStyle(frame: CropFrame) {
  const c = crop.value;
  const n = natural.value;
  if (!c || !n) {
    return { display: "none" };
  }
  const r = cropRect(aspect.value, frame);
  const rx = c.x + r.x * c.w;
  const ry = c.y + r.y * c.h;
  const rw = r.w * c.w;
  const rh = r.h * c.h;
  return {
    left: `${(-rx / rw) * 100}%`,
    top: `${(-ry / rh) * 100}%`,
    width: `${(n.w / rw) * 100}%`,
    height: `${(n.h / rh) * 100}%`,
  };
}

// Size checks: the source against the recommendation, and the crop against
// the output (zooming past the source's pixels upscales it).
const checks = computed(() => {
  const out: { ok: boolean; text: string }[] = [];
  const s = sourceSize.value;
  if (!s || (!props.recommendedWidth && !props.frames?.length)) {
    return out;
  }
  const rec = props.recommendedWidth ?? props.outputW;
  if (s.w < rec) {
    out.push({
      ok: false,
      text: t("image_upload.crop.check_small", { w: s.w, rec }),
    });
  } else {
    out.push({
      ok: true,
      text: t("image_upload.crop.check_size", { w: s.w, h: s.h }),
    });
  }
  const c = crop.value;
  const n = natural.value;
  if (c && n && s.w >= rec) {
    // crop is in downscaled-preview pixels; scale back to the source.
    const sourcePixels = c.w * (s.w / n.w);
    if (sourcePixels < props.outputW * 0.8) {
      out.push({ ok: false, text: t("image_upload.crop.check_zoomed") });
    }
  }
  return out;
});

let raf = 0;
function syncCrop() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const c = cropper.value;
    if (!c) {
      return;
    }
    const d = c.getData();
    const img = c.getImageData();
    crop.value = { x: d.x, y: d.y, w: d.width, h: d.height };
    natural.value = { w: img.naturalWidth, h: img.naturalHeight };
  });
}

function teardownCropper() {
  cancelAnimationFrame(raf);
  cropper.value?.destroy();
  cropper.value = null;
  cropBoxEl.value = null;
  crop.value = null;
}

function setupCropper() {
  if (!imgEl.value) {
    return;
  }
  teardownCropper();
  const img = imgEl.value;
  cropper.value = new Cropper(img, {
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
    ready() {
      cropBoxEl.value =
        img.parentElement?.querySelector<HTMLElement>(".cropper-crop-box") ??
        null;
      syncCrop();
    },
    crop: syncCrop,
  });
}

function revokeSource() {
  if (sourceUrl.value && sourceUrl.value.startsWith("blob:")) {
    URL.revokeObjectURL(sourceUrl.value);
  }
  sourceUrl.value = null;
}

function readSourceSize(file: File) {
  sourceSize.value = null;
  const url = URL.createObjectURL(file);
  const probe = new Image();
  probe.onload = () => {
    sourceSize.value = { w: probe.naturalWidth, h: probe.naturalHeight };
    URL.revokeObjectURL(url);
  };
  probe.onerror = () => URL.revokeObjectURL(url);
  probe.src = url;
}

watch(
  () => [props.open, props.file] as const,
  async ([open, file]) => {
    if (!open) {
      teardownCropper();
      revokeSource();
      workingSrc.value = null;
      activeFrame.value = null;
      return;
    }
    if (!file) {
      return;
    }
    revokeSource();
    workingSrc.value = null;
    readSourceSize(file);
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

function zoom(by: number) {
  cropper.value?.zoom(by);
}

// Centers the image in the frame at its current zoom.
function center() {
  const c = cropper.value;
  if (!c) {
    return;
  }
  const box = c.getCropBoxData();
  const canvas = c.getCanvasData();
  c.setCanvasData({
    left: box.left + (box.width - canvas.width) / 2,
    top: box.top + (box.height - canvas.height) / 2,
  });
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
    <DialogContent class="max-h-[calc(100dvh-2rem)] max-w-4xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ title ?? $t("image_upload.crop.title") }}</DialogTitle>
        <DialogDescription>
          {{ description ?? $t("image_upload.crop.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="relative w-full overflow-hidden rounded-md bg-card/40">
        <div
          class="flex items-center justify-center p-2"
          :class="frames?.length ? 'max-h-[46vh]' : 'max-h-[60vh]'"
        >
          <img
            v-if="displaySrc"
            ref="imgEl"
            :src="displaySrc"
            class="block max-w-full"
            alt=""
            @load="setupCropper"
          />
        </div>

        <!-- Lives inside cropper's own crop box so it follows it exactly. -->
        <Teleport v-if="cropBoxEl && (zone || outlined)" :to="cropBoxEl">
          <div class="pointer-events-none absolute inset-0 z-[1]">
            <div
              v-if="zone"
              class="absolute rounded-sm border border-dashed border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
              :style="pct(zone)"
            >
              <span
                class="absolute left-1 top-1 rounded-sm bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white"
              >
                {{ $t("image_upload.crop.safe_zone") }}
              </span>
            </div>
            <div
              v-if="outlined"
              class="absolute rounded-sm border-2 border-[hsl(var(--tac-amber))]"
              :style="pct(outlined)"
            ></div>
          </div>
        </Teleport>

        <div
          v-if="removingBg"
          class="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm"
        >
          <Spinner class="h-6 w-6 text-[hsl(var(--tac-amber))]" />
          <div
            class="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("avatar.roster_editor.removing_bg") }}
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            class="h-8 w-8"
            :aria-label="$t('image_upload.crop.zoom_out')"
            :disabled="!displaySrc"
            @click="zoom(-0.1)"
          >
            <ZoomOut class="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            class="h-8 w-8"
            :aria-label="$t('image_upload.crop.zoom_in')"
            :disabled="!displaySrc"
            @click="zoom(0.1)"
          >
            <ZoomIn class="h-4 w-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          :disabled="!displaySrc"
          @click="center"
        >
          <Crosshair class="mr-1.5 h-3.5 w-3.5" />
          {{ $t("image_upload.crop.center") }}
        </Button>
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
      </div>

      <template v-if="frames?.length">
        <ul v-if="checks.length" class="grid gap-1.5 text-sm">
          <li
            v-for="check in checks"
            :key="check.text"
            class="flex items-start gap-2"
          >
            <CircleCheck
              v-if="check.ok"
              class="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
            />
            <TriangleAlert
              v-else
              class="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]"
            />
            <span class="text-muted-foreground">{{ check.text }}</span>
          </li>
        </ul>

        <div class="grid gap-2">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-sm font-medium">
              {{ $t("image_upload.crop.where_it_shows") }}
            </span>
            <span v-if="zone" class="text-xs text-muted-foreground">
              {{ $t("image_upload.crop.safe_zone_hint") }}
            </span>
          </div>
          <div
            class="grid items-end gap-2"
            :class="
              frames[0].size
                ? 'grid-cols-[repeat(auto-fill,minmax(6rem,1fr))]'
                : 'grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))]'
            "
          >
            <button
              v-for="(frame, index) in frames"
              :key="index"
              type="button"
              class="grid gap-1.5 rounded-md border p-1.5 text-left transition-colors"
              :class="
                activeFrame === index
                  ? 'border-[hsl(var(--tac-amber))]'
                  : 'border-border hover:border-foreground/30'
              "
              :aria-pressed="activeFrame === index"
              @click="activeFrame = activeFrame === index ? null : index"
            >
              <span
                class="relative block overflow-hidden"
                :class="frame.size ? 'mx-auto rounded-md' : 'w-full rounded-sm'"
                :style="
                  frame.size
                    ? {
                        width: `${frame.size}px`,
                        height: `${frame.size / frame.aspect}px`,
                        background: fillColor,
                      }
                    : {
                        aspectRatio: String(frame.aspect),
                        background: fillColor,
                      }
                "
              >
                <img
                  v-if="displaySrc"
                  :src="displaySrc"
                  alt=""
                  class="absolute max-w-none"
                  :style="previewStyle(frame)"
                />
              </span>
              <span class="grid text-xs font-medium leading-tight">
                {{ label(frame.label) }}
                <span
                  v-if="frame.sub"
                  class="font-normal text-muted-foreground"
                >
                  {{ label(frame.sub) }}
                </span>
              </span>
            </button>
          </div>
        </div>
      </template>

      <p
        v-if="hint"
        class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{ hint }}
      </p>

      <DialogFooter class="gap-2">
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
