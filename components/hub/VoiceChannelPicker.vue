<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Plus } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { useVoiceSession } from "~/composables/useVoiceSession";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import { useVoiceElsewhere } from "~/composables/useVoiceElsewhere";
import { useVoiceChannels, type VoiceChannel } from "~/composables/useVoiceChannels";
import VoiceChannelRow from "~/components/hub/VoiceChannelRow.vue";

// Where you can talk, when you are not talking anywhere.
//
// The panel used to say "you are not in a channel" and stop, which is true and
// useless: the answer to "so how do I get into one" was to go and find the
// right page. Every channel a player is entitled to is already known here --
// their party, and any match or draft they are rostered on -- so this offers
// them directly, and doubles as the way to move between them.
// Two jobs, one list. With no call running this is the way in; with one running
// it is the way across -- the same channels, minus the one you are already in.
// Switching used to mean leaving first and then finding the other surface.
const props = defineProps<{ switcher?: boolean }>();

const session = useVoiceSession();
const registry = useActiveVoiceChannel();
const { t: $t } = useI18n();

// The registry rather than the session: a call held in another tab is still
// yours, and offering to "switch" to the channel you are already in is noise.
const currentId = computed(() => registry.session.value?.id ?? null);

// Where the server says this player already is. The tab bridge above only sees
// tabs of one browser profile; this sees every window, browser and device.
const elsewhere = useVoiceElsewhere();

// Resolved once, shared with the announcer -- a toast that names a channel and
// a list that offers it must not disagree about what it is called.
const { channels: allChannels } = useVoiceChannels();

const channels = computed(() =>
  allChannels.value.filter((channel) => channel.id !== currentId.value),
);

function heldElsewhere(id: string) {
  return elsewhere.channelId.value === id && currentId.value !== id;
}



async function join(channel: VoiceChannel) {
  await session.join(channel.id, channel.label, channel.kind);
  // The server's answer would otherwise lag a poll behind the join.
  void elsewhere.refresh();
}
</script>

<template>
  <!-- Anchored to the top and led by the list. The absence of a call is already
       obvious from the panel being empty, so an icon and a centred "not in a
       voice channel" were decoration in front of the only useful thing here. -->
  <div
    v-if="channels.length || !switcher"
    class="flex flex-col gap-2 px-3 py-3"
    :class="switcher ? '' : 'flex-1'"
  >
    <template v-if="channels.length">
      <p
        class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-zinc-600"
      >
        {{
          switcher
            ? $t("layouts.voice_panel.picker.switch")
            : $t("layouts.voice_panel.picker.available")
        }}
      </p>

      <!-- Channels come and go on their own -- a party forms, a match ends --
           so the list changes without anyone touching it. Sliding rather than
           blinking is what says the list changed rather than the panel
           re-rendering. -->
      <TransitionGroup
        tag="div"
        class="flex flex-col gap-2"
        enter-active-class="transition-[opacity,transform] [transition-duration:300ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
        leave-active-class="transition-[opacity,transform] [transition-duration:160ms] ease-in motion-reduce:![transition-duration:1ms]"
        move-class="transition-transform [transition-duration:300ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
        enter-from-class="opacity-0 translate-y-2"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <VoiceChannelRow
          v-for="channel in channels"
          :key="channel.id"
          :channel="channel"
          :elsewhere="heldElsewhere(channel.id)"
          :compact="switcher"
          @join="join(channel)"
        />
      </TransitionGroup>
    </template>

    <!-- Nothing to join, so the only useful thing left is making one. Never
         shown as a switcher: "start a party" under a running call is not the
         next thing anyone wants. -->
    <template v-else-if="!switcher">
      <p class="text-[11px] leading-relaxed text-zinc-500">
        {{ $t("layouts.voice_panel.picker.nothing") }}
      </p>
      <Button
        variant="outline"
        size="sm"
        class="w-full gap-1.5 border-zinc-700 bg-zinc-900/80 text-[11px] hover:bg-zinc-800/80"
        @click="navigateTo('/play')"
      >
        <Plus class="h-3.5 w-3.5" />
        {{ $t("layouts.voice_panel.picker.start_party") }}
      </Button>
    </template>
  </div>
</template>
