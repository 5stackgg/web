<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Users } from "lucide-vue-next";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { practiceServerState } from "~/components/utility/practiceServerState";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import cleanMapName from "~/utilities/cleanMapName";
import type { UtilityRunningPracticeSession } from "~/types/utility";

const props = defineProps<{
  session: UtilityRunningPracticeSession;
  regionName: string | null;
  selected: boolean;
}>();

defineEmits<{ select: [] }>();

const { t } = useI18n();

const apiDomain = useRuntimeConfig().public.apiDomain as string;

const hostName = computed(() => props.session.host?.name ?? null);
const hostSteamId = computed(
  () => props.session.host?.steam_id ?? props.session.host_steam_id,
);

const avatar = computed(() =>
  resolveAvatarUrl(props.session.host?.avatar_url, apiDomain, 64),
);

const connected = computed(() => props.session.connected_players ?? 0);
const max = computed(() => props.session.max_players);

const state = computed(() => practiceServerState(props.session, t));
</script>

<template>
  <button
    type="button"
    data-practice-server
    :aria-current="selected ? 'true' : undefined"
    class="flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors duration-200 motion-reduce:transition-none"
    :class="
      selected
        ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.06)]'
        : 'border-border/70 bg-card/50 hover:bg-muted/30'
    "
    @click="$emit('select')"
  >
    <Avatar shape="square" class="h-7 w-7 shrink-0 rounded-md">
      <AvatarImage
        v-if="avatar"
        :src="avatar"
        :alt="hostName ?? ''"
        draggable="false"
        class="select-none"
      />
      <AvatarFallback class="text-[0.6rem]">
        {{ (hostName || "?").slice(0, 2) }}
      </AvatarFallback>
    </Avatar>

    <span class="min-w-0 flex-1">
      <span class="block truncate text-[13px] font-semibold">
        {{ hostName ?? hostSteamId }}
      </span>
      <span class="block truncate text-xs text-muted-foreground">
        {{ cleanMapName(session.map_name) }}
        <template v-if="regionName"> · {{ regionName }}</template>
        ·
        <span :class="state.tone">{{ state.label }}</span>
      </span>
    </span>

    <span
      class="inline-flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground"
      :title="
        max != null
          ? $t('pages.utility.practice_servers.players', {
              connected,
              max,
            })
          : undefined
      "
    >
      <Users class="h-3 w-3" />
      <AnimatedStat :value="connected" /><template v-if="max != null"
        >/{{ max }}</template
      >
    </span>
  </button>
</template>
