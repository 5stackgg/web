<script lang="ts" setup>
import { Copy } from "lucide-vue-next";
</script>
<template>
  <div class="copy">
    <div
      v-if="!target"
      ref="copy"
      class="icon--btn icon--btn-small"
      :data-clipboard-text="data"
    >
      <slot>
        <Copy></Copy>
      </slot>
    </div>
    <div
      v-else
      ref="copy"
      class="icon--btn icon--btn-small"
      :data-clipboard-target="target"
    >
      <slot>
        <Copy></Copy>
      </slot>
    </div>
  </div>
</template>

<script lang="ts">
import ClipboardJS from "clipboard";
import alertStore from "~/stores/AlertStore";
import { AlertStatuses } from "@/constants/AlertStatuses";
export default {
  props: {
    target: {
      required: false,
      type: String,
      default: undefined,
    },
    data: {
      required: false,
      type: String,
      default: "",
    },
  },
  data() {
    return {
      clipboard: undefined,
    };
  },
  mounted() {
    if (!this.data && !this.target) {
      console.warn("data missing");
      return;
    }

    this.clipboard = new ClipboardJS(this.$refs["copy"]);

    this.clipboard.on("success", (e) => {
      alertStore().add({
        duration: 1000,
        severity: AlertStatuses.Success,
        title: "Copied to Clipboard",
      });
      e.clearSelection();
    });
  },
  beforeUnmount() {
    if (this.clipboard) {
      this.clipboard.destroy();
    }
  },
};
</script>

<style>
.copy {
  cursor: pointer;
  margin: 0 10px;
  display: inline;
  svg {
    width: 22px;
    height: auto;
  }
}
</style>
