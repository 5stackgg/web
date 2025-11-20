<script setup lang="ts">
import StreamEmbed from "~/components/StreamEmbed.vue";
import { Cross2Icon } from "@radix-icons/vue";
</script>

<template>
  <div
    v-if="stream"
    class="fixed bottom-4 right-4 z-50 rounded-lg overflow-hidden shadow-2xl border border-border bg-background"
    :style="containerStyle"
  >
    <div :class="{ 'pointer-events-none': isResizing }">
      <StreamEmbed :streams="[stream]" />
    </div>
    <div
      class="absolute top-0 left-0 w-6 h-6 cursor-nwse-resize bg-border hover:bg-primary/50 transition-colors z-10 flex items-center justify-center"
      @mousedown="startResize"
    >
      <div class="w-3 h-3 border-l-2 border-t-2 border-foreground/40"></div>
    </div>
    <button
      class="absolute top-2 right-2 w-6 h-6 rounded-sm opacity-70 hover:opacity-100 transition-opacity bg-background/80 hover:bg-background border border-border flex items-center justify-center z-10"
      @click="closePreview"
      type="button"
    >
      <Cross2Icon class="w-4 h-4" />
      <span class="sr-only">Close</span>
    </button>
  </div>
</template>

<script lang="ts">
export default {
  data() {
    return {
      width: 400,
      height: 225,
      isResizing: false,
      resizeStart: { x: 0, y: 0, width: 0, height: 0 },
      maxWidth: 400,
    };
  },
  computed: {
    stream() {
      return useApplicationSettingsStore().streamPreview;
    },
    containerStyle() {
      return {
        width: `${this.width}px`,
        height: `${this.height}px`,
      };
    },
  },
  methods: {
    updateMaxWidth() {
      this.maxWidth = Math.max(400, window.innerWidth - 32);
    },
    calculateInitialSize() {
      const minWidth = 400;
      const aspectRatio = 16 / 9;

      const maxAvailableWidth = window.innerWidth - 32;
      const maxAvailableHeight = window.innerHeight - 32;

      let initialWidth = Math.max(
        minWidth,
        Math.min(600, Math.floor(window.innerWidth * 0.25)),
      );

      initialWidth = Math.min(initialWidth, maxAvailableWidth);

      let initialHeight = initialWidth / aspectRatio;
      if (initialHeight > maxAvailableHeight) {
        initialHeight = maxAvailableHeight;
        initialWidth = Math.max(
          minWidth,
          Math.min(maxAvailableWidth, initialHeight * aspectRatio),
        );
      }

      this.width = initialWidth;
      this.height = initialWidth / aspectRatio;
    },
    closePreview() {
      useApplicationSettingsStore().setStreamPreview();
    },
    startResize(e: MouseEvent) {
      this.isResizing = true;
      this.resizeStart = {
        x: e.clientX,
        y: e.clientY,
        width: this.width,
        height: this.height,
      };
      e.preventDefault();
      e.stopPropagation();
    },
    handleResize(e: MouseEvent) {
      if (!this.isResizing) {
        return;
      }

      const deltaX = this.resizeStart.x - e.clientX;
      const deltaY = this.resizeStart.y - e.clientY;

      const minWidth = 400;
      const aspectRatio = 16 / 9;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        this.width = Math.max(
          minWidth,
          Math.min(this.maxWidth, this.resizeStart.width + deltaX),
        );
        this.height = this.width / aspectRatio;
        return;
      }

      this.height = this.resizeStart.height + deltaY;
      this.width = Math.max(
        minWidth,
        Math.min(this.maxWidth, this.height * aspectRatio),
      );
      this.height = this.width / aspectRatio;
    },
    handleWindowResize() {
      this.updateMaxWidth();

      const minWidth = 400;
      const aspectRatio = 16 / 9;

      if (this.width > this.maxWidth) {
        this.width = Math.max(minWidth, this.maxWidth);
        this.height = this.width / aspectRatio;
      }

      const maxHeight = window.innerHeight - 32; // Account for bottom-4 margin
      if (this.height > maxHeight) {
        this.height = maxHeight;
        this.width = Math.max(
          minWidth,
          Math.min(this.maxWidth, this.height * aspectRatio),
        );
        this.height = this.width / aspectRatio;
      }
    },
    stopResize() {
      this.isResizing = false;
    },
  },
  mounted() {
    this.updateMaxWidth();

    this.calculateInitialSize();

    document.addEventListener("mousemove", this.handleResize);
    document.addEventListener("mouseup", this.stopResize);
    window.addEventListener("resize", this.handleWindowResize);

    this.$nextTick(() => {
      this.handleWindowResize();
    });
  },
  beforeUnmount() {
    document.removeEventListener("mousemove", this.handleResize);
    document.removeEventListener("mouseup", this.stopResize);
    window.removeEventListener("resize", this.handleWindowResize);
  },
};
</script>
