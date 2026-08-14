<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Mic,
  MicOff,
  PhoneOff,
  PictureInPicture2,
  Settings2,
  Smartphone,
  Headphones,
  Video,
  VideoOff,
  AlertCircle,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import CallGrid from "~/components/voice/CallGrid.vue";
import CallPhoneQr from "~/components/voice/CallPhoneQr.vue";
import VoiceRosterPreview from "~/components/voice/VoiceRosterPreview.vue";
import { useCallPip } from "~/composables/useCallPip";
import { useCallVisibility } from "~/composables/useCallVisibility";
import { useChannelPresence } from "~/composables/useChannelPresence";
import { useVoiceSession } from "~/composables/useVoiceSession";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import { useVoiceVideoPrefs } from "~/composables/useVoiceVideoPrefs";

// One voice channel, drawn the same way everywhere.
//
// This used to be three components that had drifted into three different
// products: the hub offered seven controls, the draft room three, and the
// matchmaking panel a fourth arrangement with its own error styling. Which
// buttons you got depended on which page you happened to be looking at, and
// "turn my camera on" lived somewhere different in each. A voice channel is one
// thing; it now has one presentation, and the surfaces only choose density.
const props = withDefaults(
  defineProps<{
    channelId: string;
    label: string;
    // Which settings pair gates it. The API cannot tell a lobby id from a
    // lineup id -- deliberately, that is what keeps a channel un-bridgeable --
    // so whoever opened it says which it is.
    kind: "lobby" | "match";
    // The narrow hub column. Tighter chrome and a compact tile strip; the same
    // controls, because dropping controls is what caused this in the first
    // place.
    dense?: boolean;
    // Draws its own card. Off for surfaces that already supply the chrome.
    framed?: boolean;
    // Render even when the channel is empty.
    //
    // On a match page this card is an extra section and hiding it while nobody
    // is talking is right. In the hub it *is* the voice control -- hiding it
    // there leaves no way to start a call at all, which is exactly what it did.
    showEmpty?: boolean;
    // Whether this surface is actually showing the call, for Picture-in-Picture
    // to follow. Mounted is not the same as visible -- hub panels stay mounted
    // under v-show once opened.
    visibleWhen?: () => boolean;
  }>(),
  { framed: true },
);

const session = useVoiceSession();
const registry = useActiveVoiceChannel();
const videoPrefs = useVoiceVideoPrefs();
const pip = useCallPip();

// Presence from outside the call, so the card can appear before you are in it.
// Once joined the live session is the better source -- it carries the video --
// so it wins.
const outside = useChannelPresence(() => props.channelId);

// In it, whoever is holding it: this tab, or another one. Both mean "you are in
// this channel", and a card that only knew about its own tab showed a Join
// button to someone already talking.
const held = computed(() =>
  registry.session.value?.id === props.channelId
    ? registry.session.value
    : null,
);

const joined = computed(() => !!held.value);
const owned = computed(() => held.value?.owned ?? false);

const participants = computed(() =>
  joined.value ? session.participants.value : outside.participants.value,
);

const inCall = computed(() =>
  participants.value.filter((participant) => participant.connected),
);

// Nothing to draw until somebody is in there -- unless this card is the way in.
// Deliberately not "the channel exists" for the surfaces that opt out: every
// lineup and every lobby has one, and an empty voice card under every page
// would be furniture.
const show = computed(
  () => props.showEmpty || inCall.value.length > 0 || joined.value,
);

// Whether to *offer* voice here -- not whether to show a call already running.
// A setting turning off must never leave someone in a call they cannot see, and
// so cannot mute or leave; the API drops them soon enough on its own.
const voiceAllowed = computed(() =>
  props.kind === "lobby"
    ? useApplicationSettingsStore().voiceChatLobbiesEnabled
    : useApplicationSettingsStore().voiceChatMatchesEnabled,
);

const videoAllowed = computed(() =>
  props.kind === "lobby"
    ? useApplicationSettingsStore().videoChatLobbiesEnabled
    : useApplicationSettingsStore().videoChatMatchesEnabled,
);

const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

// One session serves every channel, so a failure is only this card's to report
// when this card is what asked for it -- otherwise a match channel failing to
// connect paints a red panel on the party lobby too.
const error = computed(() =>
  session.targetId.value === props.channelId ? session.error.value : null,
);
const errorDetail = computed(() =>
  session.targetId.value === props.channelId
    ? session.errorDetail.value
    : null,
);
// Connecting is the button's state, not the card's: the layout holds the
// not-joined shape until the connection is actually up, so a slow join is a
// spinner on the thing that was clicked rather than an empty call panel.
const connecting = computed(
  () => session.targetId.value === props.channelId && session.connecting.value,
);

const muted = computed(() => held.value?.muted ?? session.muted.value);
const videoOn = computed(() => session.videoOn.value);
const speaking = computed(() =>
  inCall.value.some((participant) => participant.speaking),
);

// Only this tab can show video: a MediaStream does not cross a BroadcastChannel,
// so a mirroring tab knows who has a camera on but cannot render it.
const canControlVideo = computed(() => videoAllowed.value && owned.value);

useCallVisibility().register(
  () => joined.value && show.value && (props.visibleWhen?.() ?? true),
);

const qrRef = ref<InstanceType<typeof CallPhoneQr> | null>(null);

// Anything holding the microphone on a different channel, wherever it lives --
// including another tab, which the local registry's `active` never sees.
const conflict = computed(() => {
  const current = registry.session.value;

  if (current && current.id !== props.channelId) {
    return current;
  }

  return registry.conflictWith(props.channelId);
});

const switchPrompt = ref(false);

// The joined/not-joined swap is one shell whose height is measured and
// tweened: frozen where it was while the leaving side fades, then eased to the
// entering side's real height as it fades in. Height lives on one element with
// one clock -- the previous version collapsed a grid on each side at once, so
// mid-swap the card was briefly the sum of both heights and snapped at the
// end. At rest the shell is height:auto and unclipped, so mid-call growth
// stays CallGrid's own animation and a speaking ring is never cut off.
const swapShell = ref<HTMLElement | null>(null);

function freezeSwapHeight() {
  const shell = swapShell.value;

  if (!shell) {
    return;
  }

  shell.style.height = `${shell.getBoundingClientRect().height}px`;
  shell.classList.add("voice-swap-animating");
}

function tweenSwapHeight(entering: Element) {
  const shell = swapShell.value;

  if (!shell) {
    return;
  }

  shell.style.height = `${(entering as HTMLElement).offsetHeight}px`;
}

function releaseSwapHeight() {
  const shell = swapShell.value;

  if (!shell) {
    return;
  }

  shell.style.height = "";
  shell.classList.remove("voice-swap-animating");
}

// Joining is a switch when you are already somewhere else, and the session
// retargets in place rather than refusing -- so without this, Join silently
// hangs up on the call you were already in. Asked first, always.
async function onJoin() {
  if (conflict.value) {
    switchPrompt.value = true;
    return;
  }

  await session.join(props.channelId, props.label, props.kind);
}

async function confirmSwitch() {
  switchPrompt.value = false;

  // Retargeting the hosted session drops the channel it was on, which is the
  // switch itself -- there is no second connection to take the mic from.
  await session.join(props.channelId, props.label, props.kind);
}

// Turning your own camera on pops the call out with it. This is the one moment
// the browser will reliably grant Picture-in-Picture -- it is a click, which is
// the gesture it wants -- and the person who just opted in is the only one it is
// fair to open a window for.
async function toggleVideo() {
  const wasOn = videoOn.value;

  await session.toggleVideo();

  if (!wasOn && videoOn.value) {
    void pip.enter();
  }
}
</script>

<template>
  <!-- Same curve as the page transitions, shorter: this reveals inside a page
       that is already settled, so it should feel like part of it rather than a
       second page arriving. -->
  <Transition
    enter-active-class="transition-[opacity,transform] [transition-duration:320ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
    leave-active-class="transition-[opacity,transform] [transition-duration:220ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
    enter-from-class="opacity-0 translate-y-2"
    leave-to-class="opacity-0 translate-y-1"
  >
    <div
      v-if="show && (voiceAllowed || joined)"
      class="flex flex-col overflow-hidden"
      :class="framed ? 'rounded-xl border border-border bg-card/40' : ''"
    >
      <!-- Identity, one line.
           This fits again only because the actions left: seven controls and a
           name never shared 300px, and the name was what lost. Now the header
           answers "which channel, how many people" and nothing else. -->
      <div
        class="flex items-center justify-between gap-2"
        :class="
          framed
            ? 'border-b border-border/60 bg-background/40 px-3 py-2'
            : 'pb-1'
        "
      >
        <span class="flex min-w-0 items-center gap-1.5">
          <Headphones
            class="h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
          />
          <span
            class="truncate font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-zinc-200"
          >
            {{ label }}
          </span>
        </span>

        <!-- min-h matches the h-6 header tools, so the row is already tall
             enough for them before they arrive -- otherwise the whole header
             grows a few pixels as they animate in and shrinks back on leave. -->
        <div class="flex min-h-6 shrink-0 items-center">
          <span class="relative inline-flex h-1.5 w-1.5">
            <span
              v-if="speaking"
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/70"
            ></span>
            <span
              class="relative inline-flex h-1.5 w-1.5 rounded-full transition-colors"
              :class="
                !joined
                  ? 'bg-zinc-600'
                  : muted
                    ? 'bg-destructive'
                    : 'bg-emerald-400'
              "
            ></span>
          </span>
          <span class="ml-1.5 whitespace-nowrap text-[10px] text-zinc-500">
            {{ $t("layouts.voice_panel.connected", { count: inCall.length }) }}
          </span>

          <!-- Plain icons. These were behind a menu on the theory that they are
               reached once each and should not crowd the controls -- but the
               header has room now that the call controls moved to the footer,
               and a menu costs two clicks to reach a one-click toggle. Watching
               yourself back left entirely: it belongs on the picture it
               changes, so it lives on your own tile. -->
          <!-- Their column animates 0fr -> 1fr with the join, so the member
               count slides over as the buttons arrive instead of jumping when
               three of them pop into a settled header. The leading gap lives
               inside the clipped cell so even that six pixels is animated. -->
          <Transition
            enter-active-class="voice-tools-anim"
            leave-active-class="voice-tools-anim"
            enter-from-class="voice-tools-collapsed"
            leave-to-class="voice-tools-collapsed"
          >
            <div v-if="joined" class="grid grid-cols-[1fr]">
              <div
                class="flex min-w-0 items-center gap-1.5 overflow-hidden pl-1.5"
              >
                <FiveStackToolTip
                  v-if="canControlVideo && !videoOn"
                  as-child
                  :delay-duration="120"
                  side="bottom"
                >
                  <template #trigger>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="h-6 w-6 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground"
                      :aria-label="$t('voice.call.phone.use_phone')"
                      @click="qrRef?.toggle()"
                    >
                      <Smartphone class="h-3.5 w-3.5" />
                    </Button>
                  </template>
                  {{ $t("voice.call.phone.use_phone") }}
                </FiveStackToolTip>
    
                <FiveStackToolTip
                  v-if="videoAllowed"
                  as-child
                  :delay-duration="120"
                  side="bottom"
                >
                  <template #trigger>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="h-6 w-6 shrink-0 rounded-full p-0"
                      :class="
                        pip.active.value
                          ? 'text-[hsl(var(--tac-amber))]'
                          : 'text-muted-foreground hover:text-foreground'
                      "
                      :aria-label="$t('voice.call.pop_out')"
                      @click="pip.toggle()"
                    >
                      <PictureInPicture2 class="h-3.5 w-3.5" />
                    </Button>
                  </template>
                  {{
                    pip.active.value
                      ? $t("voice.call.pop_in")
                      : $t("voice.call.pop_out")
                  }}
                </FiveStackToolTip>
    
                <FiveStackToolTip as-child :delay-duration="120" side="bottom">
                  <template #trigger>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="-mr-1 h-6 w-6 shrink-0 rounded-full p-0 text-muted-foreground hover:text-foreground"
                      :aria-label="$t('voice.call.device_settings')"
                      @click="navigateTo('/settings/voice')"
                    >
                      <Settings2 class="h-3.5 w-3.5" />
                    </Button>
                  </template>
                  {{ $t("voice.call.device_settings") }}
                </FiveStackToolTip>
              </div>
            </div>
          </Transition>
        </div>
      </div>

      <!-- The microphone is open in a different tab. Everything here still
           works; it just travels. -->
      <Transition
        enter-active-class="transition-[opacity,transform] [transition-duration:260ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
        leave-active-class="transition-[opacity,transform] [transition-duration:160ms] ease-in motion-reduce:![transition-duration:1ms]"
        enter-from-class="opacity-0 -translate-y-1"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <p
          v-if="joined && !owned"
          class="text-[0.6rem] leading-snug text-[hsl(var(--tac-amber))]"
          :class="framed ? 'px-3 pt-2' : 'pb-1'"
        >
          {{ $t("layouts.voice_panel.other_tab") }}
        </p>
      </Transition>

      <div
        class="relative flex flex-col"
        :class="[dense ? 'gap-2' : 'gap-3', framed ? 'p-3' : 'pt-2']"
      >
        <CallPhoneQr
          v-if="joined && canControlVideo"
          ref="qrRef"
          :channel-id="channelId"
        />

        <!-- Full-width so a long message wraps under the controls instead of
             squeezing them; the technical line is kept but de-emphasised. -->
        <div
          v-if="error"
          class="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2"
        >
          <AlertCircle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <div class="min-w-0 space-y-0.5">
            <p class="text-[11px] leading-relaxed text-destructive">
              {{ $t(error) }}
            </p>
            <p
              v-if="errorDetail"
              class="break-all font-mono text-[10px] leading-relaxed text-destructive/60"
            >
              {{ errorDetail }}
            </p>
          </div>
        </div>

        <!-- Faces, or avatars for anyone without a camera. Only ever carries
             video in the tab holding the call: the streams are pulled by that
             session, and a MediaStream does not cross to another tab. Before
             joining, who is in there instead -- so the answer to "is this
             worth joining" is on screen before the decision rather than after
             it. -->
        <!-- One motion, out-in: the old side fades where it stands, then the
             shell's height eases to the new side's measured height while it
             fades in. The shell itself never leaves the column, so the flex
             gaps around it hold still for the whole trade. -->
        <div ref="swapShell">
          <Transition
            mode="out-in"
            enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
            leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
            enter-from-class="opacity-0 translate-y-1"
            leave-to-class="opacity-0"
            @before-leave="freezeSwapHeight"
            @leave-cancelled="releaseSwapHeight"
            @enter="tweenSwapHeight"
            @after-enter="releaseSwapHeight"
            @enter-cancelled="releaseSwapHeight"
          >
            <div v-if="joined" key="call">
              <CallGrid
                :participants="participants"
                :peer-video="owned ? session.peerVideo.value : new Map()"
                :local-video="owned ? session.localVideo() : null"
                :my-steam-id="mySteamId"
                :self-muted="muted"
                :compact="dense"
                :awaiting="joined"
                :on-toggle-self-mute="registry.toggleSessionMute"
              />
            </div>
            <div v-else key="preview">
              <VoiceRosterPreview :channel-id="channelId" />
            </div>
          </Transition>
        </div>

        <!-- The three things done during a call, sized to be hit without
             looking, in the place every call app puts them.
             A bar rather than three loose circles: floating buttons centred
             under a left-aligned grid read as debris, and there was nothing to
             say where the call ended and the page resumed. -->
        <!-- out-in, not a crossfade: these two occupy the same space and are
             different heights, so overlapping them makes the card jump. The
             short gap between reads as the state actually changing. -->
        <!-- The bar itself never leaves; only what is inside it changes.
             Crossfading the two states drew them superimposed -- a Join button
             half-visible through the mute/camera/leave row. With the shell
             staying put there is nothing to crossfade: one set of controls
             steps out, the other steps in, and the shell holding its own
             minimum height means nothing moves while they trade places. -->
        <div
          class="flex items-center justify-center rounded-lg border border-border/60 bg-background/50 px-2 py-1.5"
        >
          <div class="flex min-h-9 w-full items-center justify-center">
            <!-- The same clock as the main swap above: both leave in 110ms and
                 enter in 240ms, so the bar's contents and the panel land
                 together instead of the bar finishing on its own beat. -->
            <Transition
              mode="out-in"
              enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
              leave-active-class="transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
              enter-from-class="opacity-0 scale-95"
              leave-to-class="opacity-0 scale-95"
            >
              <div v-if="!joined" key="join" class="w-full">
                <Button
                  size="xs"
                  variant="ghost"
                  class="h-9 w-full gap-1.5 rounded-md text-[11px] text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                  :loading="connecting"
                  @click="onJoin"
                >
                  <Mic class="h-3.5 w-3.5" />
                  {{ $t("layouts.lobby_panel.join_voice") }}
                </Button>
              </div>

              <div v-else key="controls" class="flex items-center gap-2">
            <FiveStackToolTip as-child :delay-duration="120" side="top">
              <template #trigger>
                <Button
                  size="xs"
                  :variant="muted ? 'destructive' : 'secondary'"
                  class="h-9 w-9 rounded-full p-0"
                  :aria-label="
                    muted ? $t('voice.tooltip.unmute') : $t('voice.tooltip.mute')
                  "
                  @click="registry.toggleSessionMute()"
                >
                  <component :is="muted ? MicOff : Mic" class="h-4 w-4" />
                </Button>
              </template>
              {{ muted ? $t("voice.tooltip.unmute") : $t("voice.tooltip.mute") }}
            </FiveStackToolTip>

            <FiveStackToolTip
              v-if="canControlVideo"
              as-child
              :delay-duration="120"
              side="top"
            >
              <template #trigger>
                <Button
                  size="xs"
                  :variant="videoOn ? 'secondary' : 'ghost'"
                  class="h-9 w-9 rounded-full p-0"
                  :class="
                    videoOn
                      ? 'text-[hsl(var(--tac-amber))]'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  :loading="session.videoStarting.value"
                  :aria-label="
                    videoOn
                      ? $t('voice.call.stop_camera')
                      : $t('voice.call.start_camera')
                  "
                  @click="toggleVideo"
                >
                  <component
                    :is="videoOn ? Video : VideoOff"
                    class="h-4 w-4"
                  />
                </Button>
              </template>
              {{
                videoOn
                  ? $t("voice.call.stop_camera")
                  : $t("voice.call.start_camera")
              }}
            </FiveStackToolTip>

            <FiveStackToolTip as-child :delay-duration="120" side="top">
              <template #trigger>
                <Button
                  size="xs"
                  variant="ghost"
                  class="h-9 w-9 rounded-full p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  :aria-label="$t('voice.tooltip.leave')"
                  @click="registry.leaveSession()"
                >
                  <PhoneOff class="h-4 w-4" />
                </Button>
              </template>
              {{ $t("voice.tooltip.leave") }}
            </FiveStackToolTip>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <AlertDialog v-model:open="switchPrompt">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{{ $t("voice.switch_title") }}</AlertDialogTitle>
            <AlertDialogDescription>
              {{
                $t("voice.switch_description", {
                  channel: conflict?.label ?? "",
                })
              }}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{{ $t("common.cancel") }}</AlertDialogCancel>
            <AlertDialogAction @click="confirmSwitch">
              {{ $t("voice.switch_confirm") }}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </Transition>
</template>

<style scoped>
/* On the swap shell only while the two states trade places: the height is
   frozen, then tweened to the entering side's measured height. Both the tween
   and the clipping end at rest, so nothing has a ceiling to outgrow mid-call
   and a speaking ring is never cut off. */
.voice-swap-animating {
  overflow: hidden;
  transition: height 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

/* The header tools collapse their column the way the swap collapses height:
   0fr <-> 1fr, clipped by the cell while it moves. */
.voice-tools-anim {
  transition:
    grid-template-columns 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}
.voice-tools-collapsed {
  grid-template-columns: 0fr;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .voice-swap-animating,
  .voice-tools-anim {
    transition-duration: 1ms;
  }
}
</style>
