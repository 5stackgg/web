<script setup lang="ts">
import { ref } from "vue";
import { Maximize2 } from "lucide-vue-next";
import DesktopSnapshot from "~/components/match/DesktopSnapshot.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";

// Same shape as DesktopSnapshot — forwarded both inline and into the
// enlarged dialog so the quick-view shows the identical live frame, bigger.
withDefaults(
  defineProps<{
    kind: "live" | "demo" | "bake" | "clips";
    id?: string | null;
    alt?: string;
    emptyLabel?: string;
    forceEmpty?: boolean;
    fallbackSeconds?: number;
  }>(),
  {
    id: null,
    alt: "",
    emptyLabel: "",
    forceEmpty: false,
    fallbackSeconds: 30,
  },
);

const open = ref(false);
</script>

<template>
  <div class="group/qv relative h-full w-full">
    <DesktopSnapshot
      :kind="kind"
      :id="id"
      :alt="alt"
      :empty-label="emptyLabel"
      :force-empty="forceEmpty"
      :fallback-seconds="fallbackSeconds"
    />
    <!-- Click anywhere to enlarge; the corner hint makes it discoverable. -->
    <button
      type="button"
      class="absolute inset-0 flex cursor-zoom-in items-start justify-end p-1.5 opacity-0 transition-opacity group-hover/qv:opacity-100 focus-visible:opacity-100"
      :aria-label="$t('match.stream.expand_preview')"
      @click="open = true"
    >
      <span
        class="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-background/70 text-foreground/80 backdrop-blur-sm"
      >
        <Maximize2 class="h-3.5 w-3.5" />
      </span>
    </button>

    <Dialog v-model:open="open">
      <DialogContent
        class="max-w-5xl border-border/60 bg-background/95 p-2 sm:p-3"
      >
        <DialogTitle class="sr-only">
          {{ $t("match.stream.expand_preview") }}
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ $t("match.stream.expand_preview") }}
        </DialogDescription>
        <div class="overflow-hidden rounded-md border border-border/50">
          <DesktopSnapshot
            v-if="open"
            :kind="kind"
            :id="id"
            :alt="alt"
            :empty-label="emptyLabel"
            :force-empty="forceEmpty"
            :fallback-seconds="fallbackSeconds"
          />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
