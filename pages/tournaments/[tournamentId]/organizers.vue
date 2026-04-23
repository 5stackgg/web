<script setup lang="ts">
definePageMeta({
  middleware(to) {
    return navigateTo(
      {
        path: `/tournaments/${String(to.params.tournamentId)}`,
        query: {
          ...to.query,
          tab: "organizers",
        },
        hash: to.hash,
      },
      { replace: true },
    );
  },
});
</script>

<template>
  <div />
</template>
