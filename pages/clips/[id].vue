<script setup lang="ts">
// Deep-link entry point. The clip viewer lives in a global modal
// (components/clips/ClipDetailModal.vue) driven by the URL's
// `?clip=<id>` query param. Visiting /clips/<id> directly should
// hand off to /highlights?clip=<id> so the modal opens over the
// canonical browse surface — same UI as clicking a card from
// /highlights.
//
// Server-side: a 302 means a shared link arrives at /highlights with
// the modal already mounted, no flash of empty page.
// Client-side: replaceState (replace: true) so the browser back
// button doesn't ping-pong /clips/<id> ↔ /highlights.
const route = useRoute();
const id = String(route.params.id);

await navigateTo(
  { path: "/highlights", query: { clip: id } },
  { replace: true, redirectCode: 302 },
);
</script>

<template>
  <div></div>
</template>
