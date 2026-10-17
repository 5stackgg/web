<script setup lang="ts">
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { AlertTriangle } from "lucide-vue-next";

// One entry in a data-driven nav group. A warning outranks a count: the icon
// says something needs a look, and its tooltip names what.
const props = defineProps<{
  to: RouteLocationRaw;
  icon: Component;
  label: string;
  active?: boolean;
  badge?: number;
  warning?: string | null;
}>();
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
  </SidebarMenuItem>
</template>
