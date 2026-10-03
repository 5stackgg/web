<script setup lang="ts">
import { computed, ref, watch } from "vue";
import MediaLightbox from "~/components/media/MediaLightbox.vue";
import { eventMediaUrl } from "~/composables/useEventMediaUpload";
import { useMediaPlayback } from "~/composables/useMediaPlayback";

type EventMedia = {
  id: string;
  filename?: string | null;
  mime_type?: string | null;
  title?: string | null;
  thumbnail_filename?: string | null;
  external_url?: string | null;
};

// One lightbox for a whole media list, so left/right (or the edge buttons)
// walk the gallery in grid order. It steps over what a lightbox can't show
// -- audio and external links -- and plays uploaded videos in place.
const props = defineProps<{
  event: { id: string };
  items: EventMedia[];
}>();

const mediaId = defineModel<string | null>("mediaId", { default: null });

const playback = useMediaPlayback();

function isVideo(item: EventMedia) {
  return !!item.mime_type?.startsWith("video/");
}

function isViewable(item: EventMedia) {
  if (item.external_url || !item.filename) return false;
  return !item.mime_type?.startsWith("audio/");
}

const gallery = computed(() => props.items.filter(isViewable));
const index = computed(() =>
  gallery.value.findIndex((item) => item.id === mediaId.value),
);
const current = computed(() => gallery.value[index.value] ?? null);
const previous = computed(() =>
  index.value > 0 ? gallery.value[index.value - 1] : null,
);
const next = computed(() =>
  index.value >= 0 ? (gallery.value[index.value + 1] ?? null) : null,
);

// Keeps rendering the last item while the dialog fades out.
const shown = ref<EventMedia | null>(null);

watch(
  current,
  (item) => {
    if (item) shown.value = item;
    // Deleted from under the lightbox: close it.
    else if (mediaId.value) mediaId.value = null;
  },
  { immediate: true },
);

const open = computed({
  get: () => !!current.value,
  set: (value: boolean) => {
    if (!value) mediaId.value = null;
  },
});

const src = computed(() =>
  shown.value?.filename
    ? eventMediaUrl(props.event.id, shown.value.filename)
    : "",
);
const poster = computed(() =>
  shown.value?.thumbnail_filename
    ? eventMediaUrl(props.event.id, shown.value.thumbnail_filename)
    : null,
);
</script>

<template>
  <MediaLightbox
    v-model:open="open"
    :kind="shown && isVideo(shown) ? 'video' : 'image'"
    :src="src"
    :poster="poster"
    :title="shown?.title || shown?.filename"
    :caption="shown?.title"
    :media-key="shown?.id"
    :has-previous="!!previous"
    :has-next="!!next"
    @previous="previous && (mediaId = previous.id)"
    @next="next && (mediaId = next.id)"
    @play="current && playback.claim(`lightbox-${current.id}`)"
  />
</template>
