<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useApolloClient } from "@vue/apollo-composable";
import gql from "graphql-tag";
import {
  Square,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  ArrowLeftRight,
  ArrowRightLeft,
  Scan,
  Trophy,
  RefreshCw,
  Bot,
  Keyboard,
  ExternalLink,
} from "lucide-vue-next";
import { useToast } from "~/components/ui/toast/use-toast";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Spinner } from "~/components/ui/spinner";
import { Kbd } from "~/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import StreamCanvas from "~/components/match/StreamCanvas.vue";
import BootSequence from "~/components/match/BootSequence.vue";
import DesktopSnapshot from "~/components/match/DesktopSnapshot.vue";
import ShortcutOverlay from "~/components/match/ShortcutOverlay.vue";
import StreamLiveTag from "~/components/match/StreamLiveTag.vue";
import SpectatorGrid from "~/components/stream-deck/SpectatorGrid.vue";
import StopBroadcastDialog from "~/components/stream-deck/StopBroadcastDialog.vue";
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import {
  broadcastHudLabel,
  useBroadcastHuds,
} from "~/composables/useBroadcastHuds";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useStreamerGsi } from "~/composables/useStreamerGsi";
import { useStreamerStore } from "~/stores/StreamerStore";
import { useAuthStore } from "~/stores/AuthStore";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import {
  specSlotsForMatchType,
  resolveKeyToRealSlot,
  type SpecSlot,
} from "~/utilities/streamerSpecSlots";

// The per-match broadcast deck: toolbar, program feed, auto-director note and
// the observer-target slots. One component for both surfaces -- the focus
// window (/stream-deck/[matchId], `page`) and the Control Room's sheet
// (`sheet`) -- so a control added to one is never missing from the other.
//
// `page` owns the whole window, so its keys work anywhere. In `sheet` the keys
// only act while focus is inside the deck, and Tab only holds the scoreboard
// when the deck itself has focus, so it still moves through the controls.
const props = withDefaults(
  defineProps<{
    matchId: string;
    variant?: "page" | "sheet";
  }>(),
  { variant: "page" },
);

const emit = defineEmits<{
  (e: "switched", matchId: string): void;
  (e: "stopped"): void;
}>();

const { t } = useI18n();
const { toast } = useToast();
const { client: apolloClient } = useApolloClient();

const matchId = computed(() => props.matchId);

const streamerStore = useStreamerStore();
streamerStore.subscribeToLiveStreams();
const stream = computed<any | null>(() => {
  const list: any[] = streamerStore.liveStreams ?? [];
  return list.find((s) => s?.match_id === matchId.value) ?? null;
});

const matchName = computed(
  () =>
    `${stream.value?.match?.lineup_1?.name ?? t("common.team_a")} ${t("common.vs")} ${stream.value?.match?.lineup_2?.name ?? t("common.team_b")}`,
);

// Anti-cheat: a rostered player/coach -- even an admin/streamer -- must never
// see the live feed of a match they're in. The server enforces it with a 401
// on the WHEP endpoint; gating here means we never try to connect.
const authStore = useAuthStore();
const isInLineup = ref(false);
// Until this answers we don't know whether the viewer is playing: rendering the
// canvas on a guess would flash the feed at a rostered player.
const lineupResolved = ref(false);
let lineupSub: { unsubscribe: () => void } | undefined;

function ensureLineupSubscription() {
  lineupSub?.unsubscribe();
  lineupSub = undefined;
  if (!authStore.me?.steam_id) {
    isInLineup.value = false;
    lineupResolved.value = true;
    return;
  }
  lineupResolved.value = false;
  lineupSub = apolloClient
    .subscribe({
      query: generateSubscription({
        matches_by_pk: [
          { id: matchId.value },
          { is_in_lineup: true, is_coach: true },
        ],
      } as any),
    })
    .subscribe({
      next: (result: any) => {
        const m = result?.data?.matches_by_pk;
        isInLineup.value = !!(m?.is_in_lineup || m?.is_coach);
        lineupResolved.value = true;
      },
      error: (err: any) => {
        console.error("[control-room] lineup subscription error", err);
        // Resolved-but-denied: never stuck, never falls open to the feed.
        isInLineup.value = true;
        lineupResolved.value = true;
      },
    });
}

const canView = computed(() => !isInLineup.value);
const streamStateKnown = computed(
  () => streamerStore.hasLoaded && lineupResolved.value,
);

const autodirector = ref(true);
const busy = ref(false);
const busyAction = ref<string | undefined>(undefined);

// Mirror the persisted flag into the local toggle, but not mid-mutation, so an
// optimistic flip doesn't bounce back.
watch(
  () => stream.value?.autodirector,
  (val) => {
    if (val === undefined || val === null) return;
    if (busy.value) return;
    autodirector.value = !!val;
  },
  { immediate: true },
);

async function runMutation(
  action: string,
  build: () => Record<string, unknown>,
  params?: Record<string, unknown>,
): Promise<boolean> {
  if (busy.value) return false;
  busy.value = true;
  busyAction.value = action;
  try {
    await apolloClient.mutate({ mutation: generateMutation(build()) });
    return true;
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t(`stream_deck.actions.${action}`, params ?? {}),
      description: error?.message ?? t("toasts.request_failed"),
    });
    return false;
  } finally {
    busy.value = false;
    busyAction.value = undefined;
  }
}

const slotKeys = computed<SpecSlot[]>(() =>
  specSlotsForMatchType(stream.value?.match?.options?.type),
);

const isLive = computed(() => !!stream.value?.is_live);
// Pressing a target is a manual takeover, so autodirector is not part of
// this gate (see takeManualControl).
const controlsActive = computed(() => isLive.value && !busy.value);

async function takeManualControl() {
  if (autodirector.value) {
    await setAutodirector(false);
  }
}

async function pressSlot(slot: number) {
  flashForSlot(slot);
  if (!controlsActive.value) return;
  await takeManualControl();
  await runMutation(
    "spec_slot",
    () => ({
      specSlot: [{ match_id: matchId.value, slot }, { success: true }],
    }),
    { slot },
  );
}

async function pressClick(button: "left" | "right") {
  if (!controlsActive.value) return;
  await takeManualControl();
  await runMutation(
    "spec_click",
    () => ({
      specClick: [{ match_id: matchId.value, button }, { success: true }],
    }),
    { button },
  );
}

async function pressJump() {
  if (!controlsActive.value) return;
  await takeManualControl();
  await runMutation("spec_jump", () => ({
    specJump: [{ match_id: matchId.value }, { success: true }],
  }));
}

async function setAutodirector(enabled: boolean) {
  autodirector.value = enabled;
  await runMutation("spec_autodirector", () => ({
    specAutodirector: [{ match_id: matchId.value, enabled }, { success: true }],
  }));
}

const { huds: broadcastHuds } = useBroadcastHuds();
const hudSlug = ref<string>(useApplicationSettingsStore().defaultBroadcastHud);
const xrayEnabled = ref(false);
const hudVisible = ref(true);

async function setHud(slug: string) {
  const needsShow = !hudVisible.value;
  if (hudSlug.value === slug && !needsShow) return;
  hudSlug.value = slug;
  await runMutation("set_hud_mode", () => ({
    setHudMode: [{ match_id: matchId.value, mode: slug }, { success: true }],
  }));
  if (needsShow) await setHudVisible(true);
}

async function toggleXray() {
  xrayEnabled.value = !xrayEnabled.value;
  await runMutation("spec_xray", () => ({
    specXray: [
      { match_id: matchId.value, enabled: xrayEnabled.value },
      { success: true },
    ],
  }));
}

async function setHudVisible(visible: boolean) {
  if (hudVisible.value === visible) return;
  hudVisible.value = visible;
  await runMutation("spec_hud", () => ({
    specHud: [{ match_id: matchId.value, visible }, { success: true }],
  }));
}

async function toggleHudSides() {
  await runMutation("swap_sides", () => ({
    specHudSides: [{ match_id: matchId.value }, { success: true }],
  }));
}

// Rebuilds the overlay so mid-match edits (a swapped player image, a renamed
// team) repaint without flipping modes.
async function refreshHud() {
  await runMutation("refresh_hud", () => ({
    refreshLiveHud: [{ match_id: matchId.value }, { success: true }],
  }));
}

// Hold-to-show scoreboard. Bypasses runMutation's busy gate on purpose: the
// gate drops queued calls, which would leave the scoreboard stuck on if the
// button is released before +showscores returns.
let scoreboardHeld = false;
function setScoreboard(show: boolean) {
  void apolloClient
    .mutate({
      mutation: generateMutation({
        specScoreboard: [{ match_id: matchId.value, show }, { success: true }],
      }),
    })
    .catch(() => undefined);
}

async function reconnectLive() {
  await runMutation("reconnect", () => ({
    reconnectLive: [{ match_id: matchId.value }, { success: true }],
  }));
  toast({
    title: t("toasts.reconnecting"),
    description: t("toasts.reconnecting_description"),
  });
}

const skippingShaders = ref(false);
async function onSkipShaders() {
  if (skippingShaders.value) return;
  skippingShaders.value = true;
  try {
    await runMutation("skip_shaders", () => ({
      skipShaders: [{ match_id: matchId.value }, { success: true }],
    }));
  } finally {
    skippingShaders.value = false;
  }
}

const otherLiveMatches = ref<
  Array<{
    id: string;
    lineup_1: { name: string | null } | null;
    lineup_2: { name: string | null } | null;
  }>
>([]);
let liveMatchesSub: { unsubscribe: () => void } | undefined;

const SWITCH_LIVE_MATCH_MUTATION = gql`
  mutation SwitchLiveMatch(
    $from_match_id: uuid!
    $to_match_id: uuid!
    $mode: String!
  ) {
    switchLiveMatch(
      from_match_id: $from_match_id
      to_match_id: $to_match_id
      mode: $mode
    ) {
      success
    }
  }
`;

const switchOpen = ref(false);
const switching = ref<string | null>(null);
async function switchTo(toMatchId: string) {
  if (switching.value || toMatchId === matchId.value) return;
  switching.value = toMatchId;
  switchOpen.value = false;
  try {
    await apolloClient.mutate({
      mutation: SWITCH_LIVE_MATCH_MUTATION,
      variables: {
        from_match_id: matchId.value,
        to_match_id: toMatchId,
        mode: "live",
      },
    });
    toast({
      title: t("toasts.stream_switched"),
      description: t("toasts.stream_switched_description"),
    });
    emit("switched", toMatchId);
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("toasts.switch_failed"),
      description: error?.message ?? t("toasts.request_failed"),
    });
  } finally {
    switching.value = null;
  }
}

const stopOpen = ref(false);
async function stopLive() {
  const stopped = await runMutation("stop_live", () => ({
    stopLive: [{ match_id: matchId.value }, { success: true }],
  }));
  if (stopped) emit("stopped");
}

function isTypingInForm(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return true;
  return target.isContentEditable === true;
}

const shortcutsOpen = ref(false);
const SHORTCUT_GROUPS = computed(() => [
  {
    title: t("shortcut_groups.spectate"),
    items: [
      {
        keys: ["1", "—", "0"],
        label: t("shortcut_groups.switch_player", {
          count: slotKeys.value.length,
        }),
      },
      { keys: ["←"], label: t("shortcut_groups.prev_spec") },
      { keys: ["→"], label: t("shortcut_groups.next_spec") },
      { keys: ["Space"], label: t("shortcut_groups.lock_free_roam") },
    ],
  },
  {
    title: t("shortcut_groups.view"),
    items: [
      { keys: ["F"], label: t("shortcut_groups.toggle_fullscreen") },
      { keys: ["Tab"], label: t("shortcut_groups.hold_show_scoreboard") },
      { keys: ["?"], label: t("shortcut_groups.show_help") },
    ],
  },
]);

// Fullscreens the deck itself (toolbar, feed and slots), so the caster keeps
// every control while the broadcast fills the screen. WhepPlayer's own F is
// off (`disable-fullscreen-shortcut`) so one press doesn't fire two requests.
const deckRoot = ref<HTMLDivElement | null>(null);
const isFullscreen = ref(false);
async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined);
  } else if (deckRoot.value) {
    await deckRoot.value.requestFullscreen().catch(() => undefined);
  }
}
function onFullscreenChange() {
  isFullscreen.value =
    !!document.fullscreenElement &&
    document.fullscreenElement === deckRoot.value;
}

function keysActive() {
  if (props.variant === "page") return true;
  const root = deckRoot.value;
  return !!root && root.contains(document.activeElement);
}

// Window capture phase: runs before the sheet's own Escape handling, so Esc
// closes the shortcuts overlay instead of the sheet behind it.
function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (isTypingInForm(e.target)) return;
  if (!keysActive()) return;
  if (stopOpen.value || switchOpen.value) return;

  if (e.key === "Escape" && shortcutsOpen.value) {
    e.preventDefault();
    e.stopPropagation();
    shortcutsOpen.value = false;
    return;
  }

  if (e.key === "Tab") {
    if (
      props.variant === "sheet" &&
      document.activeElement !== deckRoot.value
    ) {
      return;
    }
    e.preventDefault();
    if (!scoreboardHeld) startScoreboardHold();
    return;
  }

  if (e.key === "?" || (e.shiftKey && e.key === "/")) {
    e.preventDefault();
    shortcutsOpen.value = !shortcutsOpen.value;
    return;
  }
  if (e.key === "f" || e.key === "F") {
    e.preventDefault();
    void toggleFullscreen();
    return;
  }

  if (e.repeat) return;

  // Digits map the key's position in the slot row to the real GSI slot of
  // whoever is there, so the key matches the chip on the tile.
  if (/^[0-9]$/.test(e.key)) {
    const real = resolveKeyToRealSlot(
      e.key,
      ctSlots.value,
      tSlots.value,
      stream.value?.match?.options?.type,
    );
    if (real != null) {
      e.preventDefault();
      void pressSlot(real);
    }
    return;
  }

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    // cs2: right click cycles to the previous spec target
    void pressClick("right");
    return;
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    void pressClick("left");
    return;
  }
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    void pressJump();
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.key === "Tab" && scoreboardHeld) {
    e.preventDefault();
    endScoreboardHold();
  }
}

// mousedown / Tab keydown -> +showscores; mouseup / Tab keyup / blur ->
// -showscores. Window-level mouseup so a drag-off still drops it, blur for
// the alt-tab case where keyup never fires.
function startScoreboardHold() {
  if (scoreboardHeld) return;
  scoreboardHeld = true;
  setScoreboard(true);
  window.addEventListener("mouseup", endScoreboardHold);
  window.addEventListener("blur", endScoreboardHold);
}
function endScoreboardHold() {
  if (!scoreboardHeld) return;
  scoreboardHeld = false;
  setScoreboard(false);
  window.removeEventListener("mouseup", endScoreboardHold);
  window.removeEventListener("blur", endScoreboardHold);
}

onMounted(() => {
  ensureLineupSubscription();
  liveMatchesSub = apolloClient
    .subscribe({
      query: generateSubscription({
        matches: [
          { where: { status: { _eq: "Live" } } as any },
          {
            id: true,
            lineup_1: { name: true },
            lineup_2: { name: true },
          } as any,
        ],
      } as any),
    })
    .subscribe({
      next: ({ data }: any) => {
        otherLiveMatches.value = ((data?.matches ?? []) as Array<any>).filter(
          (m) => m.id !== matchId.value,
        );
      },
    });
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  document.addEventListener("fullscreenchange", onFullscreenChange);
});

onBeforeUnmount(() => {
  liveMatchesSub?.unsubscribe();
  lineupSub?.unsubscribe();
  window.removeEventListener("keydown", onKeyDown, true);
  window.removeEventListener("keyup", onKeyUp, true);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  if (flashSlotTimer) clearTimeout(flashSlotTimer);
  endScoreboardHold();
  if (isFullscreen.value) {
    void document.exitFullscreen().catch(() => undefined);
  }
});

watch([matchId, () => authStore.me?.steam_id], () => {
  ensureLineupSubscription();
});

// Same composable the slot grid uses, so key presses resolve against the
// exact CT/T rows on screen.
const isLiveRef = computed(() => isLive.value);
const { ctSlots, tSlots, spectatedSteamId } = useStreamerGsi(
  matchId,
  isLiveRef,
);

// A pressed slot glows until GSI confirms cs2 switched to it (the active
// styling then carries it) or 2.5s pass, so a press never reads as ignored
// while the ~1s GSI poll catches up.
const flashSlot = ref<number | null>(null);
let flashSlotTimer: ReturnType<typeof setTimeout> | null = null;
function flashForSlot(slot: number) {
  flashSlot.value = slot;
  if (flashSlotTimer) clearTimeout(flashSlotTimer);
  flashSlotTimer = setTimeout(() => {
    flashSlot.value = null;
    flashSlotTimer = null;
  }, 2500);
}
watch(spectatedSteamId, (sid) => {
  if (flashSlot.value == null || !sid) return;
  const matched = [...ctSlots.value, ...tSlots.value].find(
    (s) => s.slot === flashSlot.value && s.steam_id === sid,
  );
  if (matched) {
    flashSlot.value = null;
    if (flashSlotTimer) {
      clearTimeout(flashSlotTimer);
      flashSlotTimer = null;
    }
  }
});

function focus() {
  deckRoot.value?.focus({ preventScroll: true });
}

defineExpose({ focus });

const toolButton =
  "h-8 gap-1.5 rounded-md border-border bg-transparent px-2.5 text-xs font-medium";
const iconButton = "size-8 rounded-md border-border bg-transparent p-0";
const onClasses =
  "border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)] hover:text-[hsl(var(--tac-amber))]";
</script>

<template>
  <div
    ref="deckRoot"
    tabindex="-1"
    class="group/deck relative grid gap-4 rounded-lg outline-none"
    :class="isFullscreen ? 'overflow-y-auto bg-background p-4' : ''"
  >
    <!-- Toolbar -->
    <div
      class="flex flex-wrap items-center gap-2 transition-opacity duration-200"
      :class="streamStateKnown ? 'opacity-100' : 'opacity-0'"
    >
      <div class="flex h-8 items-center gap-2 pr-1">
        <Label
          :for="`autodirector-${variant}-${matchId}`"
          class="text-sm font-normal text-muted-foreground"
        >
          {{ $t("stream_deck.auto_director") }}
        </Label>
        <Switch
          :id="`autodirector-${variant}-${matchId}`"
          :model-value="autodirector"
          :disabled="!isLive || busy"
          @update:model-value="(v: boolean) => setAutodirector(v)"
        />
      </div>

      <Button
        variant="outline"
        size="sm"
        :class="[toolButton, xrayEnabled ? onClasses : '']"
        :disabled="!isLive || busy"
        :aria-pressed="xrayEnabled"
        :title="
          xrayEnabled ? $t('ui_extras.hide_xray') : $t('ui_extras.show_xray')
        "
        @click="void toggleXray()"
      >
        <Scan class="size-3.5" />
        {{ $t("match.demo_playback.xray") }}
      </Button>

      <Button
        variant="outline"
        size="sm"
        :class="[
          toolButton,
          'select-none active:border-[hsl(var(--tac-amber)/0.45)] active:bg-[hsl(var(--tac-amber)/0.12)] active:text-[hsl(var(--tac-amber))]',
        ]"
        :disabled="!isLive"
        :title="$t('ui.hold_to_show_scoreboard')"
        @mousedown.prevent="startScoreboardHold"
      >
        <Trophy class="size-3.5" />
        {{ $t("stream_deck.scoreboard") }}
      </Button>

      <div
        role="group"
        :aria-label="$t('replay_extras.hud_layout')"
        class="inline-flex h-8 items-center gap-0.5 rounded-md border border-border p-0.5"
      >
        <FiveStackToolTip
          v-for="hud in broadcastHuds"
          :key="hud.slug"
          as-child
          :delay-duration="300"
          :tap-toggle="false"
          :disabled="!hud.description"
        >
          <template #trigger>
            <button
              type="button"
              :disabled="!isLive || busy"
              :aria-pressed="hudVisible && hudSlug === hud.slug"
              class="h-6 whitespace-nowrap rounded-[4px] px-2 text-xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
              :class="
                hudVisible && hudSlug === hud.slug
                  ? 'bg-[hsl(var(--tac-amber)/0.16)] font-semibold text-[hsl(var(--tac-amber))]'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="void setHud(hud.slug)"
            >
              {{ broadcastHudLabel(hud) }}
            </button>
          </template>
          {{ hud.description }}
        </FiveStackToolTip>
      </div>

      <Button
        variant="outline"
        size="sm"
        :class="[iconButton, !hudVisible ? onClasses : '']"
        :disabled="!isLive || busy"
        :title="
          hudVisible ? $t('ui_extras.hide_hud') : $t('ui_extras.show_hud')
        "
        :aria-label="
          hudVisible ? $t('ui_extras.hide_hud') : $t('ui_extras.show_hud')
        "
        @click="void setHudVisible(!hudVisible)"
      >
        <component :is="hudVisible ? Eye : EyeOff" class="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        :class="iconButton"
        :disabled="!isLive || busy"
        :title="$t('stream_deck.swap_sides')"
        :aria-label="$t('stream_deck.swap_sides')"
        @click="void toggleHudSides()"
      >
        <ArrowLeftRight class="size-3.5" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        :class="iconButton"
        :disabled="!isLive || busy"
        :title="$t('stream_deck.refresh_hud')"
        :aria-label="$t('stream_deck.refresh_hud')"
        @click="void refreshHud()"
      >
        <Spinner v-if="busy && busyAction === 'refresh_hud'" />
        <RefreshCw v-else class="size-3.5" />
      </Button>

      <span class="grow" />

      <Button
        variant="outline"
        size="sm"
        :class="toolButton"
        :title="
          isFullscreen
            ? $t('ui_extras.exit_fullscreen_f_key')
            : $t('ui_extras.fullscreen_f_key')
        "
        @click="void toggleFullscreen()"
      >
        <component
          :is="isFullscreen ? Minimize2 : Maximize2"
          class="size-3.5"
        />
        {{ isFullscreen ? $t("stream_deck.exit") : $t("stream_deck.full") }}
      </Button>
      <Button
        variant="outline"
        size="sm"
        :class="toolButton"
        :disabled="busy"
        :title="$t('replay_extras.reissue_connect')"
        @click="void reconnectLive()"
      >
        <Spinner v-if="busy && busyAction === 'reconnect'" />
        <RefreshCw v-else class="size-3.5" />
        {{ $t("stream_deck.reconnect") }}
      </Button>
      <Popover v-if="otherLiveMatches.length > 0" v-model:open="switchOpen">
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            :class="toolButton"
            :disabled="busy || !!switching"
            :title="$t('stream_deck.switch_to_match')"
          >
            <Spinner v-if="switching" />
            <ArrowRightLeft v-else class="size-3.5" />
            {{ $t("stream_deck.switch_short") }}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" class="w-72 p-1">
          <p class="px-2 py-1.5 text-xs text-muted-foreground">
            {{ $t("stream_deck.switch_pick_match") }}
          </p>
          <button
            v-for="m in otherLiveMatches"
            :key="m.id"
            type="button"
            class="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
            :disabled="!!switching"
            @click="switchTo(m.id)"
          >
            <span class="truncate">
              {{ m.lineup_1?.name ?? $t("common.team_a") }}
              <span class="text-muted-foreground">{{ $t("common.vs") }}</span>
              {{ m.lineup_2?.name ?? $t("common.team_b") }}
            </span>
            <ArrowRightLeft class="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverContent>
      </Popover>
      <span class="w-1.5" aria-hidden="true" />
      <Button
        variant="outline"
        size="sm"
        :class="[
          toolButton,
          'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive',
        ]"
        :disabled="busy || !stream"
        @click="stopOpen = true"
      >
        <Spinner v-if="busy && busyAction === 'stop_live'" />
        <Square v-else class="size-3.5" />
        {{ $t("stream_deck.stop") }}
      </Button>
    </div>

    <!-- Program: same 16:9 box in every state, so resolving never moves
         anything below it. -->
    <div
      v-if="!streamStateKnown"
      class="flex aspect-video w-full items-center justify-center rounded-lg border border-border bg-black"
    >
      <Spinner />
    </div>
    <div
      v-else-if="!canView"
      class="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-black px-6 text-center"
    >
      <p class="text-[0.95rem] font-semibold text-foreground">
        {{ $t("match.stream.access_denied") }}
      </p>
      <p class="max-w-xs text-sm text-muted-foreground">
        {{ $t("match.stream.access_denied_hint") }}
      </p>
    </div>
    <div
      v-else-if="!stream"
      class="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-6 text-center"
    >
      <p class="text-[0.95rem] font-semibold text-foreground">
        {{ $t("pages.control_room.deck.not_on_air") }}
      </p>
      <p class="max-w-sm text-sm text-muted-foreground">
        {{ $t("pages.control_room.deck.not_on_air_hint") }}
      </p>
    </div>
    <StreamCanvas
      v-else
      :stream="stream"
      :is-live="isLiveRef"
      mode="live"
      :header-label="$t('live_stages.stream_boot')"
      :disable-fullscreen-shortcut="true"
      :show-boot="true"
      class="group aspect-video w-full overflow-hidden rounded-lg border"
      :class="isLive ? 'border-destructive/50' : 'border-border'"
    >
      <template #boot>
        <BootSequence
          mode="live"
          :status="stream?.status ?? 'booting'"
          :error-message="stream?.error_message ?? null"
          :last-status-at="stream?.last_status_at ?? null"
          :histories="[stream?.status_history ?? []]"
          :header-label="$t('live_stages.stream_boot')"
          :can-skip="true"
          :skipping="skippingShaders"
          @skip="onSkipShaders"
        />
        <DesktopSnapshot
          kind="live"
          :id="matchId"
          class="mt-4 w-full max-w-md overflow-hidden rounded-md border border-border/50"
        />
      </template>

      <StreamLiveTag
        v-if="isLive"
        :match-id="matchId"
        class="absolute left-3 top-3 z-10"
      />
    </StreamCanvas>

    <div
      v-if="autodirector && isLive"
      class="flex items-start gap-2 rounded-lg border border-[hsl(var(--tac-amber)/0.3)] bg-[hsl(var(--tac-amber)/0.06)] px-3 py-2 text-[0.8rem] text-foreground"
    >
      <Bot class="mt-0.5 size-4 shrink-0 text-[hsl(var(--tac-amber))]" />
      <p>
        <span class="font-semibold">{{
          $t("stream_deck.autodirector_on")
        }}</span>
        {{ $t("stream_deck.autodirector_hint") }}
      </p>
    </div>

    <div class="grid gap-3">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div :class="[tacticalSectionLabelClasses, 'mb-0 grow']">
          <span :class="tacticalSectionTickClasses" />
          {{ $t("stream_deck.observer_target") }}
        </div>
        <span
          v-if="variant === 'sheet'"
          class="flex items-center gap-1.5 text-xs text-muted-foreground/80"
        >
          <Keyboard class="size-3.5" />
          <span class="hidden group-focus-within/deck:inline">{{
            $t("pages.control_room.deck.keys_on")
          }}</span>
          <span class="group-focus-within/deck:hidden">{{
            $t("pages.control_room.deck.keys_off")
          }}</span>
        </span>
        <Button
          v-if="variant === 'sheet'"
          as-child
          variant="ghost"
          size="sm"
          class="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <NuxtLink :to="`/matches/${matchId}`">
            <ExternalLink class="size-3.5" />
            {{ $t("pages.control_room.deck.match_page") }}
          </NuxtLink>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          :title="$t('ui.show_keyboard_shortcuts')"
          @click="shortcutsOpen = true"
        >
          {{ $t("stream_deck.shortcuts") }}
          <Kbd>?</Kbd>
        </Button>
      </div>

      <!-- The one surface that decodes the player cameras: it shows a single
           match, so the feeds are bounded at one roster. -->
      <SpectatorGrid
        :match-id="matchId"
        :is-live="isLive"
        :match-type="stream?.match?.options?.type"
        :controls-active="controlsActive"
        :flash-slot="flashSlot"
        :autodirector-on="autodirector && isLive"
        cameras
        @press-slot="(slot: number) => pressSlot(slot)"
      />
    </div>

    <ShortcutOverlay
      :open="shortcutsOpen"
      :groups="SHORTCUT_GROUPS"
      @close="shortcutsOpen = false"
    />

    <StopBroadcastDialog
      v-model:open="stopOpen"
      :match-name="matchName"
      :stop="stopLive"
    />
  </div>
</template>
