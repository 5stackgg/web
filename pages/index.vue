<script lang="ts">
export default {
  mounted() {
    if (this.me) {
      return navigateTo("/me");
    }

    return navigateTo("/watch");
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
