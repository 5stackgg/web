<script lang="ts" setup>
import { Button } from "~/components/ui/button";
</script>

<template>
  <div class="space-y-3">
    <div class="aspect-video">
      <div ref="playerRef"></div>
      <div v-if="!isValid && selectedStream" class="text-red-500 mt-2 text-xs">
        Unable to load stream.
      </div>
      <div
        v-if="!selectedStream && streams && streams.length > 0"
        class="text-muted-foreground mt-2 text-xs"
      >
        No stream selected.
      </div>
    </div>

    <div v-if="streams && streams.length > 1" class="flex flex-wrap gap-2">
      <Button
        v-for="stream in streams"
        :key="stream.id"
        :variant="selectedStreamId === stream.id ? 'default' : 'outline'"
        :class="[
          'flex items-center gap-2',
          selectedStreamId === stream.id
            ? 'bg-primary text-primary-foreground'
            : '',
        ]"
        @click="selectedStreamId = stream.id"
      >
        <component
          :is="getPlatformIcon(stream.link)"
          class="h-4 w-4"
          v-if="getPlatformIcon(stream.link)"
        />
        <span class="truncate max-w-[200px]">{{
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
    streams: {
      type: Array as () => MatchStream[],
      default: () => [],
    },
  },
  data() {
    return {
      playerInstance: null as any,
      platform: null as Platform,
      embedId: null as string | null,
      selectedStreamId: null as string | null,
    };
  },
  computed: {
    selectedStream(): MatchStream | undefined {
      if (!this.streams || this.streams.length === 0) {
        return;
      }
      if (!this.selectedStreamId) {
        return this.streams.at(0);
      }

      return this.streams.find((stream) => {
        return stream.id === this.selectedStreamId;
      });
    },
    isValid(): boolean {
      return this.platform !== null && this.embedId !== null;
    },
  },
  methods: {
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
    loadTwitchPlayerScript(): Promise<void> {
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
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
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
      iframe.allow = "autoplay; fullscreen";
      iframe.allowFullscreen = true;
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
      iframe.frameBorder = "0";
      iframe.allow =
        "autoplay; fullscreen; encrypted-media; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.style.aspectRatio = "16 / 9";
      iframe.style.width = "100%";
      iframe.style.height = "100%";

      playerRef.appendChild(iframe);
      this.playerInstance = iframe;
    },
    mountPlayer() {
      if (!this.platform || !this.embedId) return;

      switch (this.platform) {
        case "twitch":
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
    async loadStream() {
      if (!this.selectedStream || !this.selectedStream.link) {
        this.platform = null;
        this.embedId = null;
        return;
      }

      const parsed = this.parseStreamLink(this.selectedStream.link);
      this.platform = parsed.platform;
      this.embedId = parsed.embedId;

      if (this.platform === "twitch") {
        await this.loadTwitchPlayerScript();
      }

      if (this.isValid) {
        this.mountPlayer();
      }
    },
  },
  async mounted() {
    if (this.streams && this.streams.length > 0 && !this.selectedStreamId) {
      this.selectedStreamId = this.streams[0].id;
    }
    await this.loadStream();
  },
  watch: {
    selectedStreamId() {
      this.loadStream();
    },
    streams: {
      immediate: false,
      handler() {
        if (this.streams && this.streams.length > 0) {
          const currentExists =
            this.selectedStreamId &&
            this.streams.some((stream) => {
              return stream.id === this.selectedStreamId;
            });

          if (!currentExists) {
            this.selectedStreamId = this.streams[0].id;
          }
        }

        this.loadStream();
      },
    },
  },
};
</script>
