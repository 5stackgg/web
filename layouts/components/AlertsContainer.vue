<template>
  <div class="fixed right-2.5 top-16 w-88 z-50">
    <transition-group name="alert-animation">
      <alert-action
        v-for="alert in alerts"
        :key="alert.id"
        :alert="alert"
      ></alert-action>
    </transition-group>
  </div>
</template>

<script>
import alertStore from "~/stores/AlertStore";
import AlertAction from "~/layouts/components/AlertAction.vue";

export default {
  components: {
    AlertAction,
  },
  computed: {
    alerts() {
      return alertStore().alerts;
    },
  },
};
</script>
