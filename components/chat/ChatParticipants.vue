<script lang="ts">
import type { PropType } from "vue";

export interface ChatParticipant {
  steam_id?: string;
  name?: string;
  avatar_url?: string | null;
}

export default {
  props: {
    participants: {
      type: Array as PropType<ChatParticipant[]>,
      default: () => [],
    },
    // `pills` is the horizontal strip above the hub's chat, `list` the popover
    // the docked chat windows open.
    variant: {
      type: String,
      default: "list",
      validator: (value: string) => ["list", "pills"].includes(value),
    },
  },
  methods: {
    profileRoute(participant: ChatParticipant) {
      if (!participant.steam_id) {
        return null;
      }
      return {
        name: "players-id",
        params: { id: participant.steam_id },
      };
    },
  },
};
</script>

<template>
  <div
    :class="
      variant === 'pills'
        ? 'flex gap-2 overflow-x-auto'
        : 'flex flex-col gap-1.5'
    "
  >
    <NuxtLink
      v-for="(participant, index) in participants"
      :key="participant.steam_id ?? index"
      :to="profileRoute(participant)"
      class="flex items-center gap-2 min-w-0"
      :class="[
        variant === 'pills'
          ? 'shrink-0 rounded-full bg-zinc-900/70 px-2 py-0.5 gap-1.5'
          : '',
        profileRoute(participant)
          ? 'transition-colors hover:text-[hsl(var(--tac-amber))]'
          : '',
      ]"
    >
      <img
        v-if="participant.avatar_url"
        :src="participant.avatar_url"
        alt=""
        :class="
          variant === 'pills'
            ? 'h-4 w-4 rounded-full object-cover'
            : 'h-5 w-5 rounded-full object-cover'
        "
      />
      <span
        class="truncate text-[11px]"
        :class="variant === 'pills' ? 'max-w-[8rem]' : ''"
      >
        {{ participant.name }}
      </span>
    </NuxtLink>
  </div>
</template>
