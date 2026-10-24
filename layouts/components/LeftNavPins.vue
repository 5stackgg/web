<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { AlertTriangle, Star } from "lucide-vue-next";
import { NuxtLink } from "#components";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { useLeftNavState } from "~/composables/useLeftNavState";
import type { LeftNavItem } from "./leftNav";

// Pinned pages under a divider label, then pinned admin pages under their own.
// Drag a row (or Alt and an arrow key) to reorder it within its group.
const props = defineProps<{
  items: LeftNavItem[];
  adminItems: LeftNavItem[];
  rail: boolean;
}>();

const { t } = useI18n();
const { setOpenMobile } = useSidebar();
const { togglePin, movePin, lastPinned } = useLeftNavState();

const groups = computed(() => [
  {
    id: "pages",
    label: t("layouts.app_nav.pins.title"),
    items: props.items,
  },
  ...(props.adminItems.length
    ? [
        {
          id: "admin",
          label: t("layouts.app_nav.administration.title"),
          items: props.adminItems,
        },
      ]
    : []),
]);

const dragging = ref<{ key: string; group: string } | null>(null);
const dropAt = ref<{ key: string; place: "before" | "after" } | null>(null);

function onDragStart(event: DragEvent, key: string, group: string) {
  dragging.value = { key, group };
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
  }
}

function onDragOver(event: DragEvent, key: string, group: string) {
  if (
    !dragging.value ||
    dragging.value.group !== group ||
    dragging.value.key === key
  ) {
    return;
  }
  event.preventDefault();
  const row = (event.currentTarget as HTMLElement).getBoundingClientRect();
  dropAt.value = {
    key,
    place: event.clientY < row.top + row.height / 2 ? "before" : "after",
  };
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  if (dragging.value && dropAt.value) {
    movePin(dragging.value.key, dropAt.value.key, dropAt.value.place);
  }
  endDrag();
}

function endDrag() {
  dragging.value = null;
  dropAt.value = null;
}

async function onKeydown(
  event: KeyboardEvent,
  key: string,
  list: LeftNavItem[],
) {
  if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
    return;
  }
  event.preventDefault();
  const up = event.key === "ArrowUp";
  const index = list.findIndex((item) => item.key === key);
  const neighbour = list[index + (up ? -1 : 1)];
  if (!neighbour) {
    return;
  }
  movePin(key, neighbour.key, up ? "before" : "after");
  await nextTick();
  document
    .querySelector<HTMLElement>(`[data-pin="${CSS.escape(key)}"] a`)
    ?.focus();
}
</script>

<template>
  <SidebarGroup class="py-0.5">
    <template v-if="rail">
      <template
        v-for="(group, index) in groups.filter((group) => group.items.length)"
        :key="group.id"
      >
        <Separator v-if="index > 0" class="mx-auto my-1 w-5" />
        <SidebarMenu>
          <SidebarMenuItem v-for="item in group.items" :key="item.key">
            <SidebarMenuButton as-child :tooltip="item.label">
              <NuxtLink
                :to="item.to!"
                :class="{ 'router-link-active': item.active }"
              >
                <component :is="item.icon" class="size-4 shrink-0" />
                <span>{{ item.label }}</span>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </template>
    </template>

    <div v-else class="flex flex-col pb-2">
      <template v-for="group in groups" :key="group.id">
        <div class="flex items-center gap-2 pb-1 pl-2.5 pr-1 pt-1.5">
          <Tooltip v-if="group.id === 'pages'" :delay-duration="400">
            <TooltipTrigger as-child>
              <span
                tabindex="0"
                class="rounded-sm text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground outline-none ring-sidebar-ring focus-visible:ring-2"
              >
                {{ group.label }}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              {{ $t("layouts.app_nav.pins.hint") }}
            </TooltipContent>
          </Tooltip>
          <span
            v-else
            class="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ group.label }}
          </span>
          <span aria-hidden="true" class="h-px flex-1 bg-sidebar-border"></span>
        </div>
        <ul class="flex flex-col gap-px" :aria-label="group.label">
          <li
            v-for="item in group.items"
            :key="item.key"
            :data-pin="item.key"
            draggable="true"
            class="group/row relative flex h-8 items-center rounded-md pr-1 transition-colors duration-150"
            :class="[
              item.active
                ? 'bg-sidebar-accent/70'
                : 'hover:bg-sidebar-accent/60',
              {
                'opacity-40': dragging?.key === item.key,
                'nav-pin-in': lastPinned === item.key,
              },
              dropAt?.key === item.key &&
                (dropAt.place === 'before'
                  ? 'before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded-full before:bg-[hsl(var(--tac-amber))]'
                  : 'after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[hsl(var(--tac-amber))]'),
            ]"
            @dragstart="onDragStart($event, item.key, group.id)"
            @dragover="onDragOver($event, item.key, group.id)"
            @drop="onDrop"
            @dragend="endDrag"
          >
            <NuxtLink
              :to="item.to!"
              draggable="false"
              :data-active="item.active || undefined"
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              class="flex min-w-0 flex-1 items-center gap-2.5 pl-2.5 pr-1 text-[0.84rem] text-sidebar-foreground/85 outline-none transition-colors duration-150 after:absolute after:inset-0 after:rounded-md after:ring-sidebar-ring focus-visible:after:ring-2 group-hover/row:text-sidebar-foreground data-[active]:text-sidebar-foreground"
              @click="setOpenMobile(false)"
              @keydown="onKeydown($event, item.key, group.items)"
            >
              <component
                :is="item.icon"
                class="size-4 shrink-0 transition-colors duration-200"
                :class="
                  item.active
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
              />
              <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
              <span v-if="item.warning || item.badge" class="sr-only">
                {{ item.warning || item.badge }}
              </span>
            </NuxtLink>
            <button
              type="button"
              class="relative z-10 grid size-7 shrink-0 translate-x-1 place-items-center rounded-md text-[hsl(var(--tac-amber))] opacity-0 outline-none ring-sidebar-ring transition-[opacity,transform] duration-200 ease-out focus-visible:translate-x-0 focus-visible:opacity-100 focus-visible:ring-2 group-hover/row:translate-x-0 group-hover/row:opacity-100 [@media(hover:none)]:translate-x-0 [@media(hover:none)]:opacity-100"
              aria-pressed="true"
              :aria-label="
                $t('layouts.app_nav.pins.unpin', { page: item.label })
              "
              @click="togglePin(item.key)"
            >
              <Star
                class="size-3.5 fill-current"
                :class="{ 'nav-star-pop': lastPinned === item.key }"
              />
            </button>
            <AlertTriangle
              v-if="item.warning"
              aria-hidden="true"
              class="mr-1 h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
            />
            <span
              v-else-if="item.badge"
              aria-hidden="true"
              class="mr-1 inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center gap-1 rounded-[3px] border px-[5px] text-[11px] font-bold leading-none tabular-nums"
              :class="
                item.badgeTone === 'live'
                  ? 'border-destructive/50 bg-destructive/15 text-destructive'
                  : 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.14)] text-[hsl(var(--tac-amber))]'
              "
            >
              <span
                v-if="item.badgeTone === 'live'"
                class="h-[5px] w-[5px] rounded-full bg-current"
              ></span>
              {{ item.badge }}
            </span>
          </li>
        </ul>
      </template>
      <span
        aria-hidden="true"
        class="mx-2.5 mt-2 h-px bg-sidebar-border"
      ></span>
    </div>
  </SidebarGroup>
</template>

<style scoped>
.nav-pin-in {
  animation: nav-pin-in 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
.nav-star-pop {
  animation: nav-star-pop 280ms ease-out;
}
@keyframes nav-pin-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
}
@keyframes nav-star-pop {
  40% {
    transform: scale(1.3);
  }
}
@media (prefers-reduced-motion: reduce) {
  .nav-pin-in,
  .nav-star-pop {
    animation: none;
  }
}
</style>
