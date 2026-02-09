<script lang="ts" setup>
import { Copy } from "lucide-vue-next";
</script>
<template>
  <Button
    variant="outline"
    size="icon"
    @click="copyToClipboard"
  >
    <div ref="copy" :data-clipboard-text="data">
      <slot>
        <Copy></Copy>
      </slot>
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
  methods: {
    async copyToClipboard() {
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

        toast({
          title: this.$t("pages.toasts.copied_to_clipboard"),
        });
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        this.fallbackCopyToClipboard(this.data);
        toast({
          title: this.$t("pages.toasts.copied_to_clipboard"),
        });
      }
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
