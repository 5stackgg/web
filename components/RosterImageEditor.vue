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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RotateCcw, Sparkles, Upload, Info } from "lucide-vue-next";
import { toast } from "@/components/ui/toast";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import {
  downscaleFileToObjectUrl,
  retryDynamicImport,
} from "@/utilities/imagePipeline";

// Final output dimensions — close to HLTV's 400×417 roster portrait.
const OUTPUT_W = 400;
const OUTPUT_H = 420;
const ASPECT = OUTPUT_W / OUTPUT_H;

// Source images get shrunk to this longest-edge before bg-removal / crop.
// Keeps memory in check and lets bg-removal complete in a reasonable time
// for the 4–5MB phone photos users tend to drop in.
const MAX_SOURCE_EDGE = 1600;

interface BulkTeam {
  teamId: string;
  teamName: string;
  hasCustomImage: boolean;
}

const props = withDefaults(
  defineProps<{
    open: boolean;
    file: File | null;
    uploadUrl: string;
    mode?: "player-roster" | "team-roster";
    bulkTeams?: BulkTeam[];
    bulkUrlBuilder?: (teamId: string) => string;
  }>(),
  {
    mode: "player-roster",
    bulkTeams: () => [],
  },
);

const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
  (e: "uploaded", path: string): void;
}>();

const imgEl = ref<HTMLImageElement | null>(null);
const sourceUrl = ref<string | null>(null);
const cropper = shallowRef<Cropper | null>(null);
const removingBg = ref(false);
const uploading = ref(false);
const workingSrc = ref<string | null>(null);
// teamId → checked. Reset to all-unchecked each time the dialog opens.
const selectedTeams = ref<Record<string, boolean>>({});

const showBulk = computed(
  () => props.mode === "player-roster" && props.bulkTeams.length > 0,
);

function teardownCropper() {
  cropper.value?.destroy();
  cropper.value = null;
}

function setupCropper() {
  if (!imgEl.value) return;
  teardownCropper();
  cropper.value = new Cropper(imgEl.value, {
    aspectRatio: ASPECT,
    viewMode: 1,
    autoCropArea: 0.9,
    background: true,
    responsive: true,
    movable: true,
    zoomable: true,
    scalable: false,
    rotatable: false,
    dragMode: "move",
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
      selectedTeams.value = {};
      return;
    }
    if (!file) return;
    revokeSource();
    workingSrc.value = null;
    // Start with every team unchecked — conservative per the chosen UX.
    selectedTeams.value = {};
    // Downscale on the way in so 5MB+ phone photos don't blow up the
    // cropper / bg-removal step. Falls back to the raw file on error.
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

async function removeBackground() {
  if (!props.file && !workingSrc.value && !sourceUrl.value) return;
  removingBg.value = true;
  try {
    const { removeBackground: imglyRemove } = await retryDynamicImport(
      () => import("@imgly/background-removal"),
    );
    // Prefer the already-shrunk sourceUrl over the raw props.file so we
    // don't hand a 20MP image to bg-removal.
    const input = workingSrc.value ?? sourceUrl.value ?? props.file!;
    const blob = await imglyRemove(input as any);
    const dataUrl = await blobToDataUrl(blob);
    workingSrc.value = dataUrl;
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
  if (!cropper.value) throw new Error("Cropper not ready");
  const canvas = cropper.value.getCroppedCanvas({
    width: OUTPUT_W,
    height: OUTPUT_H,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
    fillColor: "transparent",
  });
  // WebP keeps the alpha channel from bg-removal but is a fraction of the
  // PNG size. 0.92 is visually indistinguishable at 400×420.
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/webp",
      0.92,
    ),
  );
}

async function postBlob(url: string, blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, "roster.webp");
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { path: string };
  return data.path;
}

async function save() {
  if (!cropper.value) return;
  uploading.value = true;
  try {
    const blob = await renderBlob();
    const path = await postBlob(props.uploadUrl, blob);

    // Bulk-apply runs in parallel after the primary succeeds. We don't
    // fail the whole save if a sub-upload fails — surface each failure
    // as a toast and continue.
    const chosenTeams = showBulk.value
      ? props.bulkTeams.filter((t) => selectedTeams.value[t.teamId])
      : [];

    if (chosenTeams.length > 0 && props.bulkUrlBuilder) {
      const results = await Promise.allSettled(
        chosenTeams.map((t) =>
          postBlob(props.bulkUrlBuilder!(t.teamId), blob).then(() => t),
        ),
      );
      const failed = results
        .map((r, i) => ({ r, team: chosenTeams[i] }))
        .filter(({ r }) => r.status === "rejected");
      const ok = results.length - failed.length;
      if (ok > 0) {
        toast({
          title: useNuxtApp().$i18n.t("avatar.roster_editor.bulk_success", {
            count: ok,
          }) as string,
        });
      }
      for (const { r, team } of failed) {
        toast({
          title: useNuxtApp().$i18n.t("avatar.roster_editor.bulk_failed", {
            name: team.teamName,
          }) as string,
          description:
            r.status === "rejected"
              ? String((r as any).reason?.message ?? r.reason)
              : "",
          variant: "destructive",
        });
      }
    }

    toast({
      title: useNuxtApp().$i18n.t("avatar.upload_success") as string,
    });
    emit("uploaded", path);
    emit("update:open", false);
  } catch (error: any) {
    toast({
      title: useNuxtApp().$i18n.t("avatar.upload_failed") as string,
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    uploading.value = false;
  }
}

const displaySrc = computed(() => workingSrc.value ?? sourceUrl.value);

const noticeKey = computed(() =>
  props.mode === "team-roster"
    ? "avatar.roster_editor.notice_team"
    : "avatar.roster_editor.notice_player",
);
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ $t("avatar.roster_editor.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("avatar.roster_editor.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="relative w-full bg-card/40 rounded-md overflow-hidden">
        <div class="max-h-[60vh] flex items-center justify-center p-2">
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
          <Loader2 class="h-6 w-6 animate-spin text-[hsl(var(--tac-amber))]" />
          <div
            class="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("avatar.roster_editor.removing_bg") }}
          </div>
        </div>
      </div>

      <div
        class="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{ $t("avatar.roster_editor.size_hint", { w: OUTPUT_W, h: OUTPUT_H }) }}
      </div>

      <div
        class="flex items-start gap-2 rounded-md border border-border/60 bg-card/50 px-3 py-2 text-xs text-muted-foreground"
      >
        <Info
          class="h-3.5 w-3.5 mt-0.5 shrink-0 text-[hsl(var(--tac-amber))]"
        />
        <span class="leading-snug">{{ $t(noticeKey) }}</span>
      </div>

      <div v-if="showBulk" class="space-y-2">
        <div
          class="inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground"
        >
          <span class="h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"></span>
          {{ $t("avatar.roster_editor.bulk_label") }}
        </div>
        <div
          class="rounded-md border border-border/50 divide-y divide-border/40 max-h-44 overflow-auto"
        >
          <label
            v-for="t in bulkTeams"
            :key="t.teamId"
            class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/30"
          >
            <Checkbox
              :model-value="!!selectedTeams[t.teamId]"
              @update:model-value="
                (v: boolean) => (selectedTeams[t.teamId] = v)
              "
            />
            <div class="flex flex-1 items-center justify-between min-w-0">
              <span class="truncate text-sm">{{ t.teamName }}</span>
              <span
                v-if="t.hasCustomImage"
                class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]/85"
              >
                {{ $t("avatar.roster_editor.bulk_will_overwrite") }}
              </span>
            </div>
          </label>
        </div>
      </div>

      <DialogFooter class="gap-2 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          :disabled="removingBg || uploading"
          @click="reset"
        >
          <RotateCcw class="h-4 w-4 mr-1" />
          {{ $t("common.reset") }}
        </Button>
        <Button
          type="button"
          variant="outline"
          :disabled="removingBg || uploading || !displaySrc"
          @click="removeBackground"
        >
          <Loader2 v-if="removingBg" class="h-4 w-4 mr-1 animate-spin" />
          <Sparkles v-else class="h-4 w-4 mr-1" />
          {{ $t("avatar.roster_editor.remove_bg") }}
        </Button>
        <Button
          type="button"
          :disabled="removingBg || uploading || !displaySrc"
          @click="save"
        >
          <Loader2 v-if="uploading" class="h-4 w-4 mr-1 animate-spin" />
          <Upload v-else class="h-4 w-4 mr-1" />
          {{ $t("common.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
