<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import socket, { type ChatType, type LobbyMessage } from "~/web-sockets/Socket";
import { chatEnterAction } from "~/utilities/chatInputKeys";
import { toastChatError, type ChatError } from "~/utilities/chatErrors";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_REMAINING_HINT_AT,
} from "~/constants/chat";

const props = defineProps<{
  message: LobbyMessage;
  room: { type: ChatType; id: string };
}>();

const emit = defineEmits<{
  close: [];
}>();

const draft = ref(props.message.message ?? "");
const saving = ref(false);
const formRef = ref<HTMLFormElement | null>(null);
const inputRef = ref<{ $el?: HTMLTextAreaElement } | null>(null);

const text = computed(() => draft.value.trim());
const remainingCharacters = computed(
  () => CHAT_MESSAGE_MAX_LENGTH - text.value.length,
);
const showRemaining = computed(
  () => remainingCharacters.value <= CHAT_REMAINING_HINT_AT,
);

function field() {
  return inputRef.value?.$el ?? null;
}

function growToFit() {
  const element = field();

  if (!element) {
    return;
  }

  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
}

watch(draft, () => {
  void nextTick(growToFit);
});

onMounted(() => {
  void nextTick(() => {
    const element = field();

    if (!element) {
      return;
    }

    growToFit();
    element.focus({ preventScroll: true });
    element.setSelectionRange(element.value.length, element.value.length);
    formRef.value?.scrollIntoView?.({ block: "nearest" });
  });
});

function onEnter(event: KeyboardEvent) {
  if (chatEnterAction(event) === "newline") {
    return;
  }

  event.preventDefault();
  void save();
}

// Not while saving: closing would leave the edit to land, or fail, unseen.
function onEscape(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (!saving.value) {
    emit("close");
  }
}

async function save() {
  if (saving.value || !text.value || !props.message.id) {
    return;
  }

  if (text.value.length > CHAT_MESSAGE_MAX_LENGTH) {
    toastChatError({
      code: "too_long",
      action: "edit",
      max: CHAT_MESSAGE_MAX_LENGTH,
    });
    return;
  }

  if (text.value === props.message.message) {
    emit("close");
    return;
  }

  saving.value = true;

  try {
    await socket.editMessage(
      props.room.type,
      props.room.id,
      props.message.id,
      text.value,
    );
    emit("close");
  } catch (error) {
    const code = (error as ChatError)?.code;

    toastChatError(error as ChatError);

    if (
      code === "window_closed" ||
      code === "not_found" ||
      code === "not_allowed" ||
      code === "gagged"
    ) {
      emit("close");
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form ref="formRef" class="mt-0.5" @submit.prevent="save">
    <div
      class="rounded-md border border-border/60 bg-background transition-[border-color,box-shadow] duration-150 focus-within:ring-1 focus-within:ring-ring motion-reduce:transition-none"
    >
      <Textarea
        ref="inputRef"
        v-model="draft"
        rows="1"
        :aria-label="$t('chat.edit_message')"
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
        data-form-type="other"
        class="min-h-0 resize-none border-0 px-2 py-1 text-[13px] leading-snug shadow-none focus-visible:ring-0"
        @keydown.enter="onEnter"
        @keydown.esc="onEscape"
      />
    </div>
    <div class="mt-1 flex items-center gap-1.5">
      <span
        class="min-w-0 flex-1 truncate text-[10px] text-muted-foreground/70 [@media(hover:none)]:invisible"
      >
        {{ $t("chat.edit_hint") }}
      </span>
      <span
        v-if="showRemaining"
        class="shrink-0 font-mono text-[0.6rem] tabular-nums leading-none"
        :class="
          remainingCharacters < 0
            ? 'text-destructive'
            : 'text-muted-foreground/70'
        "
      >
        {{ remainingCharacters }}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        class="h-6 px-2 text-[10px]"
        :disabled="saving"
        @click="emit('close')"
      >
        {{ $t("common.cancel") }}
      </Button>
      <Button
        type="submit"
        size="xs"
        class="h-6 px-2 text-[10px]"
        :loading="saving"
        :min-loading-ms="0"
        :disabled="!text"
      >
        {{ $t("common.save") }}
      </Button>
    </div>
  </form>
</template>
