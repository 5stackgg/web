<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
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
const {
  preferences,
  quietHours,
  load,
  set,
  loadQuietHours,
  setQuietHours,
} = useNotificationPreferences();

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
  await loadQuietHours();
});

// Typing into a time input fires `change` per segment, so the inputs edit a
// local draft. Only a complete window (or a full reset) is worth a request --
// the backend rejects a half-set window with a 400.
const draftQuietStart = ref("");
const draftQuietEnd = ref("");

watch(
  quietHours,
  (stored) => {
    draftQuietStart.value = stored.start ?? "";
    draftQuietEnd.value = stored.end ?? "";
  },
  { immediate: true, deep: true },
);

const quietHoursIncomplete = computed(
  () => Boolean(draftQuietStart.value) !== Boolean(draftQuietEnd.value),
);

const quietHoursSet = computed(
  () => Boolean(quietHours.value.start) || Boolean(quietHours.value.end),
);

const canResetQuietHours = computed(
  () =>
    quietHoursSet.value ||
    Boolean(draftQuietStart.value) ||
    Boolean(draftQuietEnd.value),
);

const saveQuietHours = async (
  start: string | null,
  end: string | null,
) => {
  try {
    await setQuietHours({
      start: start || null,
      end: end || null,
      // Taken from the browser rather than asked for: the window has to mean
      // local wall-clock time, and this is the only place that actually knows
      // which zone that is.
      timezone:
        start && end
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : null,
    });
  } catch {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: t("pages.settings.notification_preferences.save_failed"),
    });
  }
};

const commitQuietHours = async () => {
  const start = draftQuietStart.value;
  const end = draftQuietEnd.value;

  // Half a window isn't a window yet -- wait for the other field.
  if (!start || !end) {
    return;
  }

  if (
    start === (quietHours.value.start ?? "") &&
    end === (quietHours.value.end ?? "")
  ) {
    return;
  }

  await saveQuietHours(start, end);
};

const resetQuietHours = async () => {
  draftQuietStart.value = "";
  draftQuietEnd.value = "";

  if (quietHoursSet.value) {
    await saveQuietHours(null, null);
  }
};

const canTogglePush = computed(
  () => push.supported.value && !push.isDenied.value && !push.busy.value,
);

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
          class="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card/40 p-4 [backdrop-filter:blur(6px)] transition-colors duration-150"
          :class="
            canTogglePush
              ? 'cursor-pointer select-none hover:bg-card/60'
              : 'cursor-not-allowed'
          "
          :role="canTogglePush ? 'button' : undefined"
          :tabindex="canTogglePush ? 0 : undefined"
          @click="canTogglePush && handlePushToggle(!push.subscribed.value)"
          @keydown.enter.self.prevent="
            canTogglePush && handlePushToggle(!push.subscribed.value)
          "
          @keydown.space.self.prevent="
            canTogglePush && handlePushToggle(!push.subscribed.value)
          "
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
            :disabled="!canTogglePush"
            @click.stop
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

      <!-- Quiet hours. Push only -- the bell keeps collecting, so nothing is
           lost, the phone just stays silent. -->
      <section v-if="push.subscribed.value" class="space-y-2">
        <div :class="[tacticalSectionLabelClasses, 'mb-0']">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.settings.notification_preferences.quiet_hours.title") }}
        </div>
        <p class="max-w-prose text-xs text-muted-foreground">
          {{
            $t("pages.settings.notification_preferences.quiet_hours.description")
          }}
        </p>
        <div
          class="space-y-2 rounded-lg border border-border/60 bg-card/30 px-4 py-3"
        >
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2">
              <span
                class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{
                  $t("pages.settings.notification_preferences.quiet_hours.from")
                }}
              </span>
              <input
                v-model="draftQuietStart"
                type="time"
                class="rounded-md border border-border bg-background px-2 py-1 font-mono text-sm tabular-nums"
                @change="commitQuietHours"
                @blur="commitQuietHours"
              />
            </label>
            <label class="flex items-center gap-2">
              <span
                class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{
                  $t("pages.settings.notification_preferences.quiet_hours.to")
                }}
              </span>
              <input
                v-model="draftQuietEnd"
                type="time"
                class="rounded-md border border-border bg-background px-2 py-1 font-mono text-sm tabular-nums"
                @change="commitQuietHours"
                @blur="commitQuietHours"
              />
            </label>
            <span
              v-if="quietHours.timezone"
              class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground/60"
            >
              {{ quietHours.timezone }}
            </span>
            <button
              v-if="canResetQuietHours"
              type="button"
              class="ml-auto font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              @click="resetQuietHours"
            >
              {{
                $t("pages.settings.notification_preferences.quiet_hours.reset")
              }}
            </button>
          </div>

          <!-- Half a window saves nothing, so say so rather than firing a
               request the backend rejects. -->
          <p
            v-if="quietHoursIncomplete"
            class="text-xs text-[hsl(var(--tac-amber))]"
          >
            {{
              $t("pages.settings.notification_preferences.quiet_hours.incomplete")
            }}
          </p>
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
