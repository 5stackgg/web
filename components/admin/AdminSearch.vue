<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { Search, X } from "lucide-vue-next";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";

// The admin control row's search: always visible, clears with × or Esc.
// `shortcut` lets "/" focus it from anywhere on the page.
const model = defineModel<string>({ default: "" });

const props = withDefaults(
  defineProps<{
    placeholder: string;
    /** Accessible name when it should differ from the placeholder. */
    label?: string;
    shortcut?: boolean;
  }>(),
  { shortcut: false },
);

const group = ref<{ $el?: HTMLElement } | null>(null);
const input = () => group.value?.$el?.querySelector("input") ?? null;

function focus() {
  input()?.focus();
  input()?.select();
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") {
    return;
  }
  if (model.value) {
    event.preventDefault();
    event.stopPropagation();
    model.value = "";
    return;
  }
  input()?.blur();
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (
    event.key !== "/" ||
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey
  ) {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
      target.isContentEditable)
  ) {
    return;
  }
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
    return;
  }
  event.preventDefault();
  focus();
}

onMounted(() => {
  if (props.shortcut) {
    document.addEventListener("keydown", onDocumentKeydown);
  }
});
onBeforeUnmount(() =>
  document.removeEventListener("keydown", onDocumentKeydown),
);

defineExpose({ focus });
</script>

<template>
  <InputGroup
    ref="group"
    class="h-8 min-w-[12rem] flex-1 bg-card/60 sm:max-w-[18rem]"
  >
    <InputGroupAddon class="pl-2.5">
      <Search class="size-3.5" />
    </InputGroupAddon>
    <InputGroupInput
      v-model="model"
      type="text"
      autocomplete="off"
      spellcheck="false"
      :placeholder="props.placeholder"
      :aria-label="props.label ?? props.placeholder"
      :aria-keyshortcuts="props.shortcut ? '/' : undefined"
      class="h-full text-sm max-md:text-base"
      @keydown="onInputKeydown"
    />
    <InputGroupAddon v-if="model" align="inline-end" class="pr-2">
      <button
        type="button"
        class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :aria-label="$t('admin.search.clear')"
        @click="
          model = '';
          focus();
        "
      >
        <X class="size-3.5" />
      </button>
    </InputGroupAddon>
    <InputGroupAddon
      v-else-if="props.shortcut"
      align="inline-end"
      class="pointer-events-none pr-2"
      aria-hidden="true"
    >
      <span
        class="inline-grid h-[18px] min-w-[18px] place-items-center rounded border border-border px-1 font-mono text-[10.5px] text-muted-foreground"
        >/</span
      >
    </InputGroupAddon>
  </InputGroup>
</template>
