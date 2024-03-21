<template>
  <dashboard></dashboard>
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
