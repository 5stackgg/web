<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useResizeObserver } from "@vueuse/core";
import { RefreshCw, X } from "lucide-vue-next";
import { useAppUpdate } from "~/composables/useAppUpdate";
import { useMobileToastYield } from "~/composables/useMobileToastYield";
import { useRightSidebar } from "~/composables/useRightSidebar";
import { useAuthStore } from "~/stores/AuthStore";

const route = useRoute();
const authStore = useAuthStore();
const { rightSidebarOpen } = useRightSidebar();
const { visible, refresh, dismiss } = useAppUpdate();

// Pages without the app shell are embeds, pop-outs and broadcast views.
const shown = computed(() => visible.value && route.meta.layout !== false);

// The right hub's dock, or its open card, measured as the match toasts do.
const hubSpace = computed(() => {
  if (!authStore.me || (route.meta.layout ?? "default") !== "default") {
    return "0px";
  }
  return rightSidebarOpen.value ? "30.75rem" : "4.75rem";
});

const notice = ref<HTMLElement | null>(null);
const { reserveBottom } = useMobileToastYield();

function reserveNoticeSpace() {
  reserveBottom(
    "app-update-notice",
    shown.value ? (notice.value?.offsetHeight ?? 0) : 0,
  );
}

watch(shown, async () => {
  await nextTick();
  reserveNoticeSpace();
});

useResizeObserver(notice, reserveNoticeSpace);

onBeforeUnmount(() => {
  reserveBottom("app-update-notice", 0);
});
</script>

<template>
  <Transition name="app-update">
    <div
      v-if="shown"
      ref="notice"
      class="app-update-notice inline-flex h-10 items-center gap-2.5 rounded-full pl-3.5 pr-1.5"
      :style="{ '--app-update-hub': hubSpace }"
      role="status"
    >
      <span class="app-update-dot" aria-hidden="true"></span>
      <span class="whitespace-nowrap text-[13px] font-medium text-foreground">
        {{ $t("app_update.title") }}
      </span>
      <span
        class="h-[18px] w-px shrink-0 bg-[hsl(240_4%_24%)]"
        aria-hidden="true"
      ></span>
      <button
        type="button"
        class="app-update-reload inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1 py-2 text-[11px] font-bold uppercase leading-none tracking-[0.16em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.5)]"
        @click="refresh"
      >
        <RefreshCw class="size-[13px] shrink-0" aria-hidden="true" />
        {{ $t("app_update.reload") }}
      </button>
      <button
        type="button"
        class="shrink-0 rounded-full p-[7px] text-muted-foreground transition-colors duration-150 hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber)/0.5)]"
        :aria-label="$t('app_update.dismiss')"
        @click="dismiss"
      >
        <X class="size-3.5" />
      </button>
    </div>
  </Transition>
</template>

<style>
/* Bottom centre. On desktop, centred on the page between the left nav and the
   right hub, whose composer and dock sit in the bottom-right corner. Clear of
   the admin dock and the floating save bar, as the toasts are. */
.app-update-notice {
  position: fixed;
  z-index: 50;
  left: 50%;
  translate: -50% 0;
  bottom: calc(
    1rem + var(--main-bottom-dock-height, 0px) + env(safe-area-inset-bottom)
  );
  max-width: calc(100vw - 1.5rem);
  border: 1px solid hsl(240 4% 22%);
  background: hsl(240 6% 9% / 0.92);
  box-shadow:
    0 12px 30px -12px hsl(0 0% 0% / 0.9),
    0 0 0 1px hsl(var(--tac-amber) / 0.12);
  backdrop-filter: blur(10px);
  transition: left 200ms ease;
}

@media (min-width: 768px) {
  .app-update-notice {
    left: calc(
      var(--main-content-left, 0px) +
        (100vw - var(--main-content-left, 0px) - var(--app-update-hub, 0px)) / 2
    );
  }
}

body:has(> div > .save-bar) .app-update-notice {
  bottom: calc(
    5.5rem + var(--main-bottom-dock-height, 0px) + env(safe-area-inset-bottom)
  );
}

.app-update-dot {
  position: relative;
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: hsl(var(--tac-amber));
}

.app-update-dot::after {
  content: "";
  position: absolute;
  inset: -4px;
  border: 1px solid hsl(var(--tac-amber) / 0.7);
  border-radius: 50%;
  animation: app-update-ping 1.8s ease-out infinite;
}

@keyframes app-update-ping {
  from {
    transform: scale(0.6);
    opacity: 1;
  }
  to {
    transform: scale(1.8);
    opacity: 0;
  }
}

.app-update-reload {
  color: hsl(var(--tac-amber));
  transition: color 150ms ease;
}

.app-update-reload:hover {
  color: var(--tac-amber-cta-from);
}

.app-update-enter-active {
  transition:
    opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.app-update-leave-active {
  transition:
    opacity 150ms ease-in,
    transform 150ms ease-in;
}

.app-update-enter-from,
.app-update-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .app-update-notice,
  .app-update-enter-active,
  .app-update-leave-active {
    transition: none;
  }

  .app-update-dot::after {
    display: none;
  }
}
</style>
