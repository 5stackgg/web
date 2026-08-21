<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Boxes } from "lucide-vue-next";
import UtilityLineupViewer3D from "~/components/utility/UtilityLineupViewer3D.vue";
import UtilityPreviewClip from "~/components/utility/UtilityPreviewClip.vue";
import UtilityRadarBoard from "~/components/utility/UtilityRadarBoard.vue";
import { hasMeshForMap } from "~/utilities/mapAssets";
import { utilityClipSource } from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

const props = defineProps<{ lineup: UtilityLineup }>();

const meshCdn = useRuntimeConfig().public.mapMeshCdn as string;

// Watching it beats replaying a lineup nobody filmed, so a clip wins whenever
// there is one. Everything below it is a reconstruction.
const clip = computed(() => utilityClipSource(props.lineup));

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
    <UtilityPreviewClip
      v-if="clip"
      variant="full"
      :src="clip"
      :poster="lineup.preview_thumbnail_url"
      :duration-ms="lineup.preview_duration_ms"
    />

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
