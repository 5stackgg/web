<template>
  <div class="copy">
    <div
      v-if="!target"
      ref="copy"
      class="icon--btn icon--btn-small"
      :data-clipboard-text="data"
    >
      <copy-icon />
    </div>
    <div
      v-else
      ref="copy"
      class="icon--btn icon--btn-small"
      :data-clipboard-target="target"
    >
      <copy-icon />
    </div>
  </div>
</template>

<script>
import ClipboardJS from "clipboard";
import alertStore from "@/stores/alertStore";
import CopyIcon from "@/components/icons/CopyIcon.vue";
import { AlertStatuses } from "@/constants/AlertStatuses";
export default {
  components: { CopyIcon },
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
  margin: 0 10px;
  display: inline;
  svg {
    width: 22px;
    fill: white;
    height: auto;
  }
}
</style>
