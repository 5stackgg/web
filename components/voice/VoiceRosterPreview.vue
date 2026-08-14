<script setup lang="ts">
import { computed } from "vue";
import { Mic, MicOff, Video } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { useChannelPresence } from "~/composables/useChannelPresence";

// Who is in a voice channel, drawn the way people are drawn everywhere else.
//
// Shared by the hub's channel list and the "someone joined" toast, because both
// are answering the same question -- is this worth joining -- and answering it
// two different ways would make the toast feel like a different product.
const props = withDefaults(
  defineProps<{
    channelId: string;
    max?: number;
    // "stack" overlaps the avatars into one row instead of listing rows.
    //
    // A toast is a glance, not a page. The list answers "who exactly, and what
    // rank" -- worth the height in a panel you are reading, but in a card that
    // shows up unbidden the question is only "is my team in there", and faces
    // answer that faster than four rows of names ever could.
    variant?: "list" | "stack";
  }>(),
  { max: 4, variant: "list" },
);

const { participants } = useChannelPresence(() => props.channelId);

const inCall = computed(() =>
  participants.value.filter((participant) => participant.connected),
);

const roster = computed(() => inCall.value.slice(0, props.max));
const overflow = computed(() => inCall.value.length - roster.value.length);

defineExpose({ count: () => inCall.value.length });

// PlayerDisplay speaks the app's player shape; the voice API speaks its own.
function asPlayer(participant: (typeof inCall.value)[number]) {
  return {
    steam_id: participant.steamId,
    name: participant.name,
    avatar_url: participant.avatarUrl,
  };
}
</script>

<template>
  <!-- Faces first, at a glance. -->
  <div
    v-if="variant === 'stack' && inCall.length"
    class="flex items-center gap-2.5"
  >
    <div class="flex shrink-0 items-center">
      <TransitionGroup
        enter-active-class="transition-[opacity,transform] [transition-duration:300ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
        leave-active-class="transition-[opacity,transform] [transition-duration:160ms] ease-in motion-reduce:![transition-duration:1ms]"
        move-class="transition-transform [transition-duration:300ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
        enter-from-class="opacity-0 scale-75"
        leave-to-class="opacity-0 scale-75"
      >
        <span
          v-for="member in roster"
          :key="member.steamId"
          class="relative -ml-2 first:ml-0"
          :title="member.name ?? member.steamId"
        >
          <img
            v-if="member.avatarUrl"
            :src="member.avatarUrl"
            alt=""
            class="h-7 w-7 rounded-full object-cover ring-2 transition-shadow"
            :class="
              member.speaking
                ? 'ring-emerald-400'
                : 'ring-[hsl(var(--card))]'
            "
          />
          <span
            v-else
            class="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 font-mono text-[0.55rem] font-bold text-zinc-400 ring-2"
            :class="
              member.speaking
                ? 'ring-emerald-400'
                : 'ring-[hsl(var(--card))]'
            "
          >
            {{ (member.name ?? "?").trim().slice(0, 2).toUpperCase() }}
          </span>

          <!-- A camera on is the difference between a voice channel and a call,
               so it is worth a mark even at this size. -->
          <Video
            v-if="member.video"
            class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[hsl(var(--card))] p-[1px] text-[hsl(var(--tac-amber))]"
          />
        </span>
      </TransitionGroup>

      <span
        v-if="overflow > 0"
        class="-ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 font-mono text-[0.55rem] font-bold text-zinc-400 ring-2 ring-[hsl(var(--card))]"
      >
        +{{ overflow }}
      </span>
    </div>

    <span class="min-w-0 truncate text-[11px] text-muted-foreground">
      {{ $t("layouts.voice_panel.connected", { count: inCall.length }) }}
    </span>
  </div>

  <TransitionGroup
    v-else-if="roster.length"
    tag="div"
    class="space-y-0.5"
    enter-active-class="transition-[opacity,transform] [transition-duration:280ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
    leave-active-class="transition-[opacity,transform] [transition-duration:180ms] ease-in motion-reduce:![transition-duration:1ms]"
    move-class="transition-transform [transition-duration:280ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
    enter-from-class="opacity-0 -translate-y-1"
    leave-to-class="opacity-0 scale-[0.97]"
  >
    <div
      v-for="member in roster"
      :key="member.steamId"
      class="flex items-center gap-2"
    >
      <PlayerDisplay
        class="min-w-0 flex-1"
        size="xs"
        :player="asPlayer(member)"
        :show-flag="false"
        :show-role="false"
        :show-online="false"
        :show-elo="false"
        :avatar-ring="member.speaking ? '0 0 0 2px rgb(52 211 153)' : null"
      />

      <!-- The two things that decide whether joining is worth it. -->
      <span class="flex shrink-0 items-center gap-1">
        <Video
          v-if="member.video"
          class="h-3 w-3 text-[hsl(var(--tac-amber))]"
        />
        <component
          :is="member.speaking ? Mic : MicOff"
          class="h-3 w-3"
          :class="member.speaking ? 'text-emerald-400' : 'text-zinc-600'"
        />
      </span>
    </div>

    <p
      v-if="overflow > 0"
      key="overflow"
      class="pl-1 pt-0.5 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-zinc-600"
    >
      {{ $t("voice.call.more_members", { count: overflow }) }}
    </p>
  </TransitionGroup>
</template>
