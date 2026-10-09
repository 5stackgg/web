<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Boxes } from "lucide-vue-next";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";
import ClipShareMenu from "~/components/clips/ClipShareMenu.vue";
import UtilityLineupViewer3D from "~/components/utility/UtilityLineupViewer3D.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import { hasMeshForMap } from "~/utilities/mapAssets";
import {
  utilityClipDownload,
  utilityClipSource,
} from "~/utilities/utilityDisplay";
import { useClipFileSize } from "~/composables/useClipFileSize";
import { useUtilityLineupShare } from "~/composables/useUtilityLineupShare";
import type { UtilityLineup } from "~/types/utility";

const props = defineProps<{ lineup: UtilityLineup }>();

const meshCdn = useRuntimeConfig().public.mapMeshCdn as string;

// Watching it beats replaying a lineup nobody filmed, so a clip wins whenever
// there is one. Everything below it is a reconstruction.
const clip = computed(() => utilityClipSource(props.lineup));

const download = computed(() => utilityClipDownload(props.lineup));
const size = useClipFileSize(() =>
  download.value ? props.lineup.preview_url : null,
);

const { copiedLineupId, shareLineup } = useUtilityLineupShare();

function share() {
  void shareLineup(props.lineup.map_name, props.lineup.id);
}

const seconds = computed(() => {
  const ms = Number(props.lineup.preview_duration_ms ?? 0);
  return ms > 0 ? Math.round(ms / 1000) : null;
});

// The clip player never starts itself. Muted, because opening a lineup is
// browsing rather than asking for sound; the tray unmutes it.
const player = ref<InstanceType<typeof ClipPlayer> | null>(null);

watch(
  [clip, player],
  ([src, instance]) => {
    if (src && instance) {
      void instance.play();
    }
  },
  { flush: "post" },
);

const hasMesh = ref(false);

// The renderer decides its mesh mode once on mount, so the 3D view must not
// appear until the probe has answered -- otherwise a map with no mesh shows an
// empty scene rather than falling back to the radar.
watch(
  () => [props.lineup.map_name, clip.value] as const,
  async ([name, clipSrc]) => {
    hasMesh.value = false;
    if (clipSrc || !name || !import.meta.client) {
      return;
    }
    hasMesh.value = await hasMeshForMap(meshCdn, name);
  },
  { immediate: true },
);
</script>

<template>
  <!-- Keyed on the lineup so switching remounts the scene rather than leaving
       the previous throw's camera -- or the previous clip's playhead -- behind. -->
  <div :key="lineup.id" class="flex min-w-0 flex-col gap-2">
    <ClipPlayer
      v-if="clip"
      ref="player"
      :src="clip"
      :poster="lineup.preview_thumbnail_url"
      :clip-key="lineup.id"
      initial-muted
      loop
    >
      <template #top-left>
        <span
          v-if="seconds"
          class="inline-flex h-[26px] items-center rounded-md bg-black/60 px-2 font-mono text-xs font-semibold tabular-nums text-white/90 backdrop-blur-sm"
        >
          {{ seconds }}s
        </span>
      </template>
      <template #top-right>
        <ClipShareMenu
          :copied="copiedLineupId === lineup.id"
          :copy-label="$t('pages.utility.detail.copy_link')"
          :download-href="download?.href"
          :download-name="download?.name"
          :download-label="$t('pages.utility.detail.download_clip')"
          :size-label="size"
          @copy="share"
        />
      </template>
    </ClipPlayer>

    <UtilityLineupViewer3D v-else-if="hasMesh" :lineup="lineup" />

    <template v-else>
      <UtilityRadarBoard
        :map-name="lineup.map_name"
        :lineups="[lineup]"
        :selected-id="lineup.id"
      />
      <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Boxes class="h-3.5 w-3.5 shrink-0" />
        {{ $t("pages.utility.detail.no_mesh") }}
      </p>
    </template>
  </div>
</template>
