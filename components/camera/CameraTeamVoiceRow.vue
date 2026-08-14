<script setup lang="ts">
import { ref } from "vue";
import { LucideRadioTower } from "lucide-vue-next";
import MatchVoicePanel from "~/components/match/MatchVoicePanel.vue";
import type { MicPipeline } from "~/composables/useMicPipeline";

// Sharing a camera is not joining a call: the feed goes to the observer HUD and
// to organizers, never to teammates. Same microphone, second destination -- so
// the keys sit next to the mic they belong to.
defineProps<{ pipeline: MicPipeline; lineupId: string }>();

const panelRef = ref<{ activate: () => void } | null>(null);

function toggle() {
  panelRef.value?.activate();
}
</script>

<template>
  <div
    class="flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-card/40 px-3 py-2 transition-colors hover:border-border/80 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    role="button"
    tabindex="0"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <div class="flex min-w-0 items-center gap-2.5">
      <span
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"
      >
        <LucideRadioTower class="h-3.5 w-3.5" />
      </span>

      <div class="flex min-w-0 flex-col">
        <span class="truncate text-xs font-medium">
          {{ $t("voice.team_voice") }}
        </span>
        <span class="truncate text-[10px] text-muted-foreground">
          {{ $t("camera.voice_hint") }}
        </span>
      </div>
    </div>

    <span class="shrink-0" @click.stop>
      <MatchVoicePanel
        ref="panelRef"
        inline
        hide-settings
        :pipeline="pipeline"
        :lineup-id="lineupId"
        :label="$t('chat.your_team')"
      />
    </span>
  </div>
</template>
