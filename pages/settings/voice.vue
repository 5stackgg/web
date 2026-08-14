<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import gql from "graphql-tag";
import { useQuery } from "@vue/apollo-composable";
import { HardDrive, RotateCcw, Volume2, VolumeX } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { FormSection } from "~/components/ui/form";
import { toast } from "@/components/ui/toast";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import VoiceSettingsPanel from "~/components/voice/VoiceSettingsPanel.vue";
import {
  describeMicError,
  useAudioSettings,
} from "~/composables/useAudioSettings";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";
import { useMicPipeline } from "~/composables/useMicPipeline";
import { useVoicePeerAudio } from "~/composables/useVoicePeerAudio";

// The microphone setup as a place you can go, rather than a gear you can only
// reach from a channel you have already joined. Nothing here is an account
// setting: the store is localStorage, so a player who plays from two machines
// gets two setups, which is what they want -- it is the hardware that differs.
const { t } = useI18n();

const settings = useAudioSettings();
const { active } = useActiveVoiceChannel();
const peerAudio = useVoicePeerAudio();
const pipeline = useMicPipeline();

// A live channel already holds the microphone. Opening a second capture of the
// same device just to drive a meter is both wasteful and a good way to fail on
// hardware that grants exclusive access -- the settings are shared, so editing
// them here still reaches the call.
const busyChannel = computed(() => active.value?.label ?? null);

const starting = ref(false);
const micError = ref<string | null>(null);
const micErrorDetail = ref<string | null>(null);

const error = computed(() => micError.value ?? settings.unsupported.value);

async function startMic() {
  if (starting.value || pipeline.live.value || busyChannel.value) {
    return;
  }

  if (settings.unsupported.value) {
    return;
  }

  starting.value = true;
  micError.value = null;
  micErrorDetail.value = null;

  try {
    await pipeline.start();
    pipeline.setMetering(true);
  } catch (caught) {
    console.error("[voice] could not open the microphone", caught);

    const described = describeMicError(caught);
    micError.value = described.key;
    micErrorDetail.value = described.detail;
  } finally {
    starting.value = false;
  }
}

// Opening a settings page must not be what makes a browser ask for the
// microphone; the mic check only picks itself back up where the player has
// already granted it. Firefox and Safari have no permission query for it, so
// they get the button.
async function alreadyPermitted() {
  try {
    const status = await navigator.permissions?.query({
      name: "microphone" as PermissionName,
    });

    return status?.state === "granted";
  } catch {
    return false;
  }
}

onMounted(async () => {
  void settings.refreshDevices();

  if (busyChannel.value || !(await alreadyPermitted())) {
    return;
  }

  void startMic();
});

// The party panel can join a channel from any page, this one included.
watch(busyChannel, (channel) => {
  if (channel) {
    pipeline.stop();
    return;
  }

  void startMic();
});

function resetDefaults() {
  settings.resetToDefaults();

  toast({ title: t("pages.settings.voice.reset.done") });
}

// A row that disappears the moment you put someone back to normal leaves you
// nowhere to undo the rest of it, so the list holds everyone who was turned
// down when the page opened plus anyone turned down since. Only a reset drops
// a row.
const adjustedSteamIds = ref<Array<string>>([]);

watch(
  peerAudio.peers,
  (peers) => {
    for (const [steamId, peer] of Object.entries(peers)) {
      if (!peer.muted && peer.volume === 1) {
        continue;
      }

      if (!adjustedSteamIds.value.includes(steamId)) {
        adjustedSteamIds.value.push(steamId);
      }
    }
  },
  { immediate: true, deep: true },
);

const adjustedPeers = computed(() =>
  adjustedSteamIds.value.map((steamId) => ({
    steamId,
    ...peerAudio.settingsFor(steamId),
  })),
);

const PROFILES = gql`
  query VoiceSettingsPlayers($steamIds: [bigint!]) {
    players(where: { steam_id: { _in: $steamIds } }) {
      steam_id
      name
      avatar_url
      custom_avatar_url
      country
      role
    }
  }
`;

const { result: profileResult } = useQuery<{ players: Array<any> }>(
  PROFILES,
  () => ({ steamIds: adjustedSteamIds.value }),
  () => ({
    enabled: adjustedSteamIds.value.length > 0,
    fetchPolicy: "cache-first",
  }),
);

const profiles = computed(() => {
  const map: Record<string, any> = {};

  for (const profile of profileResult.value?.players ?? []) {
    map[String(profile.steam_id)] = profile;
  }

  return map;
});

function volumePercent(steamId: string) {
  return Math.round(peerAudio.volumeOf(steamId) * 100);
}

function setVolumePercent(steamId: string, value: number | undefined) {
  peerAudio.setVolume(steamId, (value ?? 0) / 100);
}

function resetPeer(steamId: string) {
  peerAudio.reset(steamId);
  adjustedSteamIds.value = adjustedSteamIds.value.filter(
    (id) => id !== steamId,
  );
}

function resetPeers() {
  for (const steamId of [...adjustedSteamIds.value]) {
    resetPeer(steamId);
  }
}
</script>

<template>
  <PageTransition :delay="0">
    <div class="max-w-2xl space-y-6">
      <div
        class="flex items-start gap-3 rounded-lg border border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.06)] px-4 py-3"
      >
        <HardDrive
          class="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]"
        />
        <div class="space-y-1">
          <p
            class="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
          >
            {{ $t("pages.settings.voice.this_device.title") }}
          </p>
          <p class="text-xs leading-relaxed text-muted-foreground">
            {{ $t("pages.settings.voice.this_device.description") }}
          </p>
        </div>
      </div>

      <FormSection :title="$t('voice.settings.title')">
        <p class="mb-5 text-sm text-muted-foreground">
          {{ $t("pages.settings.voice.description") }}
        </p>

        <VoiceSettingsPanel
          :input-devices="settings.inputDevices.value"
          :output-devices="settings.outputDevices.value"
          :mic-device-id="settings.micDeviceId.value"
          :output-device-id="settings.outputDeviceId.value"
          :input-level="pipeline.inputLevel.value"
          :threshold="settings.threshold.value"
          :input-mode="settings.inputMode.value"
          :noise-suppression="settings.noiseSuppression.value"
          :transmitting="pipeline.transmitting.value"
          :monitoring="pipeline.monitoring.value"
          :live="pipeline.live.value"
          :error="error"
          :error-detail="micErrorDetail"
          :busy-channel="busyChannel"
          :can-start="!starting && !settings.unsupported.value"
          @update:mic="settings.setMicDevice"
          @update:output="settings.setOutputDevice"
          @update:mode="settings.setInputMode"
          @update:threshold="settings.setThreshold"
          @update:noise-suppression="settings.setNoiseSuppression"
          @toggle-monitor="pipeline.toggleMonitor"
          @test-output="settings.playTestTone"
          @start="startMic"
        />
      </FormSection>

      <!-- Per-player levels are the other half of "sound right": the fader that
           only exists mid-call is one a player can never undo afterwards. -->
      <FormSection :title="$t('pages.settings.voice.players.title')">
        <template #actions>
          <Button
            v-if="adjustedPeers.length"
            size="xs"
            variant="ghost"
            class="h-7 gap-1.5 text-[11px] text-muted-foreground"
            @click="resetPeers"
          >
            <RotateCcw class="h-3 w-3" />
            {{ $t("pages.settings.voice.players.reset_all") }}
          </Button>
        </template>

        <p class="mb-4 text-sm text-muted-foreground">
          {{ $t("pages.settings.voice.players.description") }}
        </p>

        <p
          v-if="!adjustedPeers.length"
          class="text-xs leading-relaxed text-muted-foreground/70"
        >
          {{ $t("pages.settings.voice.players.empty") }}
        </p>

        <div v-else class="flex flex-col gap-1">
          <div
            v-for="peer in adjustedPeers"
            :key="peer.steamId"
            class="rounded-md px-2 py-2 transition-colors hover:bg-muted/40"
          >
            <div class="flex items-center gap-2.5">
              <PlayerDisplay
                v-if="profiles[peer.steamId]"
                :player="profiles[peer.steamId]"
                size="xs"
                compact
                truncate-name
                linkable
                :show-elo="false"
                :show-role="false"
                class="min-w-0 flex-1"
              />
              <span
                v-else
                class="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
              >
                {{ peer.steamId }}
              </span>

              <FiveStackToolTip as-child :delay-duration="120" side="left">
                <template #trigger>
                  <Button
                    size="xs"
                    variant="ghost"
                    class="h-6 w-6 shrink-0 rounded-full p-0 [&_svg]:size-3.5"
                    :class="
                      peer.muted
                        ? 'text-destructive hover:text-destructive'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    :aria-label="
                      peer.muted
                        ? $t('layouts.voice_panel.unmute_player')
                        : $t('layouts.voice_panel.mute_player')
                    "
                    @click="peerAudio.toggleMuted(peer.steamId)"
                  >
                    <component :is="peer.muted ? VolumeX : Volume2" />
                  </Button>
                </template>
                {{
                  peer.muted
                    ? $t("layouts.voice_panel.unmute_player")
                    : $t("layouts.voice_panel.mute_player")
                }}
              </FiveStackToolTip>

              <Button
                size="xs"
                variant="ghost"
                class="h-6 shrink-0 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                @click="resetPeer(peer.steamId)"
              >
                {{ $t("pages.settings.voice.players.reset") }}
              </Button>
            </div>

            <div class="mt-2 flex items-center gap-2">
              <Slider
                :model-value="[volumePercent(peer.steamId)]"
                :min="0"
                :max="100"
                :step="5"
                :disabled="peer.muted"
                class="flex-1"
                :aria-label="$t('layouts.voice_panel.player_volume')"
                @update:model-value="
                  (value) => setVolumePercent(peer.steamId, value?.[0])
                "
              />
              <span
                class="w-16 shrink-0 text-right font-mono text-[0.6rem] uppercase tracking-[0.12em] tabular-nums text-muted-foreground"
              >
                {{
                  peer.muted
                    ? $t("pages.settings.voice.players.silenced")
                    : `${volumePercent(peer.steamId)}%`
                }}
              </span>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection :title="$t('pages.settings.voice.reset.title')">
        <div class="flex items-center justify-between gap-4">
          <p class="flex-1 text-sm text-muted-foreground">
            {{ $t("pages.settings.voice.reset.description") }}
          </p>
          <Button
            variant="outline"
            size="sm"
            class="gap-2"
            :disabled="settings.isDefault.value"
            @click="resetDefaults"
          >
            <RotateCcw class="h-3.5 w-3.5" />
            {{ $t("pages.settings.voice.reset.action") }}
          </Button>
        </div>
      </FormSection>
    </div>
  </PageTransition>
</template>
