<script setup lang="ts">
import { Badge } from "~/components/ui/badge";
import { Merge, Minimize2 } from "lucide-vue-next";
</script>

<template>
  <div
    v-if="variant === 'global'"
    class="flex items-center justify-between p-3 cursor-pointer transition-opacity duration-200 flex-shrink-0"
    :class="{ 'border-b': !isMinimized }"
    @click="handleToggleMinimize"
  >
    <div class="flex items-center gap-2">
      <Merge class="size-4 transition-transform duration-200" />
      <span class="text-sm font-medium">
        <slot name="title">{{ $t(title) }}</slot>
      </span>
      <Badge
        v-if="unreadCount > 0 && isMinimized"
        variant="destructive"
        class="text-xs animate-pulse"
      >
        {{ unreadCount }}
      </Badge>
    </div>
    <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        class="inline-flex h-2 w-2 rounded-full"
        :class="participantsCount > 0 ? 'bg-emerald-400' : 'bg-zinc-500/60'"
      />
      {{ participantsCount }} in chat
    </div>
    <Minimize2
      v-if="showMinimizeButton"
      class="size-4 text-foreground transition-colors duration-200"
    />
  </div>
  <div v-else class="mb-2 flex items-center justify-between">
    <Badge variant="secondary" class="text-[11px] px-2 py-0.5">
      <slot name="title">{{ $t(title) }}</slot>
    </Badge>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    title: {
      type: String,
      default: "chat.lobby_chat",
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    participantsCount: {
      type: Number,
      default: 0,
    },
    isMinimized: {
      type: Boolean,
      default: false,
    },
    showMinimizeButton: {
      type: Boolean,
      default: true,
    },
    variant: {
      type: String,
      default: "embedded",
      validator: (value: string) => ["global", "embedded"].includes(value),
    },
  },
  emits: ["toggleMinimize"],
  methods: {
    handleToggleMinimize() {
      this.$emit("toggleMinimize");
    },
  },
};
</script>
