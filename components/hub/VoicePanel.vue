<script setup lang="ts">
import VoiceChannelCard from "~/components/voice/VoiceChannelCard.vue";
import VoiceChannelPicker from "~/components/hub/VoiceChannelPicker.vue";
import { currentHub } from "~/composables/useHubState";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";

// The call, seen from outside whatever opened it. The connection itself belongs
// to the surface that joined -- a match page, the lobby panel, a draft room --
// and that surface can be navigated away from while the call keeps running, so
// this reads the registry rather than holding a session of its own.
//
// The controls themselves are VoiceChannelCard's, not this panel's. This used
// to draw its own arrangement of them and so did the lobby panel and the match
// page, which meant the same call offered a different set of buttons depending
// on where you happened to be looking at it from.
const { session } = useActiveVoiceChannel();

// The hub keeps every panel it has ever opened mounted and hides it with
// v-show, so being mounted proves nothing about being on screen. Handed to the
// card, which is what Picture-in-Picture follows.
function onScreen() {
  return useRightSidebar().rightSidebarOpen.value && currentHub() === "voice";
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-shrink-0 border-b border-border px-3 pb-3 pt-3">
      <div
        class="flex items-center gap-[0.4rem] font-mono text-[0.62rem] font-bold uppercase tracking-[0.24em] text-muted-foreground"
      >
        <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]"></span>
        {{ $t("layouts.hub.voice") }}
      </div>
    </div>

    <!-- Being in a call and not being in one are the two states this panel
         has, and it used to cut between them on a frame. Same curve as the
         voice card itself, so the hub and the page agree about what joining
         looks like. -->
    <!-- The leave is 110ms on purpose: the card inside the dying branch is
         still live and starts morphing into its not-joined state the moment
         the session clears. Its own fade-out runs 110ms too, so everything
         visible during the branch fade is only ever fading -- the Join button
         and roster that enter after it land in a branch already invisible. -->
    <Transition
      mode="out-in"
      enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      leave-active-class="transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
      enter-from-class="opacity-0 translate-y-2"
      leave-to-class="opacity-0 -translate-y-1"
    >
    <div v-if="session" key="call" class="flex min-h-0 flex-1 flex-col">
      <!-- The other channels you could be in, while you are in one. Switching
           used to mean hanging up first and then going to find the other
           surface; the session retargets in place, so it never needed to.
           `exclude` pins the hidden row to this branch's channel, so hanging
           up does not slide it back into the list mid-fade. -->
      <VoiceChannelPicker
        switcher
        :exclude="session.id"
        class="flex-shrink-0 border-b border-border/60"
      />

      <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <VoiceChannelCard
          show-empty
          :framed="false"
          :kind="session.kind ?? 'match'"
          :channel-id="session.id"
          :label="session.label"
          :visible-when="onScreen"
        />
      </div>
    </div>

      <!-- Wrapped in a plain element on purpose. mode="out-in" waits for the
           leaving child to report its transition finished, and it cannot do
           that for a component whose own root is a v-if -- that root may be a
           comment, there is nothing to attach to, the leave never completes and
           so the enter never starts. The panel stays blank permanently.
           Nothing to control until they are in a channel, so rather than
           describing where channels come from, offer the ones they already
           have. See VoiceChannelPicker. -->
      <div v-else key="picker" class="flex min-h-0 flex-1 flex-col">
        <VoiceChannelPicker />
      </div>
    </Transition>
  </div>
</template>
