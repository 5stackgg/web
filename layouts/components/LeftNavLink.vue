<script setup lang="ts">
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { Star } from "lucide-vue-next";
import { useLeftNavState } from "~/composables/useLeftNavState";
import LeftNavCount from "./LeftNavCount.vue";

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

const { isPinned, togglePin, lastPinned } = useLeftNavState();
</script>

<template>
  <!-- The star shows at the row's right end and the count steps left to
       make room, as in the Play list. -->
  <SidebarMenuItem class="group/row">
    <SidebarMenuButton
      as-child
      :tooltip="
        props.warning ? `${props.label} · ${props.warning}` : props.label
      "
    >
      <NuxtLink
        :to="props.to"
        class="duration-200 ease-out group-hover/row:bg-sidebar-accent group-hover/row:text-sidebar-accent-foreground"
        :class="[
          { 'router-link-active': props.active },
          props.pinKey &&
            (isPinned(props.pinKey)
              ? 'pr-8'
              : 'group-hover/row:pr-8 group-has-[:focus-visible]/row:pr-8 [@media(hover:none)]:pr-8'),
        ]"
      >
        <component :is="props.icon" />
        <span class="truncate">{{ props.label }}</span>
        <span v-if="props.warning || props.badge" class="sr-only">
          {{ props.warning || props.badge }}
        </span>
        <LeftNavCount
          class="ml-auto"
          :badge="props.badge"
          :warning="props.warning"
        />
      </NuxtLink>
    </SidebarMenuButton>
    <button
      v-if="props.pinKey"
      type="button"
      class="absolute right-1 top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none ring-sidebar-ring transition-[opacity,transform,color] duration-200 ease-out hover:text-[hsl(var(--tac-amber))] focus-visible:ring-2 group-data-[collapsible=icon]:hidden aria-pressed:text-[hsl(var(--tac-amber))]"
      :class="
        isPinned(props.pinKey)
          ? 'opacity-100'
          : 'translate-x-1 opacity-0 group-hover/row:translate-x-0 group-hover/row:opacity-100 group-has-[:focus-visible]/row:translate-x-0 group-has-[:focus-visible]/row:opacity-100 [@media(hover:none)]:translate-x-0 [@media(hover:none)]:opacity-100'
      "
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
      <Star
        class="size-3.5"
        :class="{
          'fill-current': isPinned(props.pinKey),
          'nav-star-pop': lastPinned === props.pinKey,
        }"
      />
    </button>
  </SidebarMenuItem>
</template>

<style scoped>
.nav-star-pop {
  animation: nav-star-pop 280ms ease-out;
}
@keyframes nav-star-pop {
  40% {
    transform: scale(1.3);
  }
}
@media (prefers-reduced-motion: reduce) {
  .nav-star-pop {
    animation: none;
  }
}
</style>
