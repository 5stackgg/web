<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  Quote,
  Link as LinkIcon,
  Code,
  Image as ImageIcon,
} from "lucide-vue-next";

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const textarea = ref<HTMLTextAreaElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const { upload, uploading: isUploading, accept: ACCEPT } = useNewsImageUpload();

const debouncedValue = ref(props.modelValue);
let renderTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => props.modelValue,
  (value) => {
    if (renderTimer) {
      clearTimeout(renderTimer);
    }
    renderTimer = setTimeout(() => {
      debouncedValue.value = value;
    }, 150);
  },
);
onBeforeUnmount(() => {
  if (renderTimer) {
    clearTimeout(renderTimer);
  }
});

const rendered = computed(() => {
  if (!import.meta.client) {
    return "";
  }
  const html = marked.parse(debouncedValue.value || "", {
    breaks: true,
  }) as string;
  return DOMPurify.sanitize(html);
});

function replaceSelection(
  transform: (selected: string) => { text: string; selectStart?: number; selectEnd?: number },
) {
  const el = textarea.value;
  if (!el) {
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = props.modelValue || "";
  const selected = value.slice(start, end);
  const { text, selectStart, selectEnd } = transform(selected);
  const next = value.slice(0, start) + text + value.slice(end);
  emit("update:modelValue", next);
  nextTick(() => {
    el.focus();
    const caretStart = start + (selectStart ?? text.length);
    const caretEnd = start + (selectEnd ?? text.length);
    el.setSelectionRange(caretStart, caretEnd);
  });
}

function wrap(token: string, placeholder: string) {
  replaceSelection((selected) => {
    const inner = selected || placeholder;
    return {
      text: `${token}${inner}${token}`,
      selectStart: token.length,
      selectEnd: token.length + inner.length,
    };
  });
}

function linePrefix(prefix: string, placeholder: string) {
  replaceSelection((selected) => {
    const inner = selected || placeholder;
    return {
      text: `${prefix}${inner}`,
      selectStart: prefix.length,
      selectEnd: prefix.length + inner.length,
    };
  });
}

function insertLink() {
  replaceSelection((selected) => {
    const label = selected || "link text";
    const text = `[${label}](https://)`;
    return { text, selectStart: text.length - 1, selectEnd: text.length - 1 };
  });
}

function insertImageMarkdown(url: string) {
  replaceSelection(() => {
    const text = `![](${url})`;
    return { text, selectStart: 2, selectEnd: 2 };
  });
}

function triggerImagePicker() {
  if (isUploading.value) {
    return;
  }
  fileInput.value?.click();
}

let uploadSeq = 0;

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) {
    return;
  }

  const token = `_(uploading image #${++uploadSeq}…)_`;
  replaceSelection(() => ({
    text: token,
    selectStart: token.length,
    selectEnd: token.length,
  }));

  const url = await upload(file);
  const replacement = url ? `![](${url})` : "";
  emit("update:modelValue", (props.modelValue || "").replace(token, replacement));
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-1">
      <Button type="button" variant="ghost" size="icon" class="h-8 w-8" @click="wrap('**', 'bold text')">
        <Bold class="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" class="h-8 w-8" @click="wrap('*', 'italic text')">
        <Italic class="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" class="h-8 w-8" @click="linePrefix('## ', 'Heading')">
        <Heading2 class="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" class="h-8 w-8" @click="linePrefix('### ', 'Heading')">
        <Heading3 class="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" class="h-8 w-8" @click="linePrefix('- ', 'List item')">
        <List class="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" class="h-8 w-8" @click="linePrefix('> ', 'Quote')">
        <Quote class="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" class="h-8 w-8" @click="wrap('`', 'code')">
        <Code class="h-4 w-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" class="h-8 w-8" @click="insertLink">
        <LinkIcon class="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="h-8 w-8"
        :disabled="isUploading"
        :title="$t('pages.news.form.upload_image')"
        @click="triggerImagePicker"
      >
        <Spinner v-if="isUploading" class="h-4 w-4" />
        <ImageIcon v-else class="h-4 w-4" />
      </Button>
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        :accept="ACCEPT"
        @change="onFileSelected"
      />
    </div>

    <div
      v-if="isUploading"
      class="flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2 text-sm text-[hsl(var(--tac-amber))]"
    >
      <Spinner class="h-4 w-4" />
      {{ $t("pages.news.form.uploading_image") }}
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div class="space-y-1">
        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {{ $t("pages.news.form.write") }}
        </p>
        <textarea
          ref="textarea"
          :value="modelValue"
          class="h-[60vh] min-h-[24rem] w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
      <div class="space-y-1">
        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {{ $t("pages.news.form.preview") }}
        </p>
        <div
          class="news-content h-[60vh] min-h-[24rem] overflow-y-auto rounded-md border border-border/60 bg-card/40 p-3"
          v-html="rendered"
        />
      </div>
    </div>
  </div>
</template>
