<template>
  <template v-if="me">
    <dashboard></dashboard>
  </template>
  <template v-else> </template>
</template>

<script>
import Dashboard from "~/pages/dashboard.vue";

export default {
  components: { Dashboard },
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
