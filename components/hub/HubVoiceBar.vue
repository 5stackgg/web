<script setup lang="ts">
import { computed } from "vue";
import { Mic, MicOff, PhoneOff } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { useActiveVoiceChannel } from "~/composables/useActiveVoiceChannel";

// The call, under whatever tab is open: who is in it, who is talking, and the
// two controls you reach for mid-sentence. The full voice panel (volumes,
// switching channels) opens from the Voice icon or from this bar.
defineEmits<{ (e: "open"): void }>();

const { t } = useI18n();
const { session, toggleSessionMute, leaveSession } = useActiveVoiceChannel();

const connected = computed(() =>
  (session.value?.participants ?? []).filter(
    (participant) => participant.connected,
  ),
);
const talking = computed(() =>
  connected.value.find((participant) => participant.speaking),
);
const status = computed(() => {
  if (session.value?.muted) return t("layouts.voice_bar.you_are_muted");
  if (talking.value?.name) {
    return t("layouts.voice_bar.talking", { name: talking.value.name });
  }
  return t("layouts.voice_bar.in_call", { count: connected.value.length });
});
</script>

<template>
  <div
    v-if="session"
    class="flex shrink-0 items-center gap-2.5 border-t border-border bg-zinc-950/60 px-3 py-2.5"
  >
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      :aria-label="$t('layouts.voice_bar.open')"
      @click="$emit('open')"
    >
      <span class="flex shrink-0">
        <Avatar
          v-for="(participant, index) in connected.slice(0, 3)"
          :key="participant.steamId"
          shape="square"
          class="h-6 w-6 text-[0.55rem] shadow-[0_0_0_2px_hsl(var(--sidebar-background))]"
          :class="[
            index > 0 ? '-ml-1.5' : '',
            participant.speaking
              ? 'relative z-[1] !shadow-[0_0_0_2px_hsl(var(--sidebar-background)),0_0_0_3.5px_rgb(52_211_153)]'
              : '',
          ]"
        >
          <AvatarImage
            v-if="participant.avatarUrl"
            :src="participant.avatarUrl"
            :alt="participant.name ?? ''"
          />
          <AvatarFallback>
            {{ (participant.name ?? "?").slice(0, 2).toUpperCase() }}
          </AvatarFallback>
        </Avatar>
      </span>
      <span class="min-w-0">
        <span class="block truncate text-xs font-semibold text-foreground">
          {{ session.label }}
        </span>
        <span
          class="block truncate text-[0.68rem]"
          :class="session.muted ? 'text-red-300' : 'text-emerald-400'"
        >
          {{ status }}
        </span>
      </span>
    </button>

    <FiveStackToolTip side="top" as-child>
      <template #trigger>
        <button
          type="button"
          class="grid size-8 shrink-0 place-items-center rounded-full transition-colors"
          :class="
            session.muted
              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
              : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
          "
          :aria-label="
            session.muted
              ? $t('layouts.voice_bar.unmute')
              : $t('layouts.voice_bar.mute')
          "
          :aria-pressed="session.muted"
          @click="toggleSessionMute()"
        >
          <component :is="session.muted ? MicOff : Mic" class="size-3.5" />
        </button>
      </template>
      {{
        session.muted
          ? $t("layouts.voice_bar.unmute")
          : $t("layouts.voice_bar.mute")
      }}
    </FiveStackToolTip>

    <FiveStackToolTip side="top" as-child>
      <template #trigger>
        <button
          type="button"
          class="grid size-8 shrink-0 place-items-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-500"
          :aria-label="$t('layouts.voice_bar.leave')"
          @click="leaveSession()"
        >
          <PhoneOff class="size-3.5" />
        </button>
      </template>
      {{ $t("layouts.voice_bar.leave") }}
    </FiveStackToolTip>
  </div>
</template>
