import { Marked, marked, type Token, type Tokens } from "marked";
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

const videoExtension = {
  name: "newsVideo",
  level: "block" as const,
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
};

marked.use({ extensions: [videoExtension] });

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

function sanitize(html: string): string {
  installHook();
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    // `target` is not in DOMPurify's default allowlist, so the fallback link
    // would lose its _blank without this; `rel` already survives.
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "target"],
  });
}

export function renderNewsMarkdown(source: string | null | undefined): string {
  if (!import.meta.client || !source) {
    return "";
  }
  return sanitize(marked.parse(source, { breaks: true }) as string);
}

export interface NewsSection {
  id: string;
  text: string;
}

export interface NewsOutline {
  sections: NewsSection[];
  minutes: number;
}

export interface RenderedNewsArticle extends NewsOutline {
  html: string;
  closingHtml: string;
}

const WORDS_PER_MINUTE = 230;

// Posts written for the old layout open with a heading that repeats the title
// (the page already shows it as the h1), sometimes under an HTML comment left
// from drafting.
function stripLead(source: string): string {
  return source
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*(?:<!--[\s\S]*?-->\s*)*/, "")
    .replace(/^#{1,2}[ \t][^\n]*(?:\n+|$)/, "")
    .trimStart();
}

function plainText(tokens: Token[] | undefined): string {
  return (tokens ?? [])
    .map((token) => {
      const nested = (token as Tokens.Generic).tokens as Token[] | undefined;
      return nested?.length
        ? plainText(nested)
        : ((token as Tokens.Text).text ?? "");
    })
    .join("");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// `###` headings are the post's sections: they feed the contents list and get
// ids so a section can be linked to.
function sectionsOf(tokens: Token[]): NewsSection[] {
  const seen = new Map<string, number>();
  return tokens
    .filter(
      (token): token is Tokens.Heading =>
        token.type === "heading" && token.depth === 3,
    )
    .map((token) => {
      const text = plainText(token.tokens).trim();
      const base = slugify(text) || "section";
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      return { id: count > 1 ? `${base}-${count}` : base, text };
    });
}

function minutesOf(source: string): number {
  const words = source
    .replace(/@\[video\]\([^)]*\)/g, " ")
    .replace(/[#>*_`~[\]()!|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Sections and read time without rendering, for list cards. */
export function newsOutline(source: string | null | undefined): NewsOutline {
  const body = stripLead(source ?? "");
  return {
    sections: sectionsOf(marked.lexer(body)),
    minutes: minutesOf(body),
  };
}

let pendingSectionIds: string[] = [];
let anchorLabel = "";

const articleMarked = new Marked({ breaks: true });
articleMarked.use({
  extensions: [videoExtension],
  renderer: {
    heading({ tokens, depth }: Tokens.Heading) {
      const inner = this.parser.parseInline(tokens);
      const id = depth === 3 ? pendingSectionIds.shift() : undefined;
      if (!id) {
        return `<h${depth}>${inner}</h${depth}>\n`;
      }
      return (
        `<h3 id="${id}"><a class="news-anchor" href="#${id}" aria-label="${escapeAttribute(anchorLabel)}">#</a>` +
        `${inner}</h3>\n`
      );
    },
  },
});

/**
 * The reader's render of a post: the body without its repeated title, its
 * sections, a read time, and the closing call to action split out. Posts end
 * with `---` and one short paragraph ("Ready to …?"), which reads as a sign-off
 * rather than another section.
 */
export function renderNewsArticle(
  source: string | null | undefined,
  options: { anchorLabel: string },
): RenderedNewsArticle {
  const body = stripLead(source ?? "");
  const outline = { sections: [] as NewsSection[], minutes: minutesOf(body) };
  if (!import.meta.client || !body) {
    return { ...outline, html: "", closingHtml: "" };
  }

  const tokens = articleMarked.lexer(body);
  let main: Token[] = tokens;
  let closing: Token[] = [];
  const rule = tokens.map((token) => token.type).lastIndexOf("hr");
  if (rule > -1) {
    const tail = tokens
      .slice(rule + 1)
      .filter((token) => token.type !== "space");
    if (
      tail.length > 0 &&
      tail.length <= 2 &&
      tail.every((token) => token.type === "paragraph")
    ) {
      main = tokens.slice(0, rule);
      closing = tail;
    }
  }

  outline.sections = sectionsOf(main);
  pendingSectionIds = outline.sections.map((section) => section.id);
  anchorLabel = options.anchorLabel;
  const html = articleMarked.parse(
    main.map((token) => token.raw).join(""),
  ) as string;
  pendingSectionIds = [];
  const closingHtml = closing.length
    ? (articleMarked.parse(
        closing.map((token) => token.raw).join("\n\n"),
      ) as string)
    : "";

  return {
    ...outline,
    html: sanitize(html),
    closingHtml: closingHtml ? sanitize(closingHtml) : "",
  };
}
