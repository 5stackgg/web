<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useResizeObserver } from "@vueuse/core";
import { RefreshCw, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { useAppUpdate } from "~/composables/useAppUpdate";
import { useMobileToastYield } from "~/composables/useMobileToastYield";

const route = useRoute();
const { visible, refresh, dismiss } = useAppUpdate();

// Pages without the app shell are embeds, pop-outs and broadcast views.
const shown = computed(() => visible.value && route.meta.layout !== false);

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
  <Transition
    enter-active-class="transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
    leave-active-class="transition-[opacity,transform] duration-150 ease-in motion-reduce:transition-none"
    enter-from-class="opacity-0 translate-y-3"
    leave-to-class="opacity-0 translate-y-3"
  >
    <div
      v-if="shown"
      ref="notice"
      class="app-update-notice fixed inset-x-3 z-50 mx-auto flex max-w-md items-start gap-3 rounded-lg border border-[hsl(var(--tac-amber))]/25 bg-[hsl(var(--card)/0.97)] p-3 shadow-2xl [backdrop-filter:blur(8px)]"
      role="status"
    >
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--tac-amber))]/10 ring-1 ring-inset ring-[hsl(var(--tac-amber))]/25"
      >
        <RefreshCw class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
      </div>

      <div class="min-w-0 flex-1 space-y-2">
        <h4 class="text-sm font-medium leading-none">
          {{ $t("app_update.title") }}
        </h4>
        <p class="text-xs leading-snug text-muted-foreground">
          {{ $t("app_update.description") }}
        </p>
        <Button size="sm" @click="refresh">
          {{ $t("app_update.refresh") }}
        </Button>
      </div>

      <button
        type="button"
        class="-m-1 shrink-0 p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
        :aria-label="$t('app_update.dismiss')"
        @click="dismiss"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  </Transition>
</template>

<style>
/* Clear of the admin dock and the floating save bar, as the toasts are. */
.app-update-notice {
  bottom: calc(
    0.75rem + var(--main-bottom-dock-height, 0px) + env(safe-area-inset-bottom)
  );
}

body:has(> div > .save-bar) .app-update-notice {
  bottom: calc(
    5.25rem + var(--main-bottom-dock-height, 0px) + env(safe-area-inset-bottom)
  );
}
</style>
