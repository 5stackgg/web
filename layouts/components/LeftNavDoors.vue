<script setup lang="ts">
import { NuxtLink } from "#components";
import { useSidebar } from "~/components/ui/sidebar/utils";
import type { LeftNavItem } from "./leftNav";

// Play and Watch: the two pages most visits are for, one click each, above
// the folding sections.
defineProps<{
  doors: LeftNavItem[];
  rail: boolean;
}>();

const { setOpenMobile } = useSidebar();
</script>

<template>
  <SidebarGroup class="py-1">
    <SidebarMenu v-if="rail">
      <SidebarMenuItem v-for="door in doors" :key="door.key">
        <SidebarMenuButton as-child :tooltip="door.label">
          <NuxtLink
            :to="door.to!"
            class="relative"
            :class="{ 'router-link-active': door.active }"
          >
            <component :is="door.icon" />
            <span>{{ door.label }}</span>
            <span
              v-if="door.badge"
              aria-hidden="true"
              class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
              :class="
                door.badgeTone === 'live'
                  ? 'bg-destructive'
                  : 'bg-[hsl(var(--tac-amber))]'
              "
            ></span>
          </NuxtLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>

    <div v-else class="flex flex-col gap-2">
      <NuxtLink
        v-for="door in doors"
        :key="door.key"
        :to="door.to!"
        :data-active="door.active || undefined"
        :aria-current="door.active ? 'page' : undefined"
        class="group/door flex h-[38px] items-center gap-1.5 rounded-lg pl-1.5 pr-2 text-sm font-semibold text-sidebar-foreground/85 outline-none ring-sidebar-ring transition-[background-color,color,transform] duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-2 active:scale-[0.98] data-[active]:bg-[hsl(var(--tac-amber)/0.11)] data-[active]:text-sidebar-foreground motion-reduce:transition-none"
        @click="setOpenMobile(false)"
      >
        <!-- The tile marks a button at rest without the row looking chosen;
             only the page you're on fills. -->
        <span
          class="grid size-6 shrink-0 place-items-center rounded-md ring-1 ring-inset transition-colors duration-200"
          :class="
            door.active
              ? 'bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))] ring-[hsl(var(--tac-amber)/0.3)]'
              : 'bg-white/[0.05] text-muted-foreground ring-sidebar-border group-hover/door:text-sidebar-foreground'
          "
        >
          <component :is="door.icon" class="size-4" />
        </span>
        <span class="min-w-0 flex-1 truncate">{{ door.label }}</span>
        <span
          v-if="door.badge"
          class="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center gap-1 rounded-[3px] border px-[5px] text-[11px] font-bold leading-none tabular-nums"
          :class="
            door.badgeTone === 'live'
              ? 'border-destructive/50 bg-destructive/15 text-destructive'
              : 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.14)] text-[hsl(var(--tac-amber))]'
          "
        >
          <span
            v-if="door.badgeTone === 'live'"
            aria-hidden="true"
            class="h-[5px] w-[5px] rounded-full bg-current"
          ></span>
          {{ door.badge }}
        </span>
      </NuxtLink>
    </div>
  </SidebarGroup>
</template>
