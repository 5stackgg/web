<script setup lang="ts">
import { computed } from "vue";
import { Settings, CircleHelp, LogOut, ChevronRight } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { useAuthStore } from "~/stores/AuthStore";

// One menu, both shells. TopNav (players) and LeftNav (organizers) used to
// carry their own copy of this markup, which is how they drifted into
// different hover treatments and a different set of entries for the same menu.
withDefaults(
  defineProps<{
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    sideOffset?: number;
  }>(),
  {
    side: "bottom",
    align: "end",
    sideOffset: 8,
  },
);

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{ logout: [] }>();

const me = computed(() => useAuthStore().me);

const route = useRoute();

// Not NuxtLink's own router-link-active: /settings/* pages are siblings of
// /settings in the route table, not children of it, so the automatic class
// goes cold the moment you're on a settings subpage. Same name-prefix rule the
// left nav uses for every other section link.
function isSectionActive(name: string): boolean {
  const current = route.name as string | undefined;
  return current === name || Boolean(current?.startsWith(`${name}-`));
}

const panelClasses =
  "w-[17.5rem] overflow-hidden !rounded-md border bg-popover/95 !p-0 shadow-[0_20px_40px_-16px_hsl(0_0%_0%/0.6)] [backdrop-filter:blur(10px)]";

// The identity block is a real destination now, not the inert label it was --
// PlayerDisplay owns the link so there is exactly one anchor here, which also
// buys its own hover treatment (amber name, avatar ring) for free.
const identityClasses =
  "block cursor-pointer !rounded-none bg-muted/20 px-3 py-3 transition-colors duration-150 hover:bg-muted/40 focus:bg-muted/40";

const viewProfileClasses =
  "pointer-events-none absolute bottom-2 right-3 inline-flex items-center gap-1 font-sans text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))] opacity-0 transition-opacity duration-150 group-hover/identity:opacity-100 group-focus-within/identity:opacity-100";

const eyebrowClasses =
  "flex items-center gap-2 px-3 pb-1 pt-3 font-sans text-[0.57rem] font-semibold uppercase tracking-[0.26em] text-muted-foreground/70";

const tickClasses = "inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]";

// Left border rather than a filled row: it reads as the same "selected channel"
// language the top nav and section headers already use, and it keeps the row
// from turning into a solid amber slab on hover.
const rowBase =
  "group/row relative flex cursor-pointer items-center gap-2.5 !rounded-none border-l-2 border-l-transparent px-3 py-2.5 text-[0.82rem] font-medium transition-[color,background-color,border-color] duration-150";

const rowClasses = `${rowBase} text-foreground/85 hover:border-l-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.06)] hover:!text-[hsl(var(--tac-amber))] focus:border-l-[hsl(var(--tac-amber))] focus:!bg-[hsl(var(--tac-amber)/0.06)] focus:!text-[hsl(var(--tac-amber))] [&.router-link-active]:border-l-[hsl(var(--tac-amber))] [&.router-link-active]:bg-[hsl(var(--tac-amber)/0.05)] [&.router-link-active]:text-[hsl(var(--tac-amber))]`;

const logoutClasses = `${rowBase} text-foreground/70 hover:border-l-destructive hover:bg-destructive/10 hover:!text-destructive focus:border-l-destructive focus:!bg-destructive/10 focus:!text-destructive`;

const iconClasses =
  "size-4 shrink-0 text-muted-foreground transition-colors group-hover/row:text-current group-focus/row:text-current";

const chevronClasses =
  "ml-auto size-3.5 text-transparent transition-[color,transform] duration-150 group-hover/row:translate-x-0.5 group-hover/row:text-current group-focus/row:translate-x-0.5 group-focus/row:text-current";
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>

    <DropdownMenuContent
      :class="panelClasses"
      :side="side"
      :align="align"
      :side-offset="sideOffset"
    >
      <div v-if="me" class="group/identity relative border-b">
        <DropdownMenuItem
          as-child
          :class="identityClasses"
          @click="open = false"
        >
          <PlayerDisplay
            :player="me"
            linkable
            size="sm"
            :show-online="false"
            :context-menu="false"
          />
        </DropdownMenuItem>

        <span :class="viewProfileClasses" aria-hidden="true">
          {{ $t("player.context_menu.view_profile") }}
          <ChevronRight class="size-3" />
        </span>
      </div>

      <div :class="eyebrowClasses">
        <span :class="tickClasses"></span>
        {{ $t("layouts.app_nav.profile.section") }}
      </div>

      <DropdownMenuItem as-child :class="rowClasses">
        <NuxtLink
          :to="{ name: 'settings' }"
          :class="{ 'router-link-active': isSectionActive('settings') }"
        >
          <Settings :class="iconClasses" />
          {{ $t("layouts.app_nav.profile.my_account") }}
          <ChevronRight :class="chevronClasses" />
        </NuxtLink>
      </DropdownMenuItem>

      <DropdownMenuItem as-child :class="rowClasses">
        <NuxtLink
          :to="{ name: 'faq' }"
          :class="{ 'router-link-active': isSectionActive('faq') }"
        >
          <CircleHelp :class="iconClasses" />
          {{ $t("faq.title") }}
          <ChevronRight :class="chevronClasses" />
        </NuxtLink>
      </DropdownMenuItem>

      <div class="mx-3 mt-1 h-px bg-border/60"></div>

      <DropdownMenuItem :class="logoutClasses" @click="emit('logout')">
        <LogOut :class="iconClasses" />
        {{ $t("layouts.app_nav.profile.logout") }}
        <ChevronRight :class="chevronClasses" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
