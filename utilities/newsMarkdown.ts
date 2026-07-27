import { marked, type Tokens } from "marked";
import DOMPurify from "dompurify";
import { parseExternalMedia } from "~/utilities/externalMedia";

/**
 * Shared renderer for news article bodies, used by both the editor preview and
 * the reader view so a draft can never render differently from what ships.
 *
 * On top of plain markdown it understands a block-level video token:
 *
 *   @[video](https://youtu.be/abc123)
 *   @[video](https://api.example/news/video/ab12.mp4 "https://…/poster.webp")
 *
 * The optional quoted argument is a poster URL (markdown link-title syntax).
 * Anything we can't embed degrades to a plain external link.
 */

// Hosts whose iframes we are willing to keep after sanitizing. Everything the
// renderer itself produces is in here; the allowlist exists to stop an author
// hand-writing an <iframe> into the markdown from reaching readers.
const EMBED_HOSTS = new Set([
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "www.youtube.com",
  "youtube.com",
  "player.twitch.tv",
  "clips.twitch.tv",
]);

const VIDEO_TOKEN = /^@\[video\]\(\s*([^\s)]+)(?:\s+"([^"]*)")?\s*\)/;

export function videoToken(src: string, poster?: string | null): string {
  return poster ? `@[video](${src} "${poster}")` : `@[video](${src})`;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isSafeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

// True when a bare URL would render as a real player rather than a link, so
// the editor can auto-convert a pasted link into a video token. Deliberately
// excludes generic links — those are better left as ordinary markdown links.
export function isEmbeddableVideoUrl(value: string): boolean {
  const url = value.trim();
  if (!isSafeUrl(url) || /\s/.test(url)) {
    return false;
  }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return true;
  }
  const parentHost = import.meta.client ? window.location.hostname : "";
  return !!parseExternalMedia(url, parentHost).embedUrl;
}

function renderVideo(src: string, poster: string): string {
  if (!isSafeUrl(src)) {
    return "";
  }

  const safeSrc = escapeAttribute(src);
  const parentHost = import.meta.client ? window.location.hostname : "";
  const media = parseExternalMedia(src, parentHost);

  if (media.embedUrl) {
    return [
      '<div class="news-embed">',
      `<iframe src="${escapeAttribute(media.embedUrl)}" loading="lazy"`,
      ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"',
      ' allowfullscreen frameborder="0"></iframe>',
      "</div>",
    ].join("");
  }

  if (/\.(mp4|webm|mov)(\?|$)/i.test(src)) {
    const posterAttr =
      poster && isSafeUrl(poster)
        ? ` poster="${escapeAttribute(poster)}"`
        : "";
    return (
      `<div class="news-embed"><video class="news-video" controls preload="metadata"` +
      ` playsinline${posterAttr}><source src="${safeSrc}" type="video/mp4"></video></div>`
    );
  }

  // Not embeddable and not a file we can play — fall back to a link out so the
  // article still points somewhere useful.
  return (
    `<p class="news-embed-link"><a href="${safeSrc}" target="_blank"` +
    ` rel="noopener noreferrer">${escapeAttribute(media.watchUrl)}</a></p>`
  );
}

interface VideoTokenNode extends Tokens.Generic {
  type: "newsVideo";
  raw: string;
  src: string;
  poster: string;
}

marked.use({
  extensions: [
    {
      name: "newsVideo",
      level: "block",
      start(src: string) {
        return src.match(/@\[video\]\(/)?.index;
      },
      tokenizer(src: string): VideoTokenNode | undefined {
        const match = VIDEO_TOKEN.exec(src);
        // Reject anything non-http(s) at the tokenizer so marked falls back to
        // ordinary parsing and the author sees their literal text, rather than
        // the token silently rendering to nothing.
        if (!match || !isSafeUrl(match[1])) {
          return undefined;
        }
        return {
          type: "newsVideo",
          raw: match[0],
          src: match[1],
          poster: match[2] ?? "",
        };
      },
      renderer(token: Tokens.Generic) {
        const node = token as VideoTokenNode;
        return renderVideo(node.src, node.poster);
      },
    },
  ],
});

// DOMPurify's default allowlist already permits <video>/<source> but forbids
// <iframe> outright, so embeds have to be added back explicitly — narrowed to
// the hosts above by the hook below.
let hookInstalled = false;
function installHook() {
  if (hookInstalled || !import.meta.client) {
    return;
  }
  hookInstalled = true;
  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName !== "iframe") {
      return;
    }
    const src = (node as Element).getAttribute?.("src") ?? "";
    let host = "";
    try {
      host = new URL(src).hostname;
    } catch {
      host = "";
    }
    if (!EMBED_HOSTS.has(host)) {
      (node as Element).remove();
    }
  });
}

export function renderNewsMarkdown(source: string | null | undefined): string {
  if (!import.meta.client || !source) {
    return "";
  }
  installHook();
  const html = marked.parse(source, { breaks: true }) as string;
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    // `target` is not in DOMPurify's default allowlist, so the fallback link
    // would lose its _blank without this; `rel` already survives.
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "target"],
  });
}
