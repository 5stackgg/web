<script lang="ts">
import { computed, defineComponent, h, resolveComponent } from "vue";
import DOMPurify from "dompurify";

function toInternalPath(href: string | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("/")) return href;
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
      // Sanitize before parsing: notification HTML is server-built and may
      // embed user-controlled fields (team/player names, scheduling text).
      // DOMPurify strips scripts, event-handler attributes, and javascript:
      // URIs so the nodeToVNode rebuild below cannot reconstruct an XSS sink.
      // Mirrors the news components, which sanitize the same way.
      container.innerHTML = DOMPurify.sanitize(props.html);
      return Array.from(container.childNodes)
        .map((n) => nodeToVNode(n, NuxtLink))
        .filter((c) => c !== null && c !== "");
    });

    return () => {
      if (!parsed.value) {
        // SSR (no DOM to sanitize against): render as escaped text rather than
        // raw innerHTML. The client re-renders the sanitized markup on hydrate.
        return h("span", props.html);
      }
      return h("span", parsed.value);
    };
  },
});
</script>
