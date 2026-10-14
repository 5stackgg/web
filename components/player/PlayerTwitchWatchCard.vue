<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useNow } from "@vueuse/core";
import { ExternalLink, Play } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { useCommunityFormat } from "~/composables/useCommunityFormat";
import { twitchChannelUrl, type TwitchPlayer } from "~/composables/useTwitch";

const props = defineProps<{ stream: TwitchPlayer }>();

const { t } = useI18n();
const { played, count } = useCommunityFormat();
const now = useNow({ interval: 60_000 });

const playing = ref(false);

watch(
  () => props.stream.login,
  () => {
    playing.value = false;
  },
);

const href = computed(() => twitchChannelUrl(props.stream.login));

const title = computed(
  () => props.stream.title || props.stream.display_name || props.stream.login,
);

const meta = computed(() => {
  const parts: string[] = [];
  if (props.stream.game_name) {
    parts.push(props.stream.game_name);
  }
  if (props.stream.viewer_count != null) {
    parts.push(
      t("twitch.watching", { count: count(props.stream.viewer_count) }),
    );
  }
  if (props.stream.started_at) {
    const elapsed = now.value.getTime() - Date.parse(props.stream.started_at);
    const seconds = Math.max(0, Math.floor(elapsed / 1000));
    parts.push(t("twitch.live_for", { duration: played(seconds) }));
  }
  return parts.join(" · ");
});

// Twitch refuses to play inside a page that is not named as its parent.
const embedSrc = computed(
  () =>
    `https://player.twitch.tv/?channel=${encodeURIComponent(props.stream.login)}&parent=${encodeURIComponent(window.location.hostname)}&autoplay=true&muted=false`,
);
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border border-border bg-card/50"
    data-test="twitch-watch-card"
  >
    <FadeSwap>
      <button
        v-if="!playing"
        key="preview"
        type="button"
        class="group relative block aspect-video w-full overflow-hidden bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[hsl(var(--tac-amber)/0.5)]"
        :aria-label="$t('twitch.play')"
        @click="playing = true"
      >
        <img
          v-if="stream.thumbnail_url"
          :src="stream.thumbnail_url"
          alt=""
          loading="lazy"
          class="absolute inset-0 h-full w-full object-cover"
        />
        <span
          class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm bg-destructive px-1.5 py-0.5 font-mono text-[0.55rem] font-bold uppercase tracking-[0.18em] text-white"
        >
          {{ $t("twitch.live") }}
        </span>
        <span class="absolute inset-0 grid place-items-center">
          <span
            class="grid h-12 w-12 place-items-center rounded-full bg-black/55 text-white transition-transform duration-200 ease-out group-hover:scale-110 motion-reduce:transition-none"
          >
            <Play class="h-5 w-5 fill-current" />
          </span>
        </span>
      </button>
      <div v-else key="player" class="relative aspect-video w-full bg-black">
        <iframe
          :src="embedSrc"
          :title="title"
          class="absolute inset-0 h-full w-full"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
    </FadeSwap>
    <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div class="min-w-0">
        <div class="truncate text-sm font-semibold">{{ title }}</div>
        <div class="text-xs text-muted-foreground">{{ meta }}</div>
      </div>
      <Button
        as="a"
        :href="href"
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
        size="sm"
        class="shrink-0"
      >
        <ExternalLink />
        {{ $t("twitch.open_on_twitch") }}
      </Button>
    </div>
  </div>
</template>
