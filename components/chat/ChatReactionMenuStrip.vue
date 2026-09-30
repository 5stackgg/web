<script setup lang="ts">
import { DropdownMenuCheckboxItem as ReactionItem } from "reka-ui";
import type { ChatReaction } from "~/constants/chat";
import { tacticalFilterPillActiveClasses } from "~/utilities/tacticalClasses";

// Every reaction as one row of menu items, for any menu that offers them.
defineProps<{
  choices: {
    id: ChatReaction;
    glyph: string;
    mine: boolean;
    disabled: boolean;
  }[];
  gagged: boolean;
}>();

const emit = defineEmits<{
  react: [reaction: ChatReaction];
}>();
</script>

<template>
  <div
    role="group"
    :aria-label="$t('chat.react')"
    class="grid grid-cols-6 gap-0.5"
  >
    <ReactionItem
      v-for="choice in choices"
      :key="choice.id"
      :model-value="choice.mine"
      :disabled="choice.disabled"
      :aria-label="$t('chat.react_with', { emoji: choice.glyph })"
      :data-reaction="choice.id"
      class="flex h-8 min-w-8 cursor-pointer select-none items-center justify-center rounded-sm border border-transparent text-base leading-none outline-none transition-colors duration-150 focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40 motion-reduce:transition-none"
      :class="choice.mine ? tacticalFilterPillActiveClasses : ''"
      @select="emit('react', choice.id)"
    >
      <span aria-hidden="true">{{ choice.glyph }}</span>
    </ReactionItem>
  </div>
  <p
    v-if="gagged"
    class="max-w-[13rem] px-1.5 pb-0.5 pt-1.5 text-[10px] leading-snug text-muted-foreground"
  >
    {{ $t("chat.react_gagged") }}
  </p>
</template>
