<template>
  <transition name="fade">
    <div v-show="alert" class="alert" :class="alert.severity">
      <button class="alert-close" type="button" @click="close(alert)">
        <span>&times;</span>
      </button>
      <h4 v-if="alert.title" class="alert-heading">
        {{ alert.title }}
      </h4>
      <div class="alert-text" v-html="alert.message"></div>
    </div>
  </transition>
</template>

<script>
import alertStore from "@/stores/alertStore";

export default {
  props: {
    alert: {
      required: true,
      type: Object,
    },
  },
  created() {
    setTimeout(() => {
      if (this.alert.duration && this.alert.duration > 0) {
        this.close();
      }
    }, this.alert.duration);
  },
  methods: {
    close() {
      alertStore().remove(this.alert);
    },
  },
};
</script>
