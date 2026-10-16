<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";
import { twitchChannelUrl, useMatchTwitchPovs } from "~/composables/useTwitch";

// Renderless, so an Options API page can take the polled POVs as a slot prop
// instead of reaching into setup bindings.
const props = defineProps<{
  match:
    | {
        id?: string | null;
        status?: string | null;
        is_in_lineup?: boolean | null;
        is_coach?: boolean | null;
      }
    | null
    | undefined;
  streams?: Array<Record<string, any>>;
}>();

const { t } = useI18n();
const { streams: povs } = useMatchTwitchPovs(() => props.match);

const povStreams = computed(() =>
  povs.value.map((pov) => ({
    id: `twitch-pov:${pov.steam_id}`,
    link: twitchChannelUrl(pov.login),
    title: t("twitch.pov", { name: pov.name }),
    name: pov.name,
    steam_id: pov.steam_id,
    match_id: props.match?.id ?? null,
    avatar_url: resolveAvatarUrl(
      pov.avatar_url,
      useRuntimeConfig().public.apiDomain,
      64,
    ),
    is_pov: true,
    preview: true as const,
  })),
);

const merged = computed(() => [...(props.streams ?? []), ...povStreams.value]);
</script>

<template>
  <slot :streams="merged" :povs="povStreams" />
</template>
