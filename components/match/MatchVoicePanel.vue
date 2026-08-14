<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from "vue";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-vue-next";
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
import VoiceSettingsButton from "~/components/voice/VoiceSettingsButton.vue";
import { useVoiceChat } from "~/composables/useVoiceChat";

const props = defineProps<{
  // A match lineup id. The API treats it as a voice channel id exactly like a
  // lobby id, so this is scoped to one team and can never reach the other side.
  lineupId: string;
  label: string;
}>();

const voice = useVoiceChat(
  () => props.lineupId,
  () => props.label,
);

const {
  connected,
  connecting,
  muted,
  error,
  errorDetail,
  unsupported,
  participants,
  transmitting,
  conflict,
  join,
  joinSwitching,
  leave,
  toggleMute,
} = voice;

const switchPrompt = ref(false);

const speakers = computed(() =>
  participants.value.filter((participant) => participant.speaking),
);

async function onJoin() {
  if (conflict.value) {
    switchPrompt.value = true;
    return;
  }

  await join();
}

async function confirmSwitch() {
  switchPrompt.value = false;
  await joinSwitching();
}

// Leaving on unmount would be wrong -- navigating between match tabs should not
// drop the channel -- but a publishing peer connection must not outlive a hard
// teardown either, and useVoiceChat already handles that on scope dispose.
onBeforeUnmount(() => {
  switchPrompt.value = false;
});
</script>

<template>
  <div class="rounded-lg border border-border/60 bg-card/40 p-3">
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <Volume2 class="h-4 w-4 shrink-0 text-muted-foreground" />
        <span
          class="truncate font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em]"
        >
          {{ $t("voice.team_voice") }}
        </span>
        <span
          v-if="connected"
          class="shrink-0 font-mono text-[0.62rem] tabular-nums text-muted-foreground"
        >
          {{ speakers.length }}/{{ participants.length }}
        </span>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <Button
          v-if="connected"
          size="sm"
          variant="ghost"
          class="h-8 w-8 p-0"
          :title="muted ? $t('voice.unmute') : $t('voice.mute')"
          @click="toggleMute"
        >
          <MicOff v-if="muted" class="h-4 w-4 text-destructive" />
          <Mic v-else class="h-4 w-4" :class="{ 'text-primary': transmitting }" />
        </Button>

        <Button
          v-if="connected"
          size="sm"
          variant="ghost"
          class="h-8 gap-1.5 text-destructive hover:text-destructive"
          @click="leave"
        >
          <PhoneOff class="h-3.5 w-3.5" />
          {{ $t("voice.leave") }}
        </Button>

        <Button
          v-else
          size="sm"
          variant="outline"
          class="h-8 gap-1.5"
          :disabled="!!unsupported"
          :loading="connecting"
          @click="onJoin"
        >
          <Mic class="h-3.5 w-3.5" />
          {{ $t("voice.join") }}
        </Button>

        <!-- Same device pickers, mic check and sensitivity as the party hub:
             the settings belong to the microphone, not to one surface. -->
        <VoiceSettingsButton
          v-if="!unsupported"
          :voice="voice"
          class="h-8 w-8 text-muted-foreground hover:text-foreground"
        />
      </div>
    </div>

    <p v-if="unsupported" class="mt-2 text-xs text-muted-foreground">
      {{ $t(unsupported) }}
    </p>

    <template v-else-if="error">
      <p class="mt-2 text-xs text-destructive">{{ $t(error) }}</p>
      <p v-if="errorDetail" class="mt-1 break-words text-[0.7rem] text-muted-foreground">
        {{ errorDetail }}
      </p>
    </template>

    <AlertDialog v-model:open="switchPrompt">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ $t("voice.switch_title") }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("voice.switch_description", { channel: conflict?.label ?? "" }) }}
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
</template>
