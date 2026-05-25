<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Radio } from "lucide-vue-next";
import TwitchIcon from "~/components/icons/TwitchIcon.vue";
import YouTubeIcon from "~/components/icons/YouTubeIcon.vue";
import KickIcon from "~/components/icons/KickIcon.vue";
import MatchTableRow from "~/components/MatchTableRow.vue";
import StreamViewerBadge from "~/components/match/StreamViewerBadge.vue";

type Stream = {
  id: string;
  link: string;
  title?: string | null;
  is_game_streamer?: boolean;
};

const props = defineProps<{
  match: any;
}>();

const streams = computed<Stream[]>(() => props.match?.streams || []);
const primaryStream = computed<Stream | null>(() => {
  const list = streams.value;
  if (list.length === 0) return null;
  return list.find((s) => s.is_game_streamer) || list[0];
});
const extraStreamCount = computed(() => Math.max(streams.value.length - 1, 0));

type Platform = "twitch" | "youtube" | "kick" | "internal" | "iframe";

function parseLink(link: string): { platform: Platform; id: string | null } {
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    const seg = url.pathname.replace(/^\/+/, "").split("/")[0];

    if (host.endsWith("twitch.tv")) {
      if (seg && seg !== "videos" && seg !== "clip")
        return { platform: "twitch", id: seg.toLowerCase() };
    }
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      let vid: string | null = null;
      if (host.includes("youtu.be"))
        vid = url.pathname.replace(/^\/+/, "").split("?")[0];
      else if (url.pathname.includes("/watch")) vid = url.searchParams.get("v");
      else if (url.pathname.includes("/embed/"))
        vid = url.pathname.split("/embed/")[1]?.split("?")[0];
      else if (url.pathname.includes("/live/"))
        vid = url.pathname.split("/live/")[1]?.split("?")[0];
      if (vid) return { platform: "youtube", id: vid };
    }
    if (host.includes("kick.com")) return { platform: "kick", id: seg || null };
  } catch {
    /* ignore */
  }
  return { platform: "iframe", id: null };
}

const parsed = computed(() => {
  const link = primaryStream.value?.link;
  if (!link) return null;
  if (primaryStream.value?.is_game_streamer)
    return { platform: "internal" as Platform, id: null };
  return parseLink(link);
});

const platformMeta = computed<{ name: string; icon: any } | null>(() => {
  switch (parsed.value?.platform) {
    case "twitch":
      return { name: "Twitch", icon: TwitchIcon };
    case "youtube":
      return { name: "YouTube", icon: YouTubeIcon };
    case "kick":
      return { name: "Kick", icon: KickIcon };
    case "internal":
      return { name: "5stack", icon: Radio };
    default:
      return null;
  }
});

const thumbBust = ref(Math.floor(Date.now() / 30000));
let bustTimer: ReturnType<typeof setInterval> | null = null;
if (typeof window !== "undefined") {
  bustTimer = setInterval(() => {
    thumbBust.value = Math.floor(Date.now() / 30000);
  }, 30_000);
}
onBeforeUnmount(() => {
  if (bustTimer) clearInterval(bustTimer);
  bustTimer = null;
});

const internalSnapshotUrl = computed<string | null>(() => {
  const link = primaryStream.value?.link;
  if (!link) return null;
  try {
    const url = new URL(link);
    return `${url.protocol}//${url.host}/snapshot/${props.match.id}?b=${thumbBust.value}`;
  } catch {
    return null;
  }
});

const thumbnailUrl = computed<string | null>(() => {
  const p = parsed.value;
  if (!p) return null;
  if (p.platform === "internal") {
    return internalSnapshotUrl.value;
  }
  if (!p.id) return null;
  if (p.platform === "twitch") {
    return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${p.id}-1280x720.jpg?b=${thumbBust.value}`;
  }
  if (p.platform === "youtube") {
    return `https://img.youtube.com/vi/${p.id}/maxresdefault.jpg`;
  }
  return null;
});

const thumbFailed = ref(false);
watch(thumbnailUrl, () => {
  thumbFailed.value = false;
});

function onWatchClick(e: Event) {
  e.preventDefault();
  e.stopPropagation();
  if (!primaryStream.value) return;
  useApplicationSettingsStore().setGlobalStream({
    ...primaryStream.value,
    match_id: props.match.id,
    preview: true,
  } as any);
}
</script>

<template>
  <div
    class="group/stream grid w-full max-w-[46rem] grid-cols-1 overflow-hidden rounded-lg border border-border bg-muted/30 transition-all duration-300 hover:border-primary/30 hover:bg-muted/20 hover:shadow-lg hover:shadow-primary/10 sm:grid-cols-[22rem_minmax(0,1fr)]"
  >
    <div
      class="relative h-full w-full overflow-hidden bg-background/60 sm:border-r sm:border-border"
    >
      <img
        v-if="thumbnailUrl && !thumbFailed"
        :src="thumbnailUrl"
        :alt="primaryStream?.title || ''"
        loading="lazy"
        referrerpolicy="no-referrer"
        class="aspect-video w-full object-cover"
        @error="thumbFailed = true"
      />
      <div
        v-else
        class="flex aspect-video w-full items-center justify-center bg-[radial-gradient(ellipse_at_center,hsl(var(--muted)/0.5)_0%,hsl(var(--background))_70%)]"
      >
        <component
          v-if="platformMeta?.icon"
          :is="platformMeta.icon"
          class="h-10 w-10 text-muted-foreground/50"
        />
      </div>

      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/75 via-background/0 to-background/0"
      ></div>

      <div
        v-if="extraStreamCount > 0"
        class="absolute right-2 top-2 inline-flex items-center rounded-md border border-border/70 bg-black/55 px-1.5 py-[3px] font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] leading-none text-white/85 backdrop-blur-sm"
      >
        +{{ extraStreamCount }}
      </div>

      <div class="absolute bottom-2 left-2">
        <StreamViewerBadge :match-id="match.id" size="md" />
      </div>

      <button
        type="button"
        :title="$t('match.stream.watch')"
        class="absolute bottom-2 right-2 inline-flex items-center justify-center gap-1.5 rounded-md border border-[hsl(0_85%_55%/0.55)] bg-[hsl(0_85%_50%/0.08)] px-3 py-1.5 text-xs font-medium leading-none text-[hsl(0_90%_72%)] transition-colors hover:border-[hsl(0_85%_55%)] hover:bg-[hsl(0_85%_50%/0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(0_85%_55%/0.6)]"
        @click="onWatchClick"
      >
        <Radio class="h-3.5 w-3.5" />
        <span>{{ $t("match.stream.watch") }}</span>
      </button>
    </div>

    <MatchTableRow
      :match="match"
      compact
      always-show
      embedded
      hide-stream-button
      class="h-full"
    />
  </div>
</template>
