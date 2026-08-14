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
  <div class="relative space-y-8 [--tac-clip:14px] [--tac-clip-sm:10px]">
    <PageTransition :delay="0">
      <section class="space-y-4">
        <header class="border-b border-border/60 pb-3">
          <h2 class="text-sm font-semibold">
            {{ $t("pages.system_media_server.title") }}
          </h2>
          <p class="mt-1 text-xs text-muted-foreground">
            {{ $t("pages.system_media_server.description") }}
          </p>
        </header>

        <MediaServerStats />
      </section>
    </PageTransition>

    <!-- What it is carrying, then what that costs the box. Same charts the node
         and service views use, so an admin comparing the two pages is not
         translating between two visual languages. -->
    <PageTransition :delay="60">
      <section class="space-y-4">
        <header class="border-b border-border/60 pb-3">
          <h2 class="text-sm font-semibold">
            {{ $t("pages.system_media_server.resources") }}
          </h2>
        </header>

        <MediaServerResources />
      </section>
    </PageTransition>
  </div>
</template>
