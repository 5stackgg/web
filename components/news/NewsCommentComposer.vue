<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { NEWS_COMMENT_MAX_LENGTH } from "~/utilities/newsComments";

const props = withDefaults(
  defineProps<{
    send: (body: string) => Promise<boolean>;
    submitLabel: string;
    initial?: string;
    placeholder?: string;
    hint?: string | null;
    autofocus?: boolean;
    cancellable?: boolean;
  }>(),
  {
    initial: "",
    placeholder: "",
    hint: null,
    autofocus: false,
    cancellable: true,
  },
);

const emit = defineEmits<{ cancel: [] }>();

const text = ref(props.initial);
const sending = ref(false);
const root = ref<HTMLElement | null>(null);

const trimmed = computed(() => text.value.trim());
const remaining = computed(() => NEWS_COMMENT_MAX_LENGTH - text.value.length);
const canSubmit = computed(
  () =>
    trimmed.value.length > 0 &&
    remaining.value >= 0 &&
    trimmed.value !== props.initial.trim(),
);

async function submit() {
  if (!canSubmit.value || sending.value) {
    return;
  }
  sending.value = true;
  try {
    if (await props.send(trimmed.value)) {
      text.value = "";
    }
  } finally {
    sending.value = false;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    void submit();
    return;
  }
  if (event.key === "Escape" && props.cancellable) {
    event.preventDefault();
    emit("cancel");
  }
}

onMounted(() => {
  if (props.autofocus) {
    root.value?.querySelector("textarea")?.focus();
  }
});
</script>

<template>
  <div ref="root" class="grid gap-2">
    <Textarea
      v-model="text"
      :placeholder="placeholder"
      :maxlength="NEWS_COMMENT_MAX_LENGTH"
      :aria-label="placeholder || submitLabel"
      class="min-h-[60px] resize-y text-base sm:text-sm"
      data-testid="news-comment-input"
      @keydown="onKeydown"
    />
    <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span
        class="font-mono text-[0.6rem] uppercase tracking-[0.14em] tabular-nums"
        :class="
          remaining < 200
            ? 'text-[hsl(var(--tac-amber))]'
            : 'text-muted-foreground/70'
        "
      >
        {{
          remaining < 200
            ? $t("pages.news.comments.characters_left", { count: remaining })
            : hint
        }}
      </span>
      <span class="ml-auto flex gap-2">
        <Button
          v-if="cancellable"
          type="button"
          size="sm"
          variant="ghost"
          @click="emit('cancel')"
        >
          {{ $t("common.cancel") }}
        </Button>
        <Button
          type="button"
          size="sm"
          :loading="sending"
          :disabled="!canSubmit"
          data-testid="news-comment-submit"
          @click="submit"
        >
          {{ submitLabel }}
        </Button>
      </span>
    </div>
  </div>
</template>
