<script setup lang="ts">
definePageMeta({
  middleware: [
    function (to, from) {
      return navigateTo("/me");
    },
  ],
});
</script>
