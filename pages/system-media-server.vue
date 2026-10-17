<script setup lang="ts">
import MediaServerStats from "~/components/system-media-server/MediaServerStats.vue";
import MediaServerResources from "~/components/system-media-server/MediaServerResources.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";

// Its own page rather than a section of System -> Metrics. That page answers
// "how much CPU and memory is each deployment using", mediamtx among them; this
// answers "what is the media server actually carrying" -- paths, sessions, and
// which feature they belong to. Same box, different question.
definePageMeta({
  middleware: ["admin"],
});
</script>

<template>
  <h1 class="sr-only">{{ $t("pages.system_media_server.title") }}</h1>

  <!-- One wrapper for the whole page: the sections' hairlines come from
       being siblings, so they cannot each sit in their own transition. -->
  <PageTransition>
    <div class="grid gap-8">
      <MediaServerStats />
      <MediaServerResources />
    </div>
  </PageTransition>
</template>
