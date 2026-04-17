<script lang="ts">
import { computed, defineComponent, h, resolveComponent } from "vue";

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
      return h(NuxtLink, { to: internalPath, class: attrs.class }, () => children);
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
      container.innerHTML = props.html;
      return Array.from(container.childNodes)
        .map((n) => nodeToVNode(n, NuxtLink))
        .filter((c) => c !== null && c !== "");
    });

    return () => {
      if (!parsed.value) {
        return h("span", { innerHTML: props.html });
      }
      return h("span", parsed.value);
    };
  },
});
</script>
