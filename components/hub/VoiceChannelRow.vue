<script setup lang="ts">
import { computed } from "vue";
import { Mic, Radio, Swords, Users, Video } from "lucide-vue-next";
import VoiceRosterPreview from "~/components/voice/VoiceRosterPreview.vue";
import { useChannelPresence } from "~/composables/useChannelPresence";
import type { VoiceChannel } from "~/composables/useVoiceChannels";

// One channel, and the party inside it.
//
// The list used to say only that a channel existed, which is the least useful
// half of the answer -- "your team" is always there, and whether it is worth
// joining depends entirely on who is in it. Presence comes from outside the
// call, so this works before you have joined anything.
//
// The roster uses PlayerDisplay rather than bare avatars so these people look
// like the same people they do everywhere else in the app: same avatar, same
// name treatment, same rank chip. A voice channel is a group of players, and it
// should read as one.
const props = defineProps<{
  channel: VoiceChannel;
  // Already in it, just not from this window.
  elsewhere?: boolean;
  // Tighter chrome for the switcher under a running call.
  compact?: boolean;
}>();

defineEmits<{ (e: "join"): void }>();

const { participants } = useChannelPresence(() => props.channel.id);

const inCall = computed(() =>
  participants.value.filter((participant) => participant.connected),
);

const onCamera = computed(() =>
  participants.value.filter((participant) => participant.video),
);

</script>

<template>
  <div
    class="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40 transition-colors"
    :class="
      inCall.length
        ? 'border-zinc-700/80'
        : ''
    "
  >
    <!-- The header is the action; the roster below is not clickable, so a name
         in it can stay a name rather than becoming part of a button. -->
    <button
      type="button"
      class="group flex w-full items-center gap-2.5 text-left transition-colors hover:bg-[hsl(var(--tac-amber)/0.06)]"
      :class="compact ? 'px-2 py-1.5' : 'px-2.5 py-2'"
      @click="$emit('join')"
    >
      <span
        class="grid shrink-0 place-items-center rounded-md border border-zinc-800 bg-zinc-950/60 text-zinc-500 transition-colors group-hover:border-[hsl(var(--tac-amber)/0.4)] group-hover:text-[hsl(var(--tac-amber))]"
        :class="compact ? 'h-6 w-6' : 'h-7 w-7'"
      >
        <component
          :is="channel.kind === 'lobby' ? Users : Swords"
          :class="compact ? 'h-3 w-3' : 'h-3.5 w-3.5'"
        />
      </span>

      <span class="flex min-w-0 flex-1 flex-col">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-xs font-medium text-zinc-200">
            {{ channel.label }}
          </span>
          <span
            v-if="elsewhere"
            class="shrink-0 rounded-sm border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-1 py-[1px] font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.12em] text-[hsl(var(--tac-amber))]"
          >
            {{ $t("layouts.voice_panel.picker.elsewhere") }}
          </span>
        </span>

        <!-- What is happening in there beats what it is called. -->
        <span
          v-if="!compact"
          class="flex min-w-0 items-center gap-1.5 text-[10px]"
          :class="
            elsewhere
              ? 'text-[hsl(var(--tac-amber)/0.8)]'
              : inCall.length
                ? 'text-emerald-400/80'
                : 'text-zinc-500'
          "
        >
          <template v-if="elsewhere">
            {{ $t("layouts.voice_panel.picker.elsewhere_detail") }}
          </template>
          <template v-else-if="inCall.length">
            <Mic class="h-2.5 w-2.5 shrink-0" />
            {{ $t("layouts.voice_panel.connected", { count: inCall.length }) }}
            <template v-if="onCamera.length">
              <span class="text-zinc-600">·</span>
              <Video class="h-2.5 w-2.5 shrink-0 text-[hsl(var(--tac-amber))]" />
              <span class="text-[hsl(var(--tac-amber))]">
                {{ onCamera.length }}
              </span>
            </template>
          </template>
          <template v-else>
            {{ channel.detail }}
          </template>
        </span>
      </span>

      <Radio
        class="h-3.5 w-3.5 shrink-0 text-zinc-700 transition-colors group-hover:text-[hsl(var(--tac-amber))]"
      />
    </button>

    <!-- Who is in there. Hidden when nobody is: an empty roster reads as broken
         rather than quiet. -->
    <div
      v-if="!compact && inCall.length"
      class="border-t border-zinc-800/80 bg-zinc-950/40 px-2 py-1.5"
    >
      <VoiceRosterPreview :channel-id="channel.id" />
    </div>
  </div>
</template>
