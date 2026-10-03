import { Radio } from "lucide-vue-next";
import TwitchIcon from "~/components/icons/TwitchIcon.vue";
import YouTubeIcon from "~/components/icons/YouTubeIcon.vue";
import KickIcon from "~/components/icons/KickIcon.vue";

export type StreamPlatform = "internal" | "twitch" | "youtube" | "kick" | "iframe";

export type WatchStream = {
  id: string;
  link: string;
  title?: string | null;
  is_game_streamer?: boolean | null;
  is_live?: boolean | null;
  priority?: number | null;
};

export function parseStreamLink(link: string): {
  platform: Exclude<StreamPlatform, "internal">;
  id: string | null;
} {
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    const seg = url.pathname.replace(/^\/+/, "").split("/")[0];

    if (host.endsWith("twitch.tv") && seg && seg !== "videos" && seg !== "clip") {
      return { platform: "twitch", id: seg.toLowerCase() };
    }
    if (host.includes("youtube.com") || host.includes("youtu.be")) {
      let vid: string | null = null;
      if (host.includes("youtu.be")) vid = seg || null;
      else if (url.pathname.includes("/watch")) vid = url.searchParams.get("v");
      else if (url.pathname.includes("/embed/"))
        vid = url.pathname.split("/embed/")[1]?.split("?")[0] ?? null;
      else if (url.pathname.includes("/live/"))
        vid = url.pathname.split("/live/")[1]?.split("?")[0] ?? null;
      if (vid) return { platform: "youtube", id: vid };
    }
    if (host.includes("kick.com")) return { platform: "kick", id: seg || null };
  } catch {
    // not a URL -- treated as a bare iframe below
  }
  return { platform: "iframe", id: null };
}

export function streamPlatform(stream: WatchStream | null | undefined) {
  if (!stream) return null;
  if (stream.is_game_streamer) return { platform: "internal" as const, id: null };
  return parseStreamLink(stream.link);
}

const PLATFORM_META: Record<StreamPlatform, { name: string; icon: any } | null> =
  {
    internal: { name: "5Stack", icon: Radio },
    twitch: { name: "Twitch", icon: TwitchIcon },
    youtube: { name: "YouTube", icon: YouTubeIcon },
    kick: { name: "Kick", icon: KickIcon },
    iframe: null,
  };

export function streamPlatformMeta(stream: WatchStream | null | undefined) {
  const parsed = streamPlatform(stream);
  return parsed ? PLATFORM_META[parsed.platform] : null;
}

// The game streamer is the match's own feed, so it leads; the rest keep the
// organizer's priority order.
export function orderedStreams(streams: WatchStream[] | null | undefined) {
  return [...(streams ?? [])].sort((a, b) => {
    if (!!a.is_game_streamer !== !!b.is_game_streamer) {
      return a.is_game_streamer ? -1 : 1;
    }
    return (a.priority ?? 0) - (b.priority ?? 0);
  });
}
