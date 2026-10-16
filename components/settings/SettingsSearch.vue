<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import { Search, X } from "lucide-vue-next";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import {
  useSettingsSearch,
  type SettingsSearchHit,
} from "~/composables/useSettingsSearch";

type Option = {
  id: string;
  path: string;
  label?: string;
  hit?: SettingsSearchHit;
};

const query = ref("");
const { search, select } = useSettingsSearch();

const searching = computed(() => query.value.trim().length > 0);

// Each page heading followed by its settings: the order the arrow keys walk.
const options = computed<Option[]>(() =>
  searching.value
    ? search(query.value).flatMap((group) => [
        { id: group.path, path: group.path, label: group.label },
        ...group.hits.map((hit) => ({ id: hit.id, path: hit.path, hit })),
      ])
    : [],
);

const active = ref(0);
watch(query, () => (active.value = 0));

const desktop = useMediaQuery("(min-width: 1024px)");

function choose(option: Option) {
  select(option.hit);
  // On a phone the results sit above the page they open, and the keyboard
  // over it, so both go.
  if (!desktop.value) {
    query.value = "";
    (document.activeElement as HTMLElement | null)?.blur();
  }
}

function onKeydown(event: KeyboardEvent) {
  const last = options.value.length - 1;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    active.value = Math.min(
      Math.max(active.value + (event.key === "ArrowDown" ? 1 : -1), 0),
      last,
    );
    document
      .getElementById(`settings-search-option-${active.value}`)
      ?.scrollIntoView({ block: "nearest" });
  } else if (event.key === "Enter" && options.value[active.value]) {
    event.preventDefault();
    const option = options.value[active.value];
    choose(option);
    navigateTo(option.path);
  } else if (event.key === "Escape" && query.value) {
    event.preventDefault();
    query.value = "";
  }
}
</script>

<template>
  <!-- The rail takes the nav's width. The input and results fill it without
       adding any of their own (w-0 + min-w-full), and the nav stays laid out
       while hidden, so the content beside the rail never shifts. -->
  <div class="flex flex-col gap-4">
    <InputGroup class="h-8 shrink-0 bg-card/60 lg:w-0 lg:min-w-full">
      <InputGroupAddon class="pl-2.5">
        <Search class="h-3.5 w-3.5" />
      </InputGroupAddon>
      <InputGroupInput
        v-model="query"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="settings-search-results"
        :aria-expanded="searching"
        :aria-activedescendant="
          options.length ? `settings-search-option-${active}` : undefined
        "
        :aria-label="$t('layouts.application_settings.search_placeholder')"
        :placeholder="$t('layouts.application_settings.search_placeholder')"
        class="h-full text-sm"
        @keydown="onKeydown"
      />
      <InputGroupAddon align="inline-end" class="pr-2">
        <button
          v-if="query"
          type="button"
          :aria-label="$t('common.clear')"
          class="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          @click="query = ''"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </InputGroupAddon>
    </InputGroup>

    <div class="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain">
      <div
        v-if="searching"
        id="settings-search-results"
        role="listbox"
        class="flex min-w-full flex-col lg:w-0"
      >
        <p v-if="!options.length" class="px-3 py-1.5 text-sm text-muted-foreground">
          {{ $t("layouts.application_settings.search_empty") }}
        </p>
        <NuxtLink
          v-for="(option, index) in options"
          :id="`settings-search-option-${index}`"
          :key="option.id"
          :to="option.path"
          role="option"
          :aria-selected="index === active"
          class="rounded-md text-left transition-colors duration-200"
          :class="[
            option.hit
              ? 'ml-3 rounded-l-none border-l border-border/70 py-1.5 pl-3 pr-2'
              : 'px-3 py-1.5 text-sm font-medium text-foreground [&:not(:first-child)]:mt-3',
            index === active && 'bg-[hsl(var(--tac-amber)/0.08)]',
          ]"
          @click="choose(option)"
          @mousemove="active = index"
        >
          <template v-if="option.hit">
            <span class="block text-sm text-foreground">
              {{ option.hit.label }}
            </span>
            <span
              v-if="option.hit.description"
              class="mt-0.5 line-clamp-2 text-xs text-muted-foreground"
            >
              {{ option.hit.description }}
            </span>
          </template>
          <template v-else>{{ option.label }}</template>
        </NuxtLink>
      </div>
      <div :class="searching ? 'invisible h-0 overflow-hidden' : 'lg:h-full'">
        <slot />
      </div>
    </div>
  </div>
</template>
