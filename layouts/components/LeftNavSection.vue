<script setup lang="ts">
import { computed } from "vue";
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Star,
} from "lucide-vue-next";
import { NuxtLink } from "#components";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { useLeftNavState } from "~/composables/useLeftNavState";
import type { LeftNavItem, LeftNavSectionData } from "./leftNav";

const props = defineProps<{
  section: LeftNavSectionData;
  // Collapsed to icons, every page shows as one, folded or not.
  rail: boolean;
  pinnable: boolean;
}>();

const { setOpenMobile } = useSidebar();
const { isOpen, setOpen, isPinned, togglePin } = useLeftNavState();

const open = computed(() => isOpen(props.section.id));
const listId = computed(() => `left-nav-${props.section.id}`);
// Pinned pages come from every section, so they keep their icons; a section's
// own pages hang off its guide line as plain text.
const isPins = computed(() => props.section.id === "pins");
const active = computed(() => props.section.items.some((item) => item.active));

const linkProps = (item: LeftNavItem) =>
  item.to
    ? { to: item.to }
    : { href: item.href, target: "_blank", rel: "noopener noreferrer" };
</script>

<template>
  <SidebarGroup class="py-0.5">
    <SidebarMenu v-if="rail">
      <SidebarMenuItem v-for="item in section.items" :key="item.key">
        <SidebarMenuButton
          as-child
          :tooltip="
            item.warning ? `${item.label} · ${item.warning}` : item.label
          "
        >
          <component
            :is="item.to ? NuxtLink : 'a'"
            v-bind="linkProps(item)"
            class="relative"
            :class="{ 'router-link-active': item.active }"
          >
            <component :is="item.icon" />
            <span>{{ item.label }}</span>
            <span
              v-if="item.warning || item.badge"
              aria-hidden="true"
              class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
              :class="
                item.badgeTone === 'live'
                  ? 'bg-destructive'
                  : 'bg-[hsl(var(--tac-amber))]'
              "
            ></span>
          </component>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>

    <template v-else>
      <button
        type="button"
        class="flex h-9 w-full min-w-0 items-center gap-2.5 rounded-md pl-2 pr-2 text-left text-[0.84rem] font-semibold outline-none ring-sidebar-ring transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-2"
        :class="
          active ? 'text-sidebar-foreground' : 'text-sidebar-foreground/80'
        "
        :aria-expanded="open"
        :aria-controls="listId"
        @click="setOpen(section.id, !open)"
      >
        <component
          :is="section.icon"
          class="size-[17px] shrink-0 transition-colors duration-150"
          :class="
            active ? 'text-[hsl(var(--tac-amber))]' : 'text-muted-foreground'
          "
        />
        <span class="shrink-0">{{ section.label }}</span>
        <span
          v-if="section.live"
          class="ml-auto min-w-0 truncate text-right text-xs font-normal"
          :class="
            section.live.tone === 'live'
              ? 'text-destructive'
              : 'text-muted-foreground'
          "
        >
          {{ section.live.text }}
        </span>
        <ChevronDown
          class="size-3 shrink-0 opacity-60 transition-transform duration-200 ease-out"
          :class="[{ '-rotate-90': !open }, { 'ml-auto': !section.live }]"
        />
      </button>

      <div
        :id="listId"
        class="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        :class="open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
        :inert="!open || undefined"
      >
        <div class="min-h-0 overflow-hidden">
          <ul
            class="flex flex-col gap-px"
            :class="
              isPins
                ? 'pb-1'
                : 'mb-1.5 ml-[17px] border-l border-sidebar-border py-px pl-3'
            "
          >
            <li
              v-for="item in section.items"
              :key="item.key"
              class="group/row relative"
            >
              <component
                :is="item.to ? NuxtLink : 'a'"
                v-bind="linkProps(item)"
                :data-active="item.active || undefined"
                class="relative flex min-w-0 items-center rounded-md pr-2 outline-none ring-sidebar-ring transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-2 data-[active]:bg-sidebar-accent/70 data-[active]:text-sidebar-foreground"
                :class="[
                  isPins
                    ? 'h-8 gap-2.5 pl-2 text-[0.84rem] text-sidebar-foreground/85'
                    : 'h-[30px] gap-2 pl-2.5 text-[0.8rem] text-muted-foreground data-[active]:before:absolute data-[active]:before:-left-[13px] data-[active]:before:bottom-1.5 data-[active]:before:top-1.5 data-[active]:before:w-0.5 data-[active]:before:rounded-full data-[active]:before:bg-[hsl(var(--tac-amber))]',
                  pinnable &&
                    !item.href &&
                    'group-focus-within/row:pr-9 group-hover/row:pr-9 [@media(hover:none)]:pr-9',
                ]"
                @click="setOpenMobile(false)"
              >
                <component
                  :is="item.icon"
                  v-if="isPins"
                  class="size-4 shrink-0 transition-colors duration-150"
                  :class="
                    item.active
                      ? 'text-[hsl(var(--tac-amber))]'
                      : 'text-muted-foreground'
                  "
                />
                <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                <AlertTriangle
                  v-if="item.warning"
                  class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
                  :aria-label="item.warning"
                />
                <span
                  v-else-if="item.badge"
                  class="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center gap-1 rounded-[3px] border px-[5px] text-[11px] font-bold leading-none tabular-nums transition-opacity duration-150"
                  :class="[
                    item.badgeTone === 'live'
                      ? 'border-destructive/50 bg-destructive/15 text-destructive'
                      : 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.14)] text-[hsl(var(--tac-amber))]',
                    pinnable &&
                      '[@media(hover:hover)]:group-focus-within/row:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-0',
                  ]"
                >
                  <span
                    v-if="item.badgeTone === 'live'"
                    aria-hidden="true"
                    class="h-[5px] w-[5px] rounded-full bg-current"
                  ></span>
                  {{ item.badge }}
                </span>
                <ExternalLink
                  v-if="item.href"
                  class="h-3 w-3 shrink-0 opacity-60"
                  aria-hidden="true"
                />
              </component>
              <button
                v-if="pinnable && !item.href"
                type="button"
                class="absolute right-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none ring-sidebar-ring transition-[opacity,color] duration-150 hover:text-[hsl(var(--tac-amber))] focus-visible:opacity-100 focus-visible:ring-2 group-hover/row:opacity-100 aria-pressed:text-[hsl(var(--tac-amber))] [@media(hover:none)]:opacity-100"
                :class="
                  isPinned(item.key) && !isPins && !item.badge
                    ? 'opacity-100'
                    : 'opacity-0'
                "
                :aria-pressed="isPinned(item.key)"
                :aria-label="
                  $t(
                    isPinned(item.key)
                      ? 'layouts.app_nav.pins.unpin'
                      : 'layouts.app_nav.pins.pin',
                    { page: item.label },
                  )
                "
                @click="togglePin(item.key)"
              >
                <Star
                  class="size-3.5"
                  :class="{ 'fill-current': isPinned(item.key) }"
                />
              </button>
            </li>
            <li
              v-if="!section.items.length && section.empty"
              class="px-2 py-1.5 text-xs leading-snug text-muted-foreground"
            >
              {{ section.empty }}
            </li>
          </ul>
        </div>
      </div>
    </template>
  </SidebarGroup>
</template>
