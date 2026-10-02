<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  AppWindow,
  Ban,
  Bell,
  CalendarClock,
  ChevronDown,
  Crosshair,
  Info,
  Layers,
  Lock,
  Mail,
  MessageSquare,
  Minus,
  MonitorDown,
  Play,
  Shield,
  Smartphone,
  Swords,
  Trophy,
  User,
  Volume2,
  VolumeX,
} from "lucide-vue-next";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import InstallPWA from "~/components/InstallPWA.vue";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { badgePopTransition, formatBadgeCount } from "~/utilities/badgeCount";
import { e_player_roles_enum } from "~/generated/zeus";
import {
  TAB_FLASH_KINDS,
  useTabFlashSettings,
} from "~/composables/useTabFlashSettings";
import { useSound } from "~/composables/useSound";
import type {
  NotificationCategoryType,
  NotificationChannel,
  NotificationPreference,
} from "~/composables/useNotificationPreferences";

const { t } = useI18n();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const push = usePushNotifications();
const {
  preferences,
  quietHours,
  load,
  set,
  loadQuietHours,
  setQuietHours,
} = useNotificationPreferences();
const {
  kindTitle,
  kindDescription,
  kindExample,
  categoryTitle,
  categoryDescription,
} = useNotificationKinds();

const isModerator = computed(() =>
  authStore.isRoleAbove(e_player_roles_enum.moderator),
);

const ready = ref(false);

onMounted(async () => {
  await push.refresh();
  await load();
  await loadQuietHours();
  ready.value = true;
});

const savePreference = async (
  channel: NotificationChannel,
  key: string,
  enabled: boolean,
) => {
  try {
    await set(channel, key, enabled);
  } catch {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: t("pages.settings.notifications.save_failed"),
    });
  }
};

const saveGroupPush = async (
  entry: NotificationPreference | undefined,
  enabled: boolean,
) => {
  if (!entry) {
    return;
  }
  await savePreference("push", entry.key, enabled);
};

type GroupDefinition = {
  id: string;
  icon: typeof Bell;
  push?: string;
  categories?: string[];
};

// Push stays one switch per category, as the api stores it. Match found, admin
// calls and match chat are categories of their own, so they ride in the
// matches group with their own switch.
const GROUPS: GroupDefinition[] = [
  {
    id: "matches",
    icon: Swords,
    push: "matches",
    categories: ["matches", "match_found", "match_chat", "admin_call"],
  },
  { id: "invites", icon: Mail, push: "invites", categories: ["invites"] },
  { id: "account", icon: User, push: "account", categories: ["account"] },
  {
    id: "teammate_bans",
    icon: Ban,
    push: "teammate_bans",
    categories: ["teammate_bans"],
  },
  { id: "chat", icon: MessageSquare, push: "chat", categories: ["chat"] },
  {
    id: "tournaments",
    icon: Trophy,
    push: "tournaments",
    categories: ["tournaments"],
  },
  {
    id: "leagues",
    icon: CalendarClock,
    push: "leagues",
    categories: ["leagues"],
  },
  { id: "scrims", icon: Crosshair, push: "scrims", categories: ["scrims"] },
  { id: "more", icon: Layers },
  { id: "staff", icon: Shield },
];

const CLAIMED_CATEGORIES = new Set(
  GROUPS.flatMap((group) => group.categories ?? []),
);

type Kind = NotificationCategoryType & {
  category: NotificationPreference;
  ownPush: boolean;
};

const bellToggle = (type: string) =>
  preferences.value.in_app.find((entry) => entry.key === type);

const groups = computed(() => {
  const visible = preferences.value.push.filter(
    (entry) => !entry.adminOnly || isModerator.value,
  );

  return GROUPS.map((group) => {
    const categories =
      group.id === "staff"
        ? visible.filter((entry) => entry.adminOnly)
        : group.categories
          ? group.categories
              .map((key) => visible.find((entry) => entry.key === key))
              .filter((entry): entry is NotificationPreference => !!entry)
          : visible.filter(
              (entry) =>
                !entry.adminOnly && !CLAIMED_CATEGORIES.has(entry.key),
            );

    const kinds: Kind[] = categories.flatMap((category) =>
      (category.types ?? []).map((entry) => ({
        ...entry,
        category,
        ownPush: category.key !== group.push,
      })),
    );

    return {
      ...group,
      pushEntry: categories.find((entry) => entry.key === group.push),
      kinds,
      hasBellSwitches: kinds.some((kind) => !!bellToggle(kind.type)),
    };
  }).filter((group) => group.kinds.length > 0);
});

const groupTitle = (group: GroupDefinition) =>
  group.push
    ? categoryTitle(group.push)
    : t(`pages.settings.notifications.catalog.groups.${group.id}.title`);

const groupDescription = (group: GroupDefinition) =>
  group.push
    ? categoryDescription(group.push)
    : t(`pages.settings.notifications.catalog.groups.${group.id}.description`);

const openGroups = ref<string[]>([
  "matches",
  "invites",
  "account",
  "teammate_bans",
]);

const isGroupOpen = (id: string) => openGroups.value.includes(id);

const toggleGroup = (id: string) => {
  openGroups.value = isGroupOpen(id)
    ? openGroups.value.filter((open) => open !== id)
    : [...openGroups.value, id];
};

// Push is the installed app's feature, on every platform. iOS enforces that on
// its own -- there is no PushManager in a Safari tab at all -- and everywhere
// else it's our own call: a notification that arrives when "5stack isn't open"
// should come from something the player actually installed.
const { installed, canInstall } = usePwaInstall();

const needsInstall = computed(() => !installed.value);

const pushState = computed(() => {
  if (push.subscribed.value) {
    return "on";
  }
  if (needsInstall.value) {
    return "needs_install";
  }
  if (!push.supported.value) {
    return "unavailable";
  }
  if (push.isDenied.value) {
    return "blocked";
  }
  return "off";
});

const pushBlocker = computed(() => {
  if (pushState.value === "unavailable") {
    return t("pages.settings.notifications.channels.push.unsupported");
  }
  if (pushState.value === "blocked") {
    return t("pages.settings.notifications.channels.push.denied");
  }
  return "";
});

const canTogglePush = computed(() => {
  if (push.busy.value) {
    return false;
  }

  // Turning it *off* always has to work. Someone who subscribed from a browser
  // tab before this gate existed still needs a way back out of it.
  if (push.subscribed.value) {
    return true;
  }

  return installed.value && push.supported.value && !push.isDenied.value;
});

const handlePushToggle = async (enabled: boolean) => {
  if (enabled) {
    // subscribe() bounds every step now, so a stuck push service rejects
    // instead of hanging -- without this catch that rejection went nowhere and
    // the toggle just sat there, which is exactly what "nothing happens when I
    // tap enable" was.
    let granted = false;
    try {
      // Called straight from the toggle so the permission prompt stays
      // attributable to the click -- see usePushNotifications.
      granted = await push.subscribe();
    } catch {
      // Fall through to the toast below; push.lastError names the stuck step.
    }

    if (granted) {
      toast({
        title: t("pages.settings.notifications.channels.push.enabled_toast"),
      });
      await load("push");
      return;
    }

    toast({
      variant: "destructive",
      title: t("common.error"),
      description: push.isDenied.value
        ? t("pages.settings.notifications.channels.push.denied")
        : push.lastError.value
          ? t(push.lastError.value)
          : t("pages.settings.notifications.channels.push.failed"),
    });
    return;
  }

  await push.unsubscribe();
  toast({
    title: t("pages.settings.notifications.channels.push.disabled_toast"),
  });
};

const unreadCount = computed(() => notificationStore.unreadNotificationCount);

const { enabled: tabFlashEnabled, setEnabled: setTabFlashEnabled } =
  useTabFlashSettings();

const {
  isEnabled: soundsEnabled,
  volume,
  updateSettings,
  playNotificationSound,
  playMatchFoundSound,
  playTickSound,
  playCountdownSound,
} = useSound();

const handleVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  updateSettings(soundsEnabled.value, parseFloat(target.value));
};

const lastVolume = ref(volume.value || 0.7);

const toggleMute = () => {
  if (volume.value === 0) {
    updateSettings(soundsEnabled.value, lastVolume.value || 0.7);
  } else {
    lastVolume.value = volume.value;
    updateSettings(soundsEnabled.value, 0);
  }
};

const sounds = computed(() => {
  const list = [
    { key: "chat", play: playNotificationSound },
    { key: "match_found", play: playMatchFoundSound },
  ];

  if (authStore.isAdmin) {
    list.push({ key: "tick", play: playTickSound });
    list.push({ key: "countdown", play: playCountdownSound });
  }

  return list;
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

const saveQuietHours = async (start: string | null, end: string | null) => {
  try {
    await setQuietHours({
      start: start || null,
      end: end || null,
      // Taken from the browser rather than asked for: the window has to mean
      // local wall-clock time, and this is the only place that actually knows
      // which zone that is.
      timezone:
        start && end ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
    });
  } catch {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: t("pages.settings.notifications.save_failed"),
    });
  }
};

const commitQuietHours = async () => {
  const start = draftQuietStart.value;
  const end = draftQuietEnd.value;

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

const channelIconOn =
  "bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))] ring-1 ring-inset ring-[hsl(var(--tac-amber)/0.25)]";
const channelIconOff =
  "bg-muted text-muted-foreground ring-1 ring-inset ring-border";
</script>

<template>
  <PageTransition :delay="0">
    <div class="space-y-8">
      <p class="max-w-prose text-sm text-muted-foreground">
        {{ $t("pages.settings.notifications.description") }}
      </p>

      <section>
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.settings.notifications.channels.title") }}
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div
            data-test="channel-bell"
            class="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3.5"
          >
            <div class="flex items-center gap-2.5">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                :class="channelIconOn"
              >
                <Bell class="h-4 w-4" />
              </span>
              <div class="min-w-0">
                <p class="text-sm font-medium leading-none">
                  {{ $t("pages.settings.notifications.channels.bell.title") }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{
                    $t("pages.settings.notifications.channels.bell.description")
                  }}
                </p>
              </div>
            </div>
            <i18n-t
              keypath="pages.settings.notifications.channels.bell.unread"
              tag="p"
              scope="global"
              class="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              <template #count>
                <span class="inline-flex h-3.5 min-w-3.5 items-center">
                  <Transition v-bind="badgePopTransition" mode="out-in">
                    <span
                      v-if="unreadCount > 0"
                      key="unread"
                      class="inline-flex h-3.5 min-w-3.5 origin-center items-center justify-center rounded-full bg-red-500 px-0.5 text-[0.55rem] font-bold leading-none tracking-normal text-white tabular-nums"
                    >
                      <AnimatedStat :value="formatBadgeCount(unreadCount)" />
                    </span>
                    <span v-else key="none" class="tabular-nums">0</span>
                  </Transition>
                </span>
              </template>
            </i18n-t>
          </div>

          <div
            data-test="channel-push"
            class="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3.5"
          >
            <div class="flex items-center gap-2.5">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ease-out motion-reduce:transition-none"
                :class="push.subscribed.value ? channelIconOn : channelIconOff"
              >
                <Smartphone class="h-4 w-4" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium leading-none">
                  {{ $t("pages.settings.notifications.channels.push.title") }}
                </p>
                <FadeSwap>
                  <p
                    :key="pushState"
                    class="mt-1 text-xs text-muted-foreground"
                  >
                    {{
                      $t(
                        `pages.settings.notifications.channels.push.${pushState}`,
                      )
                    }}
                  </p>
                </FadeSwap>
              </div>
              <Switch
                :model-value="push.subscribed.value"
                :disabled="!canTogglePush"
                :aria-label="
                  $t('pages.settings.notifications.channels.push.toggle')
                "
                @update:model-value="handlePushToggle"
              />
            </div>
            <p
              class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("pages.settings.notifications.channels.push.caption") }}
            </p>
          </div>

          <div
            data-test="channel-tab-flash"
            class="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3.5"
          >
            <div class="flex items-center gap-2.5">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                :class="channelIconOn"
              >
                <AppWindow class="h-4 w-4" />
              </span>
              <div class="min-w-0">
                <p class="text-sm font-medium leading-none">
                  {{
                    $t("pages.settings.notifications.channels.tab_flash.title")
                  }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.notifications.channels.tab_flash.description",
                    )
                  }}
                </p>
              </div>
            </div>
            <div class="divide-y divide-border/40">
              <label
                v-for="kind in TAB_FLASH_KINDS"
                :key="kind"
                :title="
                  $t(
                    `pages.settings.notifications.channels.tab_flash.${kind}.description`,
                  )
                "
                class="flex cursor-pointer items-center justify-between gap-3 py-1.5"
              >
                <span class="text-xs">
                  {{
                    $t(
                      `pages.settings.notifications.channels.tab_flash.${kind}.title`,
                    )
                  }}
                </span>
                <Switch
                  :model-value="tabFlashEnabled[kind]"
                  @update:model-value="
                    (value) => setTabFlashEnabled(kind, value)
                  "
                />
              </label>
            </div>
            <p
              class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{
                $t("pages.settings.notifications.channels.tab_flash.caption")
              }}
            </p>
          </div>

          <div
            data-test="channel-sounds"
            class="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3.5"
          >
            <div class="flex items-center gap-2.5">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ease-out motion-reduce:transition-none"
                :class="soundsEnabled ? channelIconOn : channelIconOff"
              >
                <component
                  :is="soundsEnabled ? Volume2 : VolumeX"
                  class="h-4 w-4"
                />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium leading-none">
                  {{ $t("pages.settings.notifications.channels.sounds.title") }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.notifications.channels.sounds.description",
                    )
                  }}
                </p>
              </div>
              <Switch
                :model-value="soundsEnabled"
                :aria-label="
                  $t('pages.settings.notifications.channels.sounds.title')
                "
                @update:model-value="(value) => updateSettings(value)"
              />
            </div>
            <Fold :open="soundsEnabled">
              <div class="space-y-2 pt-1">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="text-muted-foreground transition-colors duration-150 hover:text-foreground motion-reduce:transition-none"
                    :aria-label="
                      $t(
                        volume === 0
                          ? 'pages.settings.notifications.channels.sounds.unmute'
                          : 'pages.settings.notifications.channels.sounds.mute',
                      )
                    "
                    @click="toggleMute"
                  >
                    <VolumeX v-if="volume === 0" class="h-3.5 w-3.5" />
                    <Volume2 v-else class="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="range"
                    :value="volume"
                    :max="1"
                    :min="0"
                    :step="0.05"
                    :aria-label="
                      $t('pages.settings.notifications.channels.sounds.volume')
                    "
                    class="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[hsl(var(--tac-amber))]"
                    @input="handleVolumeChange"
                  />
                  <span
                    class="w-8 shrink-0 text-right font-mono text-[0.6rem] tabular-nums text-muted-foreground"
                  >
                    {{ Math.round(volume * 100) }}%
                  </span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="sound in sounds"
                    :key="sound.key"
                    type="button"
                    data-test="sound-test"
                    :title="
                      $t(
                        `pages.settings.notifications.channels.sounds.kinds.${sound.key}.description`,
                      )
                    "
                    class="inline-flex h-6 items-center gap-1 rounded-md border border-border px-1.5 text-[0.65rem] text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.4)] hover:text-[hsl(var(--tac-amber))] motion-reduce:transition-none"
                    @click="sound.play()"
                  >
                    <Play class="h-3 w-3" />
                    {{
                      $t(
                        `pages.settings.notifications.channels.sounds.kinds.${sound.key}.title`,
                      )
                    }}
                  </button>
                </div>
              </div>
            </Fold>
          </div>
        </div>

        <Fold :open="!push.subscribed.value">
          <div
            class="mt-3 flex items-start gap-2 rounded-md border border-border/60 bg-card/30 px-3 py-2 text-xs text-muted-foreground"
          >
            <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <div class="space-y-1">
              <p>
                {{ $t("pages.settings.notifications.channels.push.off_hint") }}
              </p>
              <p v-if="pushBlocker" class="text-[hsl(var(--tac-amber))]">
                {{ pushBlocker }}
              </p>
            </div>
          </div>
        </Fold>

        <Fold :open="needsInstall">
          <div
            class="mt-3 flex items-start gap-3 rounded-lg border border-dashed border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.03)] p-4"
          >
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--tac-amber)/0.1)] ring-1 ring-inset ring-[hsl(var(--tac-amber)/0.25)]"
            >
              <MonitorDown class="h-5 w-5 text-[hsl(var(--tac-amber))]" />
            </div>
            <div class="space-y-3">
              <p class="max-w-prose text-sm text-muted-foreground">
                {{
                  $t(
                    "pages.settings.notifications.channels.push.install.description",
                  )
                }}
              </p>
              <InstallPWA v-if="canInstall" :is-menu-item="false" show-label />
              <!-- Installed already, but being read from a plain browser tab:
                   there's nothing left to install, only somewhere else to open
                   it. -->
              <p v-else class="max-w-prose text-xs text-muted-foreground/80">
                {{
                  $t(
                    "pages.settings.notifications.channels.push.install.open_app",
                  )
                }}
              </p>
            </div>
          </div>
        </Fold>
      </section>

      <section class="space-y-3">
        <div class="flex items-end justify-between gap-3">
          <div :class="[tacticalSectionLabelClasses, 'mb-0']">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("pages.settings.notifications.catalog.title") }}
          </div>
          <div
            class="hidden grid-cols-[3.25rem_3.25rem] gap-2 pr-4 text-center font-mono text-[0.58rem] font-bold uppercase tracking-[0.16em] text-muted-foreground sm:grid"
          >
            <span>{{
              $t("pages.settings.notifications.channels.bell.title")
            }}</span>
            <span>{{
              $t("pages.settings.notifications.channels.push.title")
            }}</span>
          </div>
        </div>

        <PageTransition swap>
          <div v-if="!ready" key="loading" class="flex flex-col gap-2.5">
            <div
              v-for="n in 4"
              :key="n"
              class="flex items-center gap-3 rounded-lg border border-border/60 bg-card/30 px-4 py-3"
            >
              <div class="h-8 w-8 shrink-0 animate-pulse rounded-md bg-muted" />
              <div class="min-w-0 flex-1 space-y-2">
                <div class="h-4 w-32 animate-pulse rounded bg-muted" />
                <div
                  class="h-3 w-56 max-w-full animate-pulse rounded bg-muted/60"
                />
              </div>
              <div
                class="h-5 w-9 shrink-0 animate-pulse rounded-full bg-muted"
              />
            </div>
          </div>

          <p
            v-else-if="groups.length === 0"
            key="failed"
            class="rounded-lg border border-dashed border-border/60 bg-card/20 px-4 py-8 text-center text-xs text-muted-foreground"
          >
            {{ $t("pages.settings.notifications.load_failed") }}
          </p>

          <div v-else key="catalog" class="flex flex-col gap-2.5">
            <div
              v-for="group in groups"
              :key="group.id"
              :data-test="`notification-group-${group.id}`"
              class="overflow-hidden rounded-lg border border-border/60 bg-card/30"
            >
              <div class="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  class="flex min-w-0 flex-1 items-center gap-3 text-left"
                  :aria-expanded="isGroupOpen(group.id)"
                  @click="toggleGroup(group.id)"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"
                  >
                    <component :is="group.icon" class="h-4 w-4" />
                  </span>
                  <span class="min-w-0">
                    <span class="flex items-center text-sm font-semibold">
                      {{ groupTitle(group) }}
                      <span
                        v-if="group.id === 'staff'"
                        class="ml-2 inline-flex items-center rounded-sm border border-border bg-muted/40 px-1 py-0.5 font-mono text-[0.5rem] font-bold uppercase leading-none tracking-wider text-muted-foreground"
                      >
                        {{
                          $t("pages.settings.notifications.catalog.staff_only")
                        }}
                      </span>
                    </span>
                    <span class="block truncate text-xs text-muted-foreground">
                      {{ groupDescription(group) }} ·
                      {{
                        $t(
                          "pages.settings.notifications.catalog.kinds_count",
                          { count: group.kinds.length },
                          group.kinds.length,
                        )
                      }}
                    </span>
                  </span>
                  <ChevronDown
                    class="ml-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none"
                    :class="isGroupOpen(group.id) ? '' : '-rotate-90'"
                    aria-hidden="true"
                  />
                </button>
                <div class="flex shrink-0 items-center gap-2">
                  <span
                    class="inline-flex w-[3.25rem] justify-center font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    <template v-if="group.hasBellSwitches">
                      {{ $t("pages.settings.notifications.catalog.per_kind") }}
                    </template>
                  </span>
                  <span
                    class="inline-flex w-[3.25rem] justify-center"
                    data-test="group-push"
                  >
                    <Switch
                      v-if="group.pushEntry"
                      :model-value="group.pushEntry.enabled"
                      :aria-label="
                        $t('pages.settings.notifications.catalog.push_for', {
                          kind: groupTitle(group),
                        })
                      "
                      @update:model-value="
                        (value) => saveGroupPush(group.pushEntry, value)
                      "
                    />
                  </span>
                </div>
              </div>

              <Fold :open="isGroupOpen(group.id)">
                <div
                  class="divide-y divide-border/50 border-t border-border/50"
                >
                  <div
                    v-for="kind in group.kinds"
                    :key="kind.type"
                    :data-test="`notification-kind-${kind.type}`"
                    class="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/20 motion-reduce:transition-none"
                  >
                    <div class="min-w-0 space-y-0.5">
                      <p class="text-sm font-medium leading-snug">
                        {{ kindTitle(kind.type) }}
                        <span
                          v-if="kind.ignoresQuietHours"
                          class="ml-1 inline-flex items-center rounded-sm border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-1 py-0.5 font-mono text-[0.5rem] font-bold uppercase leading-none tracking-wider text-[hsl(var(--tac-amber))]"
                        >
                          {{
                            $t(
                              "pages.settings.notifications.catalog.rings_in_quiet_hours",
                            )
                          }}
                        </span>
                        <span
                          v-else-if="
                            kind.ownPush && !kind.category.defaultEnabled
                          "
                          class="ml-1 inline-flex items-center rounded-sm border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-1 py-0.5 font-mono text-[0.5rem] font-bold uppercase leading-none tracking-wider text-[hsl(var(--tac-amber))]"
                        >
                          {{
                            $t(
                              "pages.settings.notifications.catalog.push_off_by_default",
                            )
                          }}
                        </span>
                      </p>
                      <p
                        v-if="kindDescription(kind.type)"
                        class="text-xs text-muted-foreground"
                      >
                        {{ kindDescription(kind.type) }}
                      </p>
                      <p
                        v-if="kindExample(kind.type)"
                        data-test="kind-example"
                        class="truncate text-[11px] italic text-muted-foreground/70"
                      >
                        “{{ kindExample(kind.type) }}”
                      </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <span
                        class="inline-flex w-[3.25rem] justify-center"
                        data-test="kind-bell"
                      >
                        <Switch
                          v-if="bellToggle(kind.type)"
                          :model-value="bellToggle(kind.type)?.enabled"
                          :aria-label="
                            $t('pages.settings.notifications.catalog.in_bell', {
                              kind: kindTitle(kind.type),
                            })
                          "
                          @update:model-value="
                            (value) =>
                              savePreference('in_app', kind.type, value)
                          "
                        />
                        <FiveStackToolTip v-else-if="kind.bell === 'push_only'">
                          {{
                            $t("pages.settings.notifications.catalog.push_only")
                          }}
                          <template #trigger>
                            <Minus
                              class="h-3 w-3 text-muted-foreground/60"
                              aria-hidden="true"
                            />
                            <span class="sr-only">{{
                              $t(
                                "pages.settings.notifications.catalog.push_only",
                              )
                            }}</span>
                          </template>
                        </FiveStackToolTip>
                        <FiveStackToolTip v-else>
                          {{
                            $t(
                              group.id === "staff"
                                ? "pages.settings.notifications.catalog.staff_locked"
                                : "pages.settings.notifications.catalog.locked",
                            )
                          }}
                          <template #trigger>
                            <Lock
                              class="h-3 w-3 text-muted-foreground"
                              aria-hidden="true"
                            />
                            <span class="sr-only">{{
                              $t(
                                group.id === "staff"
                                  ? "pages.settings.notifications.catalog.staff_locked"
                                  : "pages.settings.notifications.catalog.locked",
                              )
                            }}</span>
                          </template>
                        </FiveStackToolTip>
                      </span>
                      <span
                        class="inline-flex w-[3.25rem] justify-center"
                        data-test="kind-push"
                      >
                        <Switch
                          v-if="kind.ownPush"
                          :model-value="kind.category.enabled"
                          :aria-label="
                            $t('pages.settings.notifications.catalog.push_for', {
                              kind: categoryTitle(kind.category.key),
                            })
                          "
                          @update:model-value="
                            (value) =>
                              savePreference('push', kind.category.key, value)
                          "
                        />
                        <span
                          v-else
                          class="font-mono text-[0.6rem] text-muted-foreground/50"
                          :title="
                            $t(
                              'pages.settings.notifications.catalog.follows_group',
                            )
                          "
                          >·</span
                        >
                      </span>
                    </div>
                  </div>
                </div>
              </Fold>
            </div>
          </div>
        </PageTransition>
      </section>

      <section class="space-y-2">
        <div :class="[tacticalSectionLabelClasses, 'mb-0']">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("pages.settings.notifications.quiet_hours.title") }}
        </div>
        <p class="max-w-prose text-xs text-muted-foreground">
          {{ $t("pages.settings.notifications.quiet_hours.description") }}
        </p>
        <div
          class="space-y-2 rounded-lg border border-border/60 bg-card/30 px-4 py-3"
        >
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center gap-2">
              <span
                class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
              >
                {{ $t("pages.settings.notifications.quiet_hours.from") }}
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
                {{ $t("pages.settings.notifications.quiet_hours.to") }}
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
              {{ $t("pages.settings.notifications.quiet_hours.reset") }}
            </button>
          </div>

          <Fold :open="quietHoursIncomplete">
            <p class="text-xs text-[hsl(var(--tac-amber))]">
              {{ $t("pages.settings.notifications.quiet_hours.incomplete") }}
            </p>
          </Fold>
        </div>
      </section>
    </div>
  </PageTransition>
</template>
