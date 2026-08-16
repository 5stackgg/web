<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BellRing, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useAuthStore } from "~/stores/AuthStore";
import { usePwaInstall } from "~/composables/usePwaInstall";
import { isPushSupported } from "~/composables/usePushNotifications";

// A one-time nudge toward push, shown once the player is in the installed app
// -- either because they opened it from their home screen, or because they
// just installed it from the settings page and `installed` flipped under them.
// That moment is the whole point: push is invisible until you have the app, so
// getting the app is exactly when to mention it exists.
//
// The Enable button *is* the user gesture: it goes straight into subscribe(),
// which calls Notification.requestPermission() with nothing awaited in front
// of it. Routing to the settings page instead would work, but it spends a
// second tap on a decision the player already made here.
//
// Nothing about installing lives here -- that belongs on the settings page,
// where the player went looking for it. This banner only ever appears on the
// far side of that.
//
// Dismissal is per-device rather than a stored preference, because a push
// subscription is per-device too: enabling push on a phone says nothing about
// what should happen on a desktop.
const DISMISSED_KEY = "push-prompt-dismissed";

const { t } = useI18n();
const authStore = useAuthStore();
const push = usePushNotifications();
const { installed } = usePwaInstall();

const visible = ref(false);

let checked = false;
let showTimer: ReturnType<typeof setTimeout> | null = null;

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // No storage (private mode, blocked cookies) means no way to remember a
    // dismissal, and a banner that returns on every load is worse than one
    // that never shows.
    return true;
  }
}

function dismiss() {
  visible.value = false;

  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }

  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // See wasDismissed -- nothing to do, the gate above already handles it.
  }
}

async function evaluate() {
  // `installed` can flip mid-session when the browser fires appinstalled, so
  // this stays re-runnable until the conditions are actually met once.
  if (checked || !authStore.me || !installed.value) {
    return;
  }

  checked = true;

  if (!isPushSupported() || wasDismissed()) {
    return;
  }

  await push.refresh();

  // Only "default" is worth asking about. "denied" can't be re-prompted from
  // script at all, and granted-but-unsubscribed means they turned push off in
  // settings deliberately.
  if (push.permission.value !== "default" || push.subscribed.value) {
    return;
  }

  // Let the page finish its own first paint before sliding in.
  showTimer = setTimeout(() => {
    showTimer = null;
    visible.value = true;
  }, 1200);
}

async function enable() {
  try {
    const granted = await push.subscribe();

    if (granted) {
      toast({
        title: t("push_prompt.enabled"),
      });
    } else if (!push.isDenied.value) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: t("push_prompt.failed"),
      });
    }
  } finally {
    // Answered either way -- blocking is an answer too, and one we can't ask
    // about again.
    dismiss();
  }
}

watch([() => authStore.me, installed], evaluate, { immediate: true });

onBeforeUnmount(() => {
  if (showTimer) {
    clearTimeout(showTimer);
  }
});
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,transform] duration-200 ease-out"
    leave-active-class="transition-[opacity,transform] duration-150 ease-in"
    enter-from-class="opacity-0 translate-y-3"
    leave-to-class="opacity-0 translate-y-3"
  >
    <div
      v-if="visible"
      class="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-start gap-3 rounded-lg border border-[hsl(var(--tac-amber))]/25 bg-[hsl(var(--card)/0.97)] p-3 shadow-2xl [backdrop-filter:blur(8px)] [margin-bottom:env(safe-area-inset-bottom)]"
      role="region"
      :aria-label="$t('push_prompt.title')"
    >
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--tac-amber))]/10 ring-1 ring-inset ring-[hsl(var(--tac-amber))]/25"
      >
        <BellRing class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
      </div>

      <div class="min-w-0 flex-1 space-y-2">
        <h4 class="text-sm font-medium leading-none">
          {{ $t("push_prompt.title") }}
        </h4>
        <p class="text-xs leading-snug text-muted-foreground">
          {{ $t("push_prompt.description") }}
        </p>
        <Button size="sm" :loading="push.busy.value" @click="enable">
          {{ $t("push_prompt.enable") }}
        </Button>
      </div>

      <button
        type="button"
        class="-m-1 shrink-0 p-1 text-muted-foreground transition-colors duration-150 hover:text-foreground"
        :aria-label="$t('push_prompt.dismiss')"
        @click="dismiss"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  </Transition>
</template>
