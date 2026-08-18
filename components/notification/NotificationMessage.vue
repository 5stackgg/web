<script lang="ts">
import { computed, defineComponent, h, resolveComponent } from "vue";
import DOMPurify from "dompurify";

// Notification bodies are html because the api embeds the link the notification
// should take you to. Everything user-controlled in them is escaped on the way
// in (NotificationsService.escapeHtml), and this is the second lock on that:
// the walk below copies every attribute it finds onto the rendered element, so
// a single missed escape upstream is `onerror=` running in the bell.
//
// The api only ever emits <a> and <b>; the rest are here so a future message
// with light formatting in it renders rather than arriving stripped.
const ALLOWED_TAGS = ["a", "b", "strong", "i", "em", "code", "br", "span"];
const ALLOWED_ATTR = ["href", "target", "rel", "class"];

function toInternalPath(href: string | undefined): string | null {
  if (!href) return null;
  // Not `startsWith("/")` on its own: `//evil.test/x` passes that and is a
  // fully qualified url to somewhere else, which NuxtLink would follow.
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // mailto:, tel:, malformed — leave as-is
  }
  return null;
}

function nodeToVNode(node: Node, NuxtLink: any): any {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const attrs: Record<string, any> = {};
  for (const attr of Array.from(el.attributes)) {
    attrs[attr.name] = attr.value;
  }
  const children = Array.from(el.childNodes)
    .map((n) => nodeToVNode(n, NuxtLink))
    .filter((c) => c !== null && c !== "");

  if (tag === "a") {
    const target = attrs.target as string | undefined;
    const internalPath = toInternalPath(attrs.href as string | undefined);
    if (internalPath && (!target || target === "_self")) {
      return h(
        NuxtLink,
        { to: internalPath, class: attrs.class },
        () => children,
      );
    }
  }

  return h(tag, attrs, children);
}

export default defineComponent({
  name: "NotificationMessage",
  props: {
    html: { type: String, required: true },
  },
  setup(props) {
    const NuxtLink = resolveComponent("NuxtLink");

    const parsed = computed(() => {
      if (typeof window === "undefined") return null;
      const container = document.createElement("div");
      container.innerHTML = DOMPurify.sanitize(props.html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
      });
      return Array.from(container.childNodes)
        .map((n) => nodeToVNode(n, NuxtLink))
        .filter((c) => c !== null && c !== "");
    });

    return () => {
      if (!parsed.value) {
        // No DOM to sanitize against on the server, and this must not emit
        // markup nothing has checked. As a text child whatever is left of the
        // tags is escaped by Vue rather than parsed by the browser, so the
        // strip only has to be tidy, not airtight.
        return h("span", props.html.replace(/<[^>]*>/g, ""));
      }
      return h("span", parsed.value);
    };
  },
});
</script>
