<script setup lang="ts">
import { computed } from "vue";
import { Headphones, Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import { useVoicePeerAudio } from "~/composables/useVoicePeerAudio";

// The call, seen from outside whatever opened it. The connection itself belongs
// to the surface that joined -- a match page, the lobby panel, a draft room --
// and that surface can be navigated away from while the call keeps running, so
// this reads the registry rather than holding a session of its own.
//
// Levels are a mixing desk, not a menu: every member is a strip with their own
// fader, because "who is too loud" is answered by looking, not by hunting
// through a context menu per person.
const { session } = useActiveVoiceChannel();
const peerAudio = useVoicePeerAudio();

const mySteamId = computed(() => useAuthStore().me?.steam_id ?? null);

const members = computed(() => {
  const participants = session.value?.participants.value ?? [];

  // In the channel first, and ourselves at the top of it: the strip you reach
  // for most is your own mute.
  return [...participants]
    .filter((participant) => participant.connected)
    .sort((left, right) => {
      if (left.steamId === mySteamId.value) return -1;
      if (right.steamId === mySteamId.value) return 1;
      return (left.name ?? "").localeCompare(right.name ?? "");
    });
});

const speakingCount = computed(
  () => members.value.filter((member) => member.speaking).length,
);

function isMe(steamId: string) {
  return !!mySteamId.value && steamId === mySteamId.value;
}

function initials(name: string | null) {
  return (name ?? "?").trim().slice(0, 2).toUpperCase();
}

function volumePercent(steamId: string) {
  return Math.round(peerAudio.volumeOf(steamId) * 100);
}

function setVolumePercent(steamId: string, value: number | undefined) {
  peerAudio.setVolume(steamId, (value ?? 0) / 100);
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex-shrink-0 border-b border-border px-3 pb-3 pt-3">
      <div
        class="flex items-center gap-[0.4rem] font-mono text-[0.62rem] font-bold uppercase tracking-[0.24em] text-muted-foreground"
      >
        <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]"></span>
        {{ $t("layouts.hub.voice") }}
      </div>
    </div>

    <div v-if="session" class="flex min-h-0 flex-1 flex-col">
      <!-- Which channel, and whether the mic is actually open. Both have to be
           answerable from the hub: the page that joined may not be on screen. -->
      <div class="flex-shrink-0 border-b border-border/60 px-3 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 flex-col gap-1">
            <span class="flex min-w-0 items-center gap-2">
              <span class="relative inline-flex h-2 w-2 shrink-0">
                <span
                  v-if="speakingCount"
                  class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/70"
                ></span>
                <span
                  class="relative inline-flex h-2 w-2 rounded-full transition-colors"
                  :class="
                    session.muted.value ? 'bg-destructive' : 'bg-emerald-400'
                  "
                ></span>
              </span>
              <span class="truncate text-sm font-medium">
                {{ session.label }}
              </span>
            </span>
            <span
              class="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
            >
              {{
                session.muted.value
                  ? $t("layouts.voice_panel.you_are_muted")
                  : $t("layouts.voice_panel.connected", {
                      count: members.length,
                    })
              }}
            </span>
          </div>

          <div class="flex shrink-0 items-center gap-1.5">
            <FiveStackToolTip as-child :delay-duration="120" side="bottom">
              <template #trigger>
                <Button
                  size="xs"
                  :variant="session.muted.value ? 'destructive' : 'secondary'"
                  class="h-7 w-7 rounded-full p-0"
                  :aria-label="
                    session.muted.value
                      ? $t('voice.tooltip.unmute')
                      : $t('voice.tooltip.mute')
                  "
                  @click="session.toggleMute()"
                >
                  <component :is="session.muted.value ? MicOff : Mic" />
                </Button>
              </template>
              {{
                session.muted.value
                  ? $t("voice.tooltip.unmute")
                  : $t("voice.tooltip.mute")
              }}
            </FiveStackToolTip>

            <FiveStackToolTip as-child :delay-duration="120" side="bottom">
              <template #trigger>
                <Button
                  size="xs"
                  variant="ghost"
                  class="h-7 w-7 rounded-full p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  :aria-label="$t('voice.tooltip.leave')"
                  @click="session.leave()"
                >
                  <PhoneOff />
                </Button>
              </template>
              {{ $t("voice.tooltip.leave") }}
            </FiveStackToolTip>
          </div>
        </div>
      </div>

      <!-- One strip per member. Silenced peers keep their subscription so they
           still light up when they talk -- the listener chose not to hear them,
           not to stop seeing them. -->
      <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div class="flex flex-col gap-1">
          <div
            v-for="member in members"
            :key="member.steamId"
            class="rounded-md px-2 py-2 transition-colors"
            :class="
              member.speaking
                ? 'bg-emerald-400/[0.07]'
                : 'hover:bg-muted/40'
            "
          >
            <div class="flex items-center gap-2.5">
              <span class="relative shrink-0">
                <img
                  v-if="member.avatarUrl"
                  :src="member.avatarUrl"
                  alt=""
                  class="h-7 w-7 rounded-full object-cover transition-[box-shadow] duration-100"
                  :class="
                    member.speaking
                      ? 'shadow-[0_0_0_2px_hsl(var(--background)),0_0_0_3.5px_theme(colors.emerald.400)]'
                      : ''
                  "
                />
                <span
                  v-else
                  class="flex h-7 w-7 items-center justify-center rounded-full bg-muted font-mono text-[0.6rem] font-bold text-muted-foreground transition-[box-shadow] duration-100"
                  :class="
                    member.speaking
                      ? 'shadow-[0_0_0_2px_hsl(var(--background)),0_0_0_3.5px_theme(colors.emerald.400)]'
                      : ''
                  "
                >
                  {{ initials(member.name) }}
                </span>
              </span>

              <span class="flex min-w-0 flex-1 items-center gap-1.5">
                <span
                  class="truncate text-xs"
                  :class="
                    peerAudio.isMuted(member.steamId) && !isMe(member.steamId)
                      ? 'text-muted-foreground line-through decoration-destructive/60'
                      : ''
                  "
                >
                  {{ member.name ?? member.steamId }}
                </span>
                <span
                  v-if="isMe(member.steamId)"
                  class="shrink-0 rounded-sm border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.12)] px-1 py-[1px] font-mono text-[0.5rem] font-bold uppercase leading-none tracking-[0.14em] text-[hsl(var(--tac-amber))]"
                >
                  {{ $t("layouts.voice_panel.you") }}
                </span>
              </span>

              <!-- Your own strip has no fader: turning yourself down is what
                   the mute is for, and the sensitivity lives in the settings. -->
              <FiveStackToolTip
                v-if="!isMe(member.steamId)"
                as-child
                :delay-duration="120"
                side="left"
              >
                <template #trigger>
                  <Button
                    size="xs"
                    variant="ghost"
                    class="h-6 w-6 shrink-0 rounded-full p-0 [&_svg]:size-3.5"
                    :class="
                      peerAudio.isMuted(member.steamId)
                        ? 'text-destructive hover:text-destructive'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    :aria-label="
                      peerAudio.isMuted(member.steamId)
                        ? $t('layouts.voice_panel.unmute_player')
                        : $t('layouts.voice_panel.mute_player')
                    "
                    @click="peerAudio.toggleMuted(member.steamId)"
                  >
                    <component
                      :is="
                        peerAudio.isMuted(member.steamId) ? VolumeX : Volume2
                      "
                    />
                  </Button>
                </template>
                {{
                  peerAudio.isMuted(member.steamId)
                    ? $t("layouts.voice_panel.unmute_player")
                    : $t("layouts.voice_panel.mute_player")
                }}
              </FiveStackToolTip>

              <span
                v-else
                class="shrink-0 text-muted-foreground [&_svg]:size-3.5"
              >
                <component :is="session.muted.value ? MicOff : Mic" />
              </span>
            </div>

            <div
              v-if="!isMe(member.steamId)"
              class="mt-2 flex items-center gap-2 pl-[2.375rem]"
            >
              <Slider
                :model-value="[volumePercent(member.steamId)]"
                :min="0"
                :max="100"
                :step="5"
                :disabled="peerAudio.isMuted(member.steamId)"
                class="flex-1"
                :aria-label="$t('layouts.voice_panel.player_volume')"
                @update:model-value="
                  (value) => setVolumePercent(member.steamId, value?.[0])
                "
              />
              <span
                class="w-8 shrink-0 text-right font-mono text-[0.6rem] tabular-nums text-muted-foreground"
              >
                {{
                  peerAudio.isMuted(member.steamId)
                    ? "—"
                    : `${volumePercent(member.steamId)}%`
                }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Nothing to control until they are in a channel, so the empty state says
         where channels come from rather than pretending to be one. -->
    <div
      v-else
      class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
    >
      <Headphones class="h-6 w-6 text-muted-foreground/50" />
      <p class="text-sm font-medium text-muted-foreground">
        {{ $t("layouts.voice_panel.empty_title") }}
      </p>
      <p class="text-[11px] leading-relaxed text-muted-foreground/70">
        {{ $t("layouts.voice_panel.empty_description") }}
      </p>
    </div>
  </div>
</template>
