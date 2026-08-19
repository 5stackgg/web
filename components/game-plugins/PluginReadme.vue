<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { BookOpen } from "lucide-vue-next";

const props = defineProps<{
  content?: string | null;
  format?: string | null;
}>();

// Plenty of plugins ship a plain Readme.txt -- a cvar reference with indented
// descriptions, say. Run through a markdown parser those indents become code
// blocks or fold into the paragraph above, which reads as one long run-on. If
// it is not a markdown file, it is shown as written.
const isMarkdown = computed(() => props.format !== "text");

function externaliseLinks(node: Element) {
  if (node.tagName !== "A") {
    return;
  }

  const href = node.getAttribute("href");

  if (!href || href.startsWith("#")) {
    return;
  }

  node.setAttribute("target", "_blank");
  node.setAttribute("rel", "noopener noreferrer");
}

// A README is somebody else's HTML by the time marked is done with it, and it
// renders inside the panel's own document. Sanitizing is the whole safety story:
// no scripts, no event handlers, no iframes from arbitrary hosts.
const rendered = computed(() => {
  if (!props.content || !isMarkdown.value) {
    return null;
  }

  const html = marked.parse(props.content, {
    async: false,
    gfm: true,
    breaks: false,
  }) as string;

  // A README links to its own repo, its docs, its releases. Following one in
  // this tab throws away where the reader was -- mid-install, on a specific
  // node. Anchors are left alone: those are navigation within the README.
  DOMPurify.addHook("afterSanitizeAttributes", externaliseLinks);

  try {
    return DOMPurify.sanitize(html, {
      FORBID_TAGS: ["script", "style", "iframe", "form", "input", "button"],
      FORBID_ATTR: ["style", "onerror", "onload"],
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
    });
  } finally {
    DOMPurify.removeHook("afterSanitizeAttributes", externaliseLinks);
  }
});
const plainText = computed(() =>
  !isMarkdown.value && props.content ? props.content : null,
);
</script>

<template>
  <section v-if="rendered || plainText" class="space-y-3">
    <h2
      class="flex items-center gap-2 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
    >
      <BookOpen class="h-3.5 w-3.5" />
      {{ $t("pages.plugins.readme") }}
    </h2>

    <!-- Scoped rather than a prose plugin: the README arrives with whatever
         heading levels its author felt like, so it is normalised here instead
         of fighting the page's own hierarchy. -->
    <div v-if="rendered" class="plugin-readme" v-html="rendered"></div>
    <pre v-else class="plugin-readme-plain">{{ plainText }}</pre>
  </section>
</template>

<style scoped>
.plugin-readme-plain {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8rem;
  line-height: 1.6;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 0.35);
  border: 1px solid hsl(var(--border) / 0.6);
  border-radius: 0.375rem;
  padding: 0.85rem;
  /* The indentation is the structure in these files, so it is kept -- but a
     cvar reference has long description lines that must still wrap. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 32rem;
  overflow-y: auto;
}

.plugin-readme {
  --readme-rule: hsl(var(--border) / 0.6);
  font-size: 0.925rem;
  line-height: 1.7;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
}

.plugin-readme :deep(h1),
.plugin-readme :deep(h2),
.plugin-readme :deep(h3),
.plugin-readme :deep(h4) {
  color: hsl(var(--foreground));
  font-weight: 600;
  line-height: 1.3;
  margin: 1.75rem 0 0.75rem;
}

.plugin-readme :deep(h1) {
  font-size: 1.15rem;
  border-bottom: 1px solid var(--readme-rule);
  padding-bottom: 0.4rem;
}
.plugin-readme :deep(h2) {
  font-size: 1.05rem;
  border-bottom: 1px solid var(--readme-rule);
  padding-bottom: 0.35rem;
}
.plugin-readme :deep(h3) { font-size: 0.95rem; }
.plugin-readme :deep(h4) { font-size: 0.9rem; }

.plugin-readme :deep(> *:first-child) { margin-top: 0; }
.plugin-readme :deep(p) { margin: 0.75rem 0; }

.plugin-readme :deep(a) {
  color: hsl(var(--tac-amber));
  text-underline-offset: 2px;
}
.plugin-readme :deep(a:hover) { text-decoration: underline; }

.plugin-readme :deep(ul),
.plugin-readme :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.25rem;
}
.plugin-readme :deep(ul) { list-style: disc; }
.plugin-readme :deep(ol) { list-style: decimal; }
.plugin-readme :deep(li) { margin: 0.3rem 0; }

.plugin-readme :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  background: hsl(var(--muted) / 0.5);
  border: 1px solid var(--readme-rule);
  border-radius: 0.25rem;
  padding: 0.1rem 0.35rem;
}

.plugin-readme :deep(pre) {
  background: hsl(var(--muted) / 0.4);
  border: 1px solid var(--readme-rule);
  border-radius: 0.375rem;
  padding: 0.85rem;
  overflow-x: auto;
  margin: 0.9rem 0;
}
.plugin-readme :deep(pre code) {
  background: none;
  border: 0;
  padding: 0;
  font-size: 0.85rem;
}

.plugin-readme :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
}

.plugin-readme :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 0.9rem 0;
  font-size: 0.875rem;
}
.plugin-readme :deep(th),
.plugin-readme :deep(td) {
  border: 1px solid var(--readme-rule);
  padding: 0.4rem 0.6rem;
  text-align: left;
}
.plugin-readme :deep(th) {
  background: hsl(var(--muted) / 0.35);
  color: hsl(var(--foreground));
  font-weight: 600;
}

.plugin-readme :deep(blockquote) {
  border-left: 2px solid hsl(var(--tac-amber) / 0.5);
  padding-left: 0.85rem;
  margin: 0.9rem 0;
  color: hsl(var(--muted-foreground) / 0.85);
}

.plugin-readme :deep(hr) {
  border: 0;
  border-top: 1px solid var(--readme-rule);
  margin: 1.5rem 0;
}
</style>
