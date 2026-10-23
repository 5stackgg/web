<script setup lang="ts">
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { AlertTriangle, Star } from "lucide-vue-next";
import { useLeftNavState } from "~/composables/useLeftNavState";

// One entry in a data-driven nav group. A warning outranks a count: the icon
// says something needs a look, and its tooltip names what.
const props = defineProps<{
  to: RouteLocationRaw;
  icon: Component;
  label: string;
  active?: boolean;
  badge?: number;
  warning?: string | null;
  // Set to let the page be starred into Pinned.
  pinKey?: string;
}>();

const { isPinned, togglePin } = useLeftNavState();
</script>

<template>
  <SidebarMenuItem>
    <SidebarMenuButton
      as-child
      :tooltip="
        props.warning ? `${props.label} · ${props.warning}` : props.label
      "
    >
      <NuxtLink :to="props.to" :class="{ 'router-link-active': props.active }">
        <component :is="props.icon" />
        <span class="truncate">{{ props.label }}</span>
        <AlertTriangle
          v-if="props.warning"
          class="ml-auto h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
          :aria-label="props.warning"
        />
        <Badge v-else-if="props.badge" size="sm" class="ml-auto">
          {{ props.badge }}
        </Badge>
      </NuxtLink>
    </SidebarMenuButton>
    <SidebarMenuAction
      v-if="props.pinKey"
      :show-on-hover="!isPinned(props.pinKey)"
      class="text-muted-foreground hover:text-[hsl(var(--tac-amber))] aria-pressed:text-[hsl(var(--tac-amber))]"
      :aria-pressed="isPinned(props.pinKey)"
      :aria-label="
        $t(
          isPinned(props.pinKey)
            ? 'layouts.app_nav.pins.unpin'
            : 'layouts.app_nav.pins.pin',
          { page: props.label },
        )
      "
      @click="togglePin(props.pinKey)"
    >
      <Star :class="{ 'fill-current': isPinned(props.pinKey) }" />
    </SidebarMenuAction>
  </SidebarMenuItem>
</template>
