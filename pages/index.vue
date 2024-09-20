<script setup lang="ts">
definePageMeta({
  middleware: [
    function (to, from) {
      return navigateTo("/matches");
    },
  ],
});
</script>

<template></template>

<script lang="ts">
export default {};
</script>
