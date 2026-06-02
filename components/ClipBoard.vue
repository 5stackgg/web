<script lang="ts" setup>
import { Copy, Check } from "lucide-vue-next";
</script>
<template>
  <Button variant="outline" size="icon" @click="copyToClipboard">
    <div
      ref="copy"
      :data-clipboard-text="data"
      class="relative inline-flex items-center justify-center"
    >
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 scale-50 -rotate-90"
        enter-to-class="opacity-100 scale-100 rotate-0"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-50"
      >
        <span
          v-if="copied"
          class="absolute inset-0 flex items-center justify-center"
        >
          <Check class="text-green-500" />
        </span>
      </Transition>
      <span
        class="inline-flex items-center justify-center transition-all duration-300 ease-out"
        :class="copied ? 'scale-50 opacity-0 blur-[1px]' : ''"
      >
        <slot>
          <Copy></Copy>
        </slot>
      </span>
    </div>
  </Button>
</template>

<script lang="ts">
import { toast } from "@/components/ui/toast";
export default {
  props: {
    data: {
      required: false,
      type: String,
      default: "",
    },
  },
  data() {
    return {
      copied: false,
    };
  },
  beforeUnmount() {
    if (this.copiedTimer) {
      clearTimeout(this.copiedTimer);
    }
  },
  methods: {
    copyToClipboard() {
      void this.performCopy();
    },
    async performCopy() {
      if (!this.data) {
        console.warn("data missing");
        return;
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(this.data);
        } else {
          this.fallbackCopyToClipboard(this.data);
        }
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        this.fallbackCopyToClipboard(this.data);
      }

      this.showCopied();
      toast({
        title: this.$t("pages.toasts.copied_to_clipboard"),
      });
    },

    showCopied() {
      this.copied = true;
      if (this.copiedTimer) {
        clearTimeout(this.copiedTimer);
      }
      this.copiedTimer = setTimeout(() => {
        this.copied = false;
        this.copiedTimer = undefined;
      }, 1500);
    },

    fallbackCopyToClipboard(text) {
      // Create a temporary textarea element
      const textArea = document.createElement("textarea");
      textArea.value = text;

      // Make it invisible
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);

      // Select and copy the text
      textArea.focus();
      textArea.select();

      try {
        document.execCommand("copy");
      } catch (err) {
        console.error("Fallback copy failed:", err);
      }

      document.body.removeChild(textArea);
    },
  },
};
</script>
