<template>
  <div v-click-away="close" @keyup.esc="close()">
    <div @click.stop.prevent="toggle()">
      <slot />
    </div>
    <div v-show="showConfirmDialog">
      <div>
        <div @click="confirm">Confirm</div>
        <div @click="close">Cancel</div>
      </div>
    </div>
  </div>
</template>

<script>
import clickAway from "@/directives/clickAway";

export default {
  directives: {
    clickAway,
  },
  props: {
    confirmMessage: {
      required: false,
      type: String,
      default: undefined,
    },
    confirmAction: {
      required: true,
      type: Function,
    },
  },
  data() {
    return {
      confirmedText: "",
      showConfirmDialog: false,
    };
  },
  methods: {
    toggle() {
      this.showConfirmDialog = !this.showConfirmDialog;
    },
    close() {
      this.showConfirmDialog = false;
    },
    confirm() {
      this.confirmAction();
      this.close();
    },
  },
};
</script>
