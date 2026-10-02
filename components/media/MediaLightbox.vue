<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import ClipPlayer from "~/components/clips/ClipPlayer.vue";

const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  kind: "image" | "video";
  src: string;
  title?: string | null;
  caption?: string | null;
  poster?: string | null;
  mediaKey?: string;
}>();

const player = ref<InstanceType<typeof ClipPlayer> | null>(null);

watch(open, async (value) => {
  if (!value || props.kind !== "video") {
    return;
  }

  await nextTick();
  player.value?.play();
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-w-5xl border-border/60 bg-black/90 p-2 sm:p-3"
      data-right-hub-interactive
    >
      <DialogTitle class="sr-only">
        {{ title }}
      </DialogTitle>
      <img
        v-if="kind === 'image'"
        :src="src"
        :alt="title ?? ''"
        class="max-h-[80vh] w-full rounded object-contain"
      />
      <ClipPlayer
        v-else
        ref="player"
        :src="src"
        :poster="poster"
        :clip-key="mediaKey ?? src"
      />
      <p
        v-if="caption"
        class="px-1 pb-1 text-center font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ caption }}
      </p>
    </DialogContent>
  </Dialog>
</template>
