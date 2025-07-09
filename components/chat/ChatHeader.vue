<script setup lang="ts">
import { Badge } from "~/components/ui/badge";
import { MessageCircle, Minimize2 } from "lucide-vue-next";
</script>

<template>
  <div
    v-if="variant === 'global'"
    class="flex items-center justify-between p-3 cursor-pointer transition-opacity duration-200 flex-shrink-0"
    :class="{ 'border-b': !isMinimized }"
    @click="handleToggleMinimize"
  >
    <div class="flex items-center gap-2">
      <MessageCircle class="size-4 transition-transform duration-200" />
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
    <Minimize2
      v-if="showMinimizeButton"
      class="size-4 text-foreground transition-colors duration-200"
    />
  </div>
  <div v-else class="absolute right-3 top-3">
    <div class="flex">
      <Badge variant="secondary">
        <slot name="title">{{ $t(title) }}</slot>
      </Badge>
    </div>
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
