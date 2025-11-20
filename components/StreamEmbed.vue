<script lang="ts" setup>
import { Button } from "~/components/ui/button";
import { ExternalLink } from "lucide-vue-next";
</script>

<template>
  <div class="space-y-3">
    <div class="aspect-video relative" v-if="selectedStream">
      <div ref="playerRef" class="w-full h-full"></div>
      <template v-if="global === false">
        <Button
          class="absolute top-2 right-2 w-8 h-8 rounded-sm opacity-70 hover:opacity-100 transition-opacity bg-background/80 hover:bg-background border border-border flex items-center justify-center z-10"
          @click="setGlobalStream(selectedStream)"
          type="button"
          :title="'Move to global view'"
          variant="ghost"
          size="icon"
        >
          <ExternalLink class="w-4 h-4" />
          <span class="sr-only">Move to global view</span>
        </Button>
      </template>
    </div>

    <div v-if="streams.length > 1" class="flex flex-wrap gap-2">
      <Button
        :size="showTitle ? 'sm' : 'icon'"
        v-for="stream in streams"
        :key="stream.id"
        :variant="selectedStream?.id === stream.id ? 'default' : 'outline'"
        :class="[
          'flex items-center gap-2',
          selectedStream?.id === stream.id
            ? 'bg-primary text-primary-foreground'
            : '',
        ]"
        @click="globalStream ? setGlobalStream(stream) : selectStream(stream)"
      >
        <component
          :is="getPlatformIcon(stream.link)"
          class="h-4 w-4"
          v-if="getPlatformIcon(stream.link)"
        />
        <span class="truncate max-w-[200px]" v-if="showTitle">{{
          stream.title || stream.link
        }}</span>
      </Button>
    </div>
  </div>
</template>

<script lang="ts">
type Platform = "twitch" | "youtube" | "kick" | "iframe" | null;

interface MatchStream {
  id: string;
  link: string;
  title?: string;
  priority?: number;
  preview: true;
}

import TwitchIcon from "~/components/icons/TwitchIcon.vue";
import YouTubeIcon from "~/components/icons/YouTubeIcon.vue";
import KickIcon from "~/components/icons/KickIcon.vue";

export default {
  components: {
    TwitchIcon,
    YouTubeIcon,
    KickIcon,
  },
  props: {
    global: {
      type: Boolean,
      default: false,
    },
    streams: {
      type: Array as () => MatchStream[],
      default: () => [],
    },
    showTitle: {
      type: Boolean,
      default: true,
    },
    setGlobalStreamOnly: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      playerInstance: null as any,
      platform: null as Platform,
      embedId: null as string | null,
      selectedStream: null as MatchStream | null,
    };
  },
  computed: {
    globalStream() {
      return useApplicationSettingsStore().globalStream;
    },
  },
  methods: {
    setGlobalStream(stream: MatchStream) {
      this.selectedStream = null;
      useApplicationSettingsStore().setGlobalStream(stream);
    },
    selectStream(stream: MatchStream) {
      if (this.selectedStream?.id === stream.id) {
        return;
      }

      if (this.setGlobalStreamOnly) {
        this.setGlobalStream(stream);
        return;
      }

      this.selectedStream = stream;
    },
    cleanupPlayer() {
      const playerRef = this.$refs.playerRef as HTMLDivElement | null;

      if (
        this.playerInstance &&
        typeof this.playerInstance.destroy === "function" &&
        !(this.playerInstance instanceof HTMLElement)
      ) {
        try {
          this.playerInstance.destroy();
        } catch (error) {
          console.warn("Error destroying player:", error);
        }
      }

      this.playerInstance = null;

      if (playerRef) {
        playerRef.innerHTML = "";
      }
    },
    getPlatformIcon(link: string) {
      const parsed = this.parseStreamLink(link);

      switch (parsed.platform) {
        case "twitch":
          return TwitchIcon;
        case "youtube":
          return YouTubeIcon;
        case "kick":
          return KickIcon;
      }
    },
    parseStreamLink(link: string): {
      platform: Platform;
      embedId: string | null;
    } {
      const url = new URL(link);
      const hostname = url.hostname.toLowerCase();

      if (hostname.endsWith("twitch.tv")) {
        if (url.pathname.includes("/videos/")) {
          const videoId = url.pathname.split("/videos/")[1]?.split("/")[0];
          if (videoId) {
            return { platform: "twitch", embedId: `video_${videoId}` };
          }
        }
        if (url.pathname.includes("/clip/")) {
          const clipId = url.pathname.split("/clip/")[1]?.split("/")[0];
          if (clipId) {
            return { platform: "twitch", embedId: `clip_${clipId}` };
          }
        }

        const [channel] = url.pathname.replace(/^\/+/, "").split("/");
        if (channel && channel !== "videos" && channel !== "clip") {
          return { platform: "twitch", embedId: channel };
        }

        if (url.searchParams.has("channel")) {
          return {
            platform: "twitch",
            embedId: url.searchParams.get("channel"),
          };
        }
      }

      if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
        let videoId: string | null = null;

        if (hostname.includes("youtu.be")) {
          videoId = url.pathname.replace(/^\/+/, "").split("?")[0];
        } else if (url.pathname.includes("/watch")) {
          videoId = url.searchParams.get("v");
        } else if (url.pathname.includes("/embed/")) {
          videoId = url.pathname.split("/embed/")[1]?.split("?")[0];
        } else if (url.pathname.includes("/live/")) {
          videoId = url.pathname.split("/live/")[1]?.split("?")[0];
        }

        if (videoId) {
          return { platform: "youtube", embedId: videoId };
        }
      }

      if (hostname.includes("kick.com")) {
        const [channel] = url.pathname.replace(/^\/+/, "").split("/");
        if (channel) {
          return { platform: "kick", embedId: channel };
        }
      }

      return { platform: "iframe", embedId: link };
    },
    async loadTwitchPlayerScript(): Promise<void> {
      return new Promise((resolve, reject) => {
        if ((window as any).Twitch && (window as any).Twitch.Player) {
          resolve();
          return;
        }

        const existing = document.querySelector(
          'script[src*="player.twitch.tv/js/embed/v1.js"]',
        );

        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject());
          return;
        }

        const script = document.createElement("script");

        script.src = "https://player.twitch.tv/js/embed/v1.js";
        script.onload = () => resolve();
        script.onerror = () => {
          reject(new Error("Failed to load Twitch player script"));
        };

        document.body.appendChild(script);
      });
    },
    mountTwitchPlayer(embedId: string) {
      const playerRef = this.$refs.playerRef as HTMLDivElement | null;
      if (!playerRef || !embedId) {
        return;
      }

      this.cleanupPlayer();

      const isVideo = embedId.startsWith("video_");
      const isClip = embedId.startsWith("clip_");

      const options: any = {
        width: "100%",
        height: "100%",
        parent: [window.location.hostname],
        autoplay: true,
      };

      if (isVideo) {
        options.video = embedId.replace("video_", "");
      } else if (isClip) {
        options.video = embedId.replace("clip_", "");
        options.collection = embedId.replace("clip_", "");
      } else {
        options.channel = embedId;
      }

      this.playerInstance = new (window as any).Twitch.Player(
        playerRef,
        options,
      );
    },
    mountYouTubePlayer(videoId: string) {
      const playerRef = this.$refs.playerRef as HTMLDivElement | null;
      if (!playerRef || !videoId) {
        return;
      }

      this.cleanupPlayer();

      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0&autoplay=1`;
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      iframe.style.aspectRatio = "16 / 9";
      iframe.style.width = "100%";
      iframe.style.height = "100%";

      playerRef.appendChild(iframe);

      this.playerInstance = iframe;
    },
    mountKickPlayer(channelName: string) {
      const playerRef = this.$refs.playerRef as HTMLDivElement | null;
      if (!playerRef || !channelName) return;

      this.cleanupPlayer();

      const iframe = document.createElement("iframe");
      iframe.src = `https://player.kick.com/${channelName}?autoplay=true`;
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.allow =
        "autoplay; fullscreen; encrypted-media; picture-in-picture";
      iframe.style.aspectRatio = "16 / 9";
      iframe.style.width = "100%";
      iframe.style.height = "100%";

      playerRef.appendChild(iframe);
      this.playerInstance = iframe;
    },
    mountGenericIframe(url: string) {
      const playerRef = this.$refs.playerRef as HTMLDivElement | null;
      if (!playerRef || !url) return;

      this.cleanupPlayer();

      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.width = "100%";
      iframe.height = "100%";
      iframe.allow =
        "autoplay; fullscreen; encrypted-media; picture-in-picture";
      iframe.style.aspectRatio = "16 / 9";
      iframe.style.width = "100%";
      iframe.style.height = "100%";

      playerRef.appendChild(iframe);
      this.playerInstance = iframe;
    },
    async loadStream() {
      if (!this.selectedStream || !this.selectedStream.link) {
        this.platform = null;
        this.embedId = null;
        return;
      }

      const parsed = this.parseStreamLink(this.selectedStream.link);
      this.platform = parsed.platform;
      this.embedId = parsed.embedId;

      if (!this.embedId) {
        return;
      }

      switch (this.platform) {
        case "twitch":
          await this.loadTwitchPlayerScript();
          this.mountTwitchPlayer(this.embedId);
          break;
        case "youtube":
          this.mountYouTubePlayer(this.embedId);
          break;
        case "kick":
          this.mountKickPlayer(this.embedId);
          break;
        case "iframe":
          this.mountGenericIframe(this.embedId);
          break;
      }
    },
  },
  watch: {
    selectedStream(stream, oldStream) {
      if (stream !== oldStream && stream !== null) {
        // Use requestAnimationFrame to defer heavy operations
        requestAnimationFrame(() => {
          this.$nextTick(() => {
            this.loadStream();
          });
        });
      }
    },
    streams: {
      immediate: true,
      handler() {
        if (!this.streams || this.streams.length === 0) {
          return;
        }

        if (this.global || (!this.setGlobalStreamOnly && !this.globalStream)) {
          this.selectStream(this.streams.at(0));
        }
      },
    },
  },
};
</script>
