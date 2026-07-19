<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import { ImagePlus } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ImageCropDialog from "~/components/ImageCropDialog.vue";
import { toast } from "@/components/ui/toast";
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import {
  useEventMediaUpload,
  eventMediaUrl,
} from "~/composables/useEventMediaUpload";

// The banner is deliberately visual-only; mp3 stays a gallery format.
const BANNER_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4";

const props = defineProps<{
  event: {
    id: string;
    banner_media_id?: string | null;
    banner?: { id: string; filename: string; mime_type: string } | null;
  };
}>();

const { upload, uploading, progress } = useEventMediaUpload(
  () => props.event.id,
);
const { client: apolloClient } = useApolloClient();
const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);
const removing = ref(false);
const editorOpen = ref(false);
const editorFile = ref<File | null>(null);

const bannerSrc = computed(() =>
  props.event.banner
    ? eventMediaUrl(props.event.id, props.event.banner.filename)
    : null,
);

const setBannerMutation = generateMutation({
  update_events_by_pk: [
    {
      pk_columns: { id: $("id", "uuid!") },
      _set: { banner_media_id: $("banner_media_id", "uuid") },
    },
    { id: true },
  ],
});

function pickFile() {
  if (uploading.value) return;
  fileInput.value?.click();
}

async function deleteMedia(mediaId: string) {
  const apiDomain = useRuntimeConfig().public.apiDomain;
  const response = await fetch(
    `https://${apiDomain}/events/media/${props.event.id}/${mediaId}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!response.ok) {
    throw new Error(
      (await response.text()) || `${response.status} ${response.statusText}`,
    );
  }
}

function handleFileSelect(fileEvent: Event) {
  const target = fileEvent.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = "";
  if (!file) return;

  // Images go through the crop editor so the banner lands at the hero's 3:1
  // frame; video banners upload as-is.
  if (file.type.startsWith("image/")) {
    editorFile.value = file;
    editorOpen.value = true;
    return;
  }
  void uploadBanner(file);
}

async function uploadBanner(file: File | Blob) {
  const previousBannerId = props.event.banner_media_id ?? null;
  const result = await upload(file);
  if (!result) return;

  try {
    await apolloClient.mutate({
      mutation: setBannerMutation,
      variables: { id: props.event.id, banner_media_id: result.id },
    });
    // The banner has a dedicated slot, so a replaced banner file is deleted
    // rather than left behind as an orphaned gallery item.
    if (previousBannerId && previousBannerId !== result.id) {
      await deleteMedia(previousBannerId);
    }
    toast({ title: t("event.banner.updated") });
  } catch (error: any) {
    toast({ title: error?.message, variant: "destructive" });
  }
}

async function removeBanner() {
  const bannerId = props.event.banner_media_id;
  if (!bannerId) return;
  removing.value = true;
  try {
    // Deleting the media row nulls banner_media_id via the FK.
    await deleteMedia(bannerId);
    toast({ title: t("event.banner.removed") });
  } catch (error: any) {
    toast({ title: error?.message, variant: "destructive" });
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <div class="flex flex-wrap items-start gap-4">
    <div
      v-if="bannerSrc && event.banner"
      class="relative flex h-20 w-60 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-black/50"
    >
      <img
        v-if="event.banner.mime_type.startsWith('image/')"
        :src="bannerSrc"
        aria-hidden="true"
        class="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
      />
      <video
        v-else
        :src="bannerSrc"
        aria-hidden="true"
        class="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
        muted
        playsinline
      />
      <img
        v-if="event.banner.mime_type.startsWith('image/')"
        :src="bannerSrc"
        class="relative z-[1] h-full w-auto max-w-full object-contain"
      />
      <video
        v-else
        :src="bannerSrc"
        class="relative z-[1] h-full w-auto max-w-full object-contain"
        muted
        loop
        autoplay
        playsinline
      />
    </div>

    <div
      v-else
      class="flex h-20 w-60 shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-border/80 hover:bg-accent/30"
      role="button"
      tabindex="0"
      @click="pickFile"
      @keydown.enter.prevent="pickFile"
      @keydown.space.prevent="pickFile"
    >
      <ImagePlus class="h-5 w-5" />
      <span class="font-mono text-[0.6rem] uppercase tracking-[0.16em]">
        {{ $t("event.banner.empty_hint") }}
      </span>
    </div>

    <div class="min-w-[220px] flex-1 space-y-2">
      <div class="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          :disabled="uploading"
          @click="pickFile"
        >
          {{
            event.banner
              ? $t("event.banner.replace")
              : $t("event.banner.upload")
          }}
        </Button>
        <Button
          v-if="event.banner"
          type="button"
          variant="ghost"
          size="sm"
          class="text-destructive"
          :loading="removing"
          :disabled="uploading"
          @click="removeBanner"
        >
          {{ $t("event.banner.remove") }}
        </Button>
      </div>

      <Progress v-if="uploading" :model-value="progress" class="h-1.5" />

      <p class="text-xs text-muted-foreground">
        {{ $t("event.banner.hint") }}
      </p>
    </div>

    <input
      ref="fileInput"
      type="file"
      :accept="BANNER_ACCEPT"
      class="hidden"
      @change="handleFileSelect"
    />

    <ImageCropDialog
      v-model:open="editorOpen"
      :file="editorFile"
      :output-w="1920"
      :output-h="640"
      :fill-color="'#000'"
      allow-fit-whole
      @apply="(blob) => uploadBanner(blob)"
    />
  </div>
</template>
