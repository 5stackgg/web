<script setup lang="ts">
import ClipTile from "~/components/clips/ClipTile.vue";
import {
  DEMO_CLIPS,
  KNIFE_CLIP,
  KNIFE_CLIP_VIDEO,
} from "~/utilities/landing/demoClips";
import { useDemoFaces } from "~/utilities/landing/demoFaces";

const { dress } = useDemoFaces();
const clips = DEMO_CLIPS.map((clip) => ({
  ...clip,
  target: dress(clip.target),
}));
</script>

<template>
  <div class="grid gap-3">
    <figure class="m-0 grid gap-2">
      <ClipTile inert :clip="KNIFE_CLIP" :preview="KNIFE_CLIP_VIDEO" />
      <figcaption class="text-[12.5px] text-muted-foreground">
        {{ $t("pages.welcome.rewatch.example_caption") }}
      </figcaption>
    </figure>
    <div inert class="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
      <ClipTile v-for="clip in clips" :key="clip.id" :clip="clip" />
    </div>
  </div>
</template>
