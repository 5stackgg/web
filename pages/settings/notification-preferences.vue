<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { Bell, BellOff } from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { e_player_roles_enum } from "~/generated/zeus";

const { t, te } = useI18n();
const authStore = useAuthStore();

const push = usePushNotifications();
const { preferences, load, set } = useNotificationPreferences();

const isModerator = computed(() =>
  authStore.isRoleAbove(e_player_roles_enum.moderator),
);

// Staff-only keys would render as switches that can never affect anything for
// a normal player, since they only ever receive role-targeted notifications.
const visibleKeys = (channel: "push" | "in_app") =>
  preferences.value[channel].filter(
    (entry) => !entry.adminOnly || isModerator.value,
  );

const pushKeys = computed(() => visibleKeys("push"));
const alertKeys = computed(() => visibleKeys("in_app"));

// Backend-driven keys, so a category added server-side renders with a
// humanized fallback rather than a raw dotted i18n path.
const keyLabel = (key: string) => {
  const path = `pages.settings.notification_preferences.keys.${key}.title`;
  return te(path)
    ? t(path)
    : key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const keyDescription = (key: string) => {
  const path = `pages.settings.notification_preferences.keys.${key}.description`;
  return te(path) ? t(path) : "";
};

// Chrome, Edge, Firefox and Safari 16+ all support Web Push on desktop, so this
// gates on capability rather than on platform. The iOS hint is the exception:
// there, push only exists once the app is installed to the home screen.
const isIosBrowser = computed(
  () =>
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window.navigator as any).standalone,
);

const pushHint = computed(() => {
  if (!push.supported.value) {
    return isIosBrowser.value
      ? t("pages.settings.notification_preferences.push.ios_install")
      : t("pages.settings.notification_preferences.push.unsupported");
  }
  if (push.isDenied.value) {
    return t("pages.settings.notification_preferences.push.denied");
  }
  return t("pages.settings.notification_preferences.push.description");
});

onMounted(async () => {
  await push.refresh();
  await load();
});

const handlePushToggle = async (enabled: boolean) => {
  if (enabled) {
    // Called straight from the toggle so the permission prompt stays
    // attributable to the click -- see usePushNotifications.
    const granted = await push.subscribe();

    if (granted) {
      toast({
        title: t("pages.settings.notification_preferences.push.enabled_toast"),
      });
      await load("push");
      return;
    }

    toast({
      variant: "destructive",
      title: t("common.error"),
      description: push.isDenied.value
        ? t("pages.settings.notification_preferences.push.denied")
        : t("pages.settings.notification_preferences.push.failed"),
    });
    return;
  }

  await push.unsubscribe();
  toast({
    title: t("pages.settings.notification_preferences.push.disabled_toast"),
  });
};

const handlePreferenceToggle = async (
  channel: "push" | "in_app",
  key: string,
  enabled: boolean,
) => {
  try {
    await set(channel, key, enabled);
  } catch {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: t("pages.settings.notification_preferences.save_failed"),
    });
  }
};
</script>

<template>
  <PageTransition :delay="0">
    <div class="space-y-8">
      <p class="max-w-prose text-sm text-muted-foreground">
        {{ $t("pages.settings.notification_preferences.description") }}
      </p>

      <!-- Push, the gate. Stays a full card because turning it on is the one
           decision on this page that does anything on its own. -->
      <section class="space-y-3">
        <div
          class="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card/40 p-4 [backdrop-filter:blur(6px)]"
        >
          <div class="flex items-start gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md ring-1 ring-inset transition-colors duration-200"
              :class="
                push.subscribed.value
                  ? 'bg-[hsl(var(--tac-amber))]/10 ring-[hsl(var(--tac-amber))]/25'
                  : 'bg-muted/40 ring-border'
              "
            >
              <component
                :is="push.subscribed.value ? Bell : BellOff"
                class="h-5 w-5"
                :class="
                  push.subscribed.value
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
              />
            </div>
            <div class="space-y-1">
              <h4 class="font-medium leading-none">
                {{ $t("pages.settings.notification_preferences.push.title") }}
              </h4>
              <p class="max-w-prose text-sm text-muted-foreground">
                {{ pushHint }}
              </p>
            </div>
          </div>
          <Switch
            :model-value="push.subscribed.value"
            :disabled="
              !push.supported.value || push.isDenied.value || push.busy.value
            "
            @update:model-value="handlePushToggle"
          />
        </div>

        <!-- Categories only exist once there is somewhere to send them. One
             framed list with dividers, not a stack of separate cards. -->
        <div v-if="push.subscribed.value && pushKeys.length" class="space-y-2">
          <div :class="[tacticalSectionLabelClasses, 'mb-0']">
            <span :class="tacticalSectionTickClasses"></span>
            {{
              $t("pages.settings.notification_preferences.push.categories")
            }}
          </div>
          <div
            class="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-card/30"
          >
            <label
              v-for="entry in pushKeys"
              :key="entry.key"
              class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-muted/20"
            >
              <div class="min-w-0 space-y-0.5">
                <span class="block text-sm font-medium leading-none">
                  {{ keyLabel(entry.key) }}
                </span>
                <span
                  v-if="keyDescription(entry.key)"
                  class="block text-xs text-muted-foreground"
                >
                  {{ keyDescription(entry.key) }}
                </span>
              </div>
              <Switch
                :model-value="entry.enabled"
                @update:model-value="
                  (value) => handlePreferenceToggle('push', entry.key, value)
                "
              />
            </label>
          </div>
        </div>
      </section>

      <!-- Alert bell -->
      <section v-if="alertKeys.length" class="space-y-2">
        <div :class="[tacticalSectionLabelClasses, 'mb-0']">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.settings.notification_preferences.alerts.title") }}
        </div>
        <p class="max-w-prose text-xs text-muted-foreground">
          {{ $t("pages.settings.notification_preferences.alerts.description") }}
        </p>
        <div
          class="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-card/30"
        >
          <label
            v-for="entry in alertKeys"
            :key="entry.key"
            class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-muted/20"
          >
            <div class="min-w-0 space-y-0.5">
              <span class="block text-sm font-medium leading-none">
                {{ keyLabel(entry.key) }}
              </span>
              <span
                v-if="keyDescription(entry.key)"
                class="block text-xs text-muted-foreground"
              >
                {{ keyDescription(entry.key) }}
              </span>
            </div>
            <Switch
              :model-value="entry.enabled"
              @update:model-value="
                (value) => handlePreferenceToggle('in_app', entry.key, value)
              "
            />
          </label>
        </div>
      </section>
    </div>
  </PageTransition>
</template>
