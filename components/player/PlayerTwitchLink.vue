<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import TwitchIcon from "~/components/icons/TwitchIcon.vue";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import { dateLocale } from "~/utilities/dateLocale";
import { twitchChannelUrl, type TwitchPlayer } from "~/composables/useTwitch";

const props = defineProps<{ stream: TwitchPlayer }>();

const { t } = useI18n();

const href = computed(() => twitchChannelUrl(props.stream.login));

const compactViewers = computed(() =>
  new Intl.NumberFormat(dateLocale(), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(props.stream.viewer_count ?? 0),
);

const liveLabel = computed(
  () =>
    `${t("twitch.live_on_twitch")} · ${t("twitch.watching", {
      count: (props.stream.viewer_count ?? 0).toLocaleString(dateLocale()),
    })}`,
);
</script>

<template>
  <HeightSwap axis="x" class="flex shrink-0">
    <a
      v-if="stream.is_live"
      key="live"
      :href="href"
      target="_blank"
      rel="noopener noreferrer"
      :title="liveLabel"
      :aria-label="liveLabel"
      data-test="twitch-live"
      class="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-destructive/50 bg-destructive/10 px-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-destructive transition-colors duration-150 hover:bg-destructive/20"
    >
      <span class="relative flex h-1.5 w-1.5">
        <span
          class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
        ></span>
        <span
          class="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive"
        ></span>
      </span>
      <TwitchIcon class="h-3 w-3" />
      {{ $t("twitch.live_viewers", { count: compactViewers }) }}
    </a>
    <a
      v-else
      key="offline"
      :href="href"
      target="_blank"
      rel="noopener noreferrer"
      :title="$t('twitch.channel')"
      :aria-label="$t('twitch.channel')"
      data-test="twitch-channel"
      class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card/60 text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber)_/_0.6)] hover:bg-[hsl(var(--tac-amber)_/_0.1)] hover:text-[hsl(var(--tac-amber))]"
    >
      <TwitchIcon class="h-3.5 w-3.5" />
    </a>
  </HeightSwap>
</template>
