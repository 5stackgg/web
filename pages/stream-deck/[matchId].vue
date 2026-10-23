<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft } from "lucide-vue-next";
import BackLink from "~/components/common/BackLink.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import TopoBackground from "~/layouts/components/TopoBackground.vue";
import BroadcastDeck from "~/components/stream-deck/BroadcastDeck.vue";
import { announceFocusWindow } from "~/composables/useStreamerPopout";
import { useStreamerStore } from "~/stores/StreamerStore";

definePageMeta({
  middleware: "streamer",
  // The focus window: every pixel goes to the broadcast.
  layout: false,
});

const route = useRoute();
const matchId = computed(() => String(route.params.matchId));

const streamerStore = useStreamerStore();
streamerStore.subscribeToLiveStreams();
const stream = computed<any | null>(
  () =>
    (streamerStore.liveStreams ?? []).find(
      (s: any) => s?.match_id === matchId.value,
    ) ?? null,
);

// Tell the Control Room this window owns the match, so it pauses its own
// player while we're up.
let stopAnnouncing: (() => void) | null = null;
onMounted(() => {
  stopAnnouncing = announceFocusWindow(matchId.value);
});
watch(matchId, (id) => {
  stopAnnouncing?.();
  stopAnnouncing = announceFocusWindow(id);
});
onBeforeUnmount(() => stopAnnouncing?.());

function onSwitched(id: string) {
  void navigateTo(`/stream-deck/${id}`);
}
</script>

<template>
  <!-- layout: false drops the app shell, so the standard background comes in
       explicitly rather than leaving this page on flat black. -->
  <TopoBackground />

  <div class="relative z-10 flex min-h-screen flex-col text-foreground">
    <PageTransition>
      <header
        class="flex-shrink-0 border-b border-border/60 bg-background/70 backdrop-blur-sm"
      >
        <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <BackLink
            to="/stream-deck"
            class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <ArrowLeft class="size-4" />
            {{ $t("layouts.app_nav.administration.control_room") }}
          </BackLink>
          <span class="h-5 w-px bg-border" aria-hidden="true" />
          <h1 class="min-w-0 truncate text-base font-semibold">
            {{ stream?.match?.lineup_1?.name ?? $t("common.team_a") }}
            <span class="mx-1 font-normal text-muted-foreground">{{
              $t("common.vs")
            }}</span>
            {{ stream?.match?.lineup_2?.name ?? $t("common.team_b") }}
          </h1>
        </div>
      </header>
    </PageTransition>

    <PageTransition :step="1" class="flex-1">
      <div class="mx-auto w-full max-w-7xl px-4 py-5">
        <BroadcastDeck
          :key="matchId"
          :match-id="matchId"
          @switched="onSwitched"
        />
      </div>
    </PageTransition>
  </div>
</template>
