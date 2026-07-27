<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Film, Link2, Upload, Youtube } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { Spinner } from "~/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { parseExternalMedia } from "~/utilities/externalMedia";
import { videoToken } from "~/utilities/newsMarkdown";

/**
 * Builds the `@[video](…)` token the markdown editor inserts, either from a
 * pasted link (YouTube/Twitch embed, anything else falls back to a link) or
 * from an uploaded mp4 with an auto-captured poster.
 */
const open = defineModel<boolean>("open", { required: true });

const emit = defineEmits<{
  (e: "insert", token: string): void;
}>();

const tab = ref<"link" | "upload">("link");
const linkUrl = ref("");

const uploadedSrc = ref<string | null>(null);
const uploadedPoster = ref<string | null>(null);
const percent = ref(0);
const fileInput = ref<HTMLInputElement | null>(null);
const posterInput = ref<HTMLInputElement | null>(null);

const {
  upload: uploadVideo,
  uploading,
  accept: VIDEO_ACCEPT,
} = useNewsVideoUpload();
const { upload: uploadImage, uploading: uploadingPoster, accept: IMAGE_ACCEPT } =
  useNewsImageUpload();

watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }
  tab.value = "link";
  linkUrl.value = "";
  uploadedSrc.value = null;
  uploadedPoster.value = null;
  percent.value = 0;
});

const trimmedLink = computed(() => linkUrl.value.trim());

const linkPreview = computed(() => {
  if (!trimmedLink.value || !/^https?:\/\//i.test(trimmedLink.value)) {
    return null;
  }
  return parseExternalMedia(
    trimmedLink.value,
    import.meta.client ? window.location.hostname : "",
  );
});

const canInsert = computed(() =>
  tab.value === "link" ? !!linkPreview.value : !!uploadedSrc.value,
);

async function onVideoSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }

  percent.value = 0;
  const result = await uploadVideo(file, {
    onProgress: (value) => (percent.value = value),
  });
  if (result) {
    uploadedSrc.value = result.src;
    uploadedPoster.value = result.poster;
  }
}

async function onPosterSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }
  const url = await uploadImage(file);
  if (url) {
    uploadedPoster.value = url;
  }
}

function insert() {
  const token =
    tab.value === "link"
      ? videoToken(trimmedLink.value)
      : videoToken(uploadedSrc.value!, uploadedPoster.value);
  emit("insert", token);
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ $t("pages.news.form.video.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("pages.news.form.video.description") }}
        </DialogDescription>
      </DialogHeader>

      <!-- Dialog tab strip: no page content swaps, so nothing to reserve. -->
      <Tabs v-model="tab" :scroll-floor="false">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="link">
            <span class="inline-flex items-center gap-2">
              <Link2 class="h-4 w-4" />
              {{ $t("pages.news.form.video.tab_link") }}
            </span>
          </TabsTrigger>
          <TabsTrigger value="upload">
            <span class="inline-flex items-center gap-2">
              <Upload class="h-4 w-4" />
              {{ $t("pages.news.form.video.tab_upload") }}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="link" class="space-y-3 pt-3">
          <Input
            v-model="linkUrl"
            type="url"
            placeholder="https://youtu.be/…"
            autocomplete="off"
          />
          <p
            v-if="!linkPreview"
            class="text-xs text-muted-foreground"
          >
            {{ $t("pages.news.form.video.link_hint") }}
          </p>
          <div
            v-else
            class="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 p-3"
          >
            <Youtube
              v-if="linkPreview.provider === 'youtube'"
              class="h-5 w-5 shrink-0 text-[hsl(var(--tac-amber))]"
            />
            <Film v-else class="h-5 w-5 shrink-0 text-muted-foreground" />
            <div class="min-w-0 text-sm">
              <p class="truncate font-medium">{{ linkPreview.hostname }}</p>
              <p class="text-xs text-muted-foreground">
                {{
                  linkPreview.embedUrl
                    ? $t("pages.news.form.video.will_embed")
                    : $t("pages.news.form.video.will_link")
                }}
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="upload" class="space-y-3 pt-3">
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            :accept="VIDEO_ACCEPT"
            @change="onVideoSelected"
          />
          <input
            ref="posterInput"
            type="file"
            class="hidden"
            :accept="IMAGE_ACCEPT"
            @change="onPosterSelected"
          />

          <Button
            type="button"
            variant="outline"
            class="w-full"
            :disabled="uploading"
            @click="fileInput?.click()"
          >
            <Spinner v-if="uploading" class="mr-2 h-4 w-4" />
            <Upload v-else class="mr-2 h-4 w-4" />
            {{ $t("pages.news.form.video.choose_file") }}
          </Button>

          <div v-if="uploading" class="space-y-1">
            <Progress :model-value="percent" />
            <p class="text-xs text-muted-foreground">
              {{ $t("pages.news.form.video.uploading", { percent }) }}
            </p>
          </div>

          <p class="text-xs text-muted-foreground">
            {{ $t("pages.news.form.video.upload_hint") }}
          </p>

          <div v-if="uploadedSrc" class="space-y-2">
            <div
              class="aspect-video w-full overflow-hidden rounded-md border border-border/60 bg-background/60"
            >
              <img
                v-if="uploadedPoster"
                :src="uploadedPoster"
                alt=""
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center text-muted-foreground"
              >
                <Film class="h-8 w-8" />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              :disabled="uploadingPoster"
              @click="posterInput?.click()"
            >
              <Spinner v-if="uploadingPoster" class="mr-2 h-4 w-4" />
              {{ $t("pages.news.form.video.replace_poster") }}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button type="button" variant="ghost" @click="open = false">
          {{ $t("common.cancel") }}
        </Button>
        <Button type="button" :disabled="!canInsert || uploading" @click="insert">
          {{ $t("pages.news.form.video.insert") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
