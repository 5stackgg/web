<script lang="ts">
// Every view that is open over the card, in the order they opened. Only the
// one on top answers Escape, so a picker opened from a collection closes
// itself and not the collection under it.
const openViews: symbol[] = [];
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useElementSize } from "@vueuse/core";
import { ChevronLeft } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { useBackDismiss } from "~/composables/useBackDismiss";
import { useUtilityCardViews } from "~/composables/useUtilityCardViews";

/**
 * One thing opened over the card: a meta spot, a collection, an execute, the
 * list you pick lineups from. The same slide the lineup makes -- out over the
 * tab's list, Back uncovers the list where it was -- with the same parts: one
 * row at the top holding the way out and everything you can do with the thing
 * (the `dock` slot: it used to sit at the foot of the card, a full column of
 * pointer travel from where you clicked to get here), then what it is, then
 * the body.
 *
 * It draws into the page's card rather than where it is written, so a tab's
 * panel can own a view without sitting inside the list that view covers.
 */
const props = withDefaults(
  defineProps<{
    open: boolean;
    /** What the way out is called when it is not Back: Cancel, while editing. */
    backLabel?: string | null;
    label?: string | null;
    /**
     * Which layer of the card it draws into. The page keeps a second one
     * above the tabs' own views for what can open over any of them.
     */
    layer?: "base" | "top";
    /**
     * Its being open is in the address (`?spot=`, `?collection=`), so the
     * entry that opened it is already there for the browser's Back and it
     * takes none of its own.
     */
    addressed?: boolean;
  }>(),
  { backLabel: null, label: null, layer: "base", addressed: false },
);

// The page's own element for that layer. Nothing is drawn until it exists:
// a teleport resolves its target once, on mount, and never looks again.
const layers = useUtilityCardViews();
const target = computed(() => layers?.[props.layer].value ?? null);

const emit = defineEmits<{ (e: "back"): void }>();

const id = Symbol("utility-card-view");

function leave() {
  const at = openViews.indexOf(id);
  if (at >= 0) {
    openViews.splice(at, 1);
  }
}

function onKey(event: KeyboardEvent) {
  if (
    event.key !== "Escape" ||
    event.defaultPrevented ||
    openViews[openViews.length - 1] !== id
  ) {
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  // A field being typed in, a menu, a dialog, the lineup or the server opened
  // over this: each of those owns the key before this does.
  if (
    target?.closest("input, textarea, select, [contenteditable='true']") ||
    document.querySelector(
      "[role='dialog'][data-state='open'], [role='menu'], [role='listbox'], [data-utility-practice-open], [data-utility-lineup-open]",
    )
  ) {
    return;
  }
  event.preventDefault();
  emit("back");
}

watch(
  () => props.open,
  (open) => {
    leave();
    if (typeof window === "undefined") {
      return;
    }
    window.removeEventListener("keydown", onKey);
    if (open) {
      openViews.push(id);
      window.addEventListener("keydown", onKey);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  leave();
  window.removeEventListener("keydown", onKey);
});

// The browser's Back is this view's Back before it is the page's.
useBackDismiss(
  () => props.open,
  () => emit("back"),
  { enabled: () => !props.addressed },
);

// Section headings inside the view pin under whatever the view keeps at its
// top, the same way the list's do under its own controls.
const head = ref<HTMLElement | null>(null);
const { height: headHeight } = useElementSize(head, undefined, {
  box: "border-box",
});

const body = ref<HTMLElement | null>(null);

defineExpose({
  scrollTop: () => body.value?.scrollTo({ top: 0 }),
});
</script>

<template>
  <Teleport v-if="target" :to="target">
    <Transition
      enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      leave-active-class="transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
      enter-from-class="translate-x-4 opacity-0"
      leave-to-class="translate-x-4 opacity-0"
    >
      <section
        v-if="open"
        class="absolute inset-0 z-20 flex flex-col bg-sidebar max-md:bg-background"
        :aria-label="label ?? undefined"
      >
        <!-- The view's header: the way out on the left, big enough to hit
             without aiming, and everything you can do on the right. Ruled off
             from what it belongs to, so it reads as a header and not as the
             first line of the body. -->
        <header
          class="relative z-30 flex shrink-0 items-center gap-1.5 border-b border-white/[0.07] px-3 py-2.5"
        >
          <Button
            variant="outline"
            size="sm"
            class="h-8 shrink-0 border-white/10 bg-white/[0.05] pl-2 pr-3 text-foreground hover:bg-white/[0.09]"
            @click="emit('back')"
          >
            <ChevronLeft class="mr-0.5 h-4 w-4" />
            {{ backLabel ?? $t("common.back") }}
          </Button>
          <!-- Shrink-wrapped and pushed right: a spacer a view left between
               its buttons has nothing to grow into here. -->
          <div class="ml-auto flex min-w-0 items-center gap-1.5">
            <slot name="dock" />
          </div>
        </header>

        <div
          ref="body"
          class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-4 pt-3"
          :style="{ '--utility-list-head': `${headHeight}px` }"
        >
          <!-- A pixel of room above, so a focused field's ring at the top of
               the head is not cut by the scroller's edge. -->
          <div
            v-if="$slots.head"
            ref="head"
            class="sticky top-0 z-20 shrink-0 bg-sidebar pb-2 pt-px max-md:bg-background"
          >
            <slot name="head" />
          </div>
          <!-- Fills what the head leaves, and no more: at full height under a
               head the body would always scroll by the head's own height. -->
          <div class="flex shrink-0 grow flex-col gap-3.5">
            <!-- What you are looking at, as the line over its name. -->
            <p
              v-if="$slots.kicker"
              class="-mb-2 flex min-w-0 items-center gap-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              <slot name="kicker" />
            </p>
            <slot />
          </div>
        </div>
      </section>
    </Transition>
  </Teleport>
</template>
