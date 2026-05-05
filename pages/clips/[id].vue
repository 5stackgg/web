<script setup lang="ts">
// Deep-link entry — hands off to /highlights?clip=<id> where the
// global modal is mounted.
const route = useRoute();
const raw = route.params.id;
const id = Array.isArray(raw) ? raw[0] : raw;

if (!id) {
  await navigateTo("/highlights", { replace: true, redirectCode: 302 });
} else {
  await navigateTo(
    { path: "/highlights", query: { clip: id } },
    { replace: true, redirectCode: 302 },
  );
}
</script>

<template>
  <div></div>
</template>
