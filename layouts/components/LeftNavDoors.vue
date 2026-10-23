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
            <component :is="door.icon" class="size-4 shrink-0" />
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

    <!-- Outlined tiles with no fill, so none looks chosen at rest; only the
         page you're on turns amber. Icon and label sit on the sections'
         columns (18px, 36px). -->
    <div v-else class="flex flex-col gap-1.5">
      <NuxtLink
        v-for="door in doors"
        :key="door.key"
        :to="door.to!"
        :data-active="door.active || undefined"
        :aria-current="door.active ? 'page' : undefined"
        class="group/door flex h-[42px] items-center gap-[9px] rounded-lg border border-sidebar-border pl-2 pr-2 text-sm font-semibold text-sidebar-foreground/80 outline-none ring-sidebar-ring transition-[background-color,border-color,color,transform] duration-150 hover:border-white/[0.12] hover:bg-white/[0.03] hover:text-sidebar-foreground focus-visible:ring-2 active:scale-[0.98] data-[active]:border-[hsl(var(--tac-amber)/0.45)] data-[active]:bg-[hsl(var(--tac-amber)/0.07)] data-[active]:text-sidebar-foreground motion-reduce:transition-none"
        @click="setOpenMobile(false)"
      >
        <component
          :is="door.icon"
          class="size-[18px] shrink-0 transition-colors duration-200"
          :class="
            door.active
              ? 'text-[hsl(var(--tac-amber))]'
              : 'text-muted-foreground group-hover/door:text-sidebar-foreground'
          "
        />
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
