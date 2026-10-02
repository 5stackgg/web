<script setup lang="ts">
// A public server's page is its dedicated server page; old links land there.
definePageMeta({
  redirect: (to) => ({
    path: `/dedicated-servers/${to.params.id}`,
    query: to.query,
  }),
});
</script>

<template>
  <div />
</template>
