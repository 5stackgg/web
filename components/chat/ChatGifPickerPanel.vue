<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { usePreferredReducedMotion } from "@vueuse/core";
import { Search } from "lucide-vue-next";
import { Input } from "@/components/ui/input";
import FadeImage from "~/components/media/FadeImage.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import debounce from "~/utilities/debounce";
import {
  chatGifUrl,
  type ChatGif,
  type ChatGifResult,
} from "~/utilities/chatAttachments";
import {
  searchChatGifs,
  type ChatGifSearch,
} from "~/composables/chatGifSearch";

// No withDefaults: a function-typed prop takes its default as the value, not
// as a factory, so `() => searchChatGifs` handed back the function itself and
// every search read as "unavailable".
const props = defineProps<{ search?: ChatGifSearch; initialQuery?: string }>();

const emit = defineEmits<{ select: [gif: ChatGif] }>();

const SUGGESTIONS = ["gg", "clutch", "rage"] as const;

const { t } = useI18n();

const query = ref(props.initialQuery ?? "");
const active = ref("");
const results = ref<ChatGifResult[]>([]);
const next = ref<number | null>(null);
const state = ref<
  "loading" | "ready" | "empty" | "rate_limited" | "busy" | "unavailable"
>("loading");
const motion = usePreferredReducedMotion();
const still = computed(() => motion.value === "reduce");

// Each GIF goes to whichever column is shorter and stays there: CSS columns
// rebalance the whole grid as it grows, moving GIFs out from under the pointer.
const columns = ref<[ChatGifResult[], ChatGifResult[]]>([[], []]);
let columnHeights: [number, number] = [0, 0];

function place(gifs: ChatGifResult[], reset: boolean) {
  if (reset) {
    columns.value = [[], []];
    columnHeights = [0, 0];
  }

  for (const gif of gifs) {
    const column = columnHeights[0] <= columnHeights[1] ? 0 : 1;

    columns.value[column].push(gif);
    columnHeights[column] += gif.height / gif.width;
  }
}
const loadingMore = ref(false);
const input = ref<{ $el?: HTMLInputElement } | HTMLInputElement | null>(null);

// A slower answer to an older search must not land over a newer one.
let generation = 0;

async function load(term: string, offset: number) {
  const mine = offset === 0 ? ++generation : generation;

  if (offset === 0) {
    active.value = term;
    state.value = "loading";
  } else {
    loadingMore.value = true;
  }

  const page = await (props.search ?? searchChatGifs)(term, offset);

  if (mine !== generation) {
    return;
  }

  loadingMore.value = false;

  if (typeof page === "string" || !Array.isArray(page?.results)) {
    if (offset === 0) {
      results.value = [];
      place([], true);
      next.value = null;
      state.value =
        page === "rate_limited" || page === "busy" ? page : "unavailable";
    }
    return;
  }

  const fresh =
    offset === 0
      ? page.results
      : page.results.filter(
          ({ id }) => !results.value.some((result) => result.id === id),
        );

  results.value = offset === 0 ? fresh : [...results.value, ...fresh];
  place(fresh, offset === 0);
  next.value = page.next;
  state.value = results.value.length > 0 ? "ready" : "empty";
}

const searchSoon = debounce((term: string) => {
  void load(term, 0);
}, 300);

function onInput(value: string | number) {
  query.value = String(value);
  searchSoon(query.value.trim());
}

function pick(term: string) {
  searchSoon.cancel();
  query.value = term;
  void load(term, 0);
}

function onScroll(event: Event) {
  const element = event.target as HTMLElement;

  if (
    next.value === null ||
    loadingMore.value ||
    state.value !== "ready" ||
    element.scrollTop + element.clientHeight < element.scrollHeight - 120
  ) {
    return;
  }

  void load(active.value, next.value);
}

function select(gif: ChatGifResult) {
  emit("select", { id: gif.id, width: gif.width, height: gif.height });
}

const chips = computed(() => [
  { key: "trending", term: "", label: t("chat.gifs.trending") },
  ...SUGGESTIONS.map((key) => ({
    key,
    term: t(`chat.gifs.suggestions.${key}`),
    label: t(`chat.gifs.suggestions.${key}`),
  })),
]);

const message = computed(() => {
  switch (state.value) {
    case "empty":
      return t("chat.gifs.empty");
    case "rate_limited":
      return t("chat.gifs.rate_limited");
    case "busy":
      return t("chat.gifs.busy");
    case "unavailable":
      return t("chat.gifs.unavailable");
    default:
      return "";
  }
});

onMounted(() => {
  void load(query.value.trim(), 0);

  const element =
    input.value && "$el" in input.value ? input.value.$el : input.value;
  (element as HTMLInputElement | null | undefined)?.focus?.();
});

onBeforeUnmount(() => {
  searchSoon.cancel();
});
</script>

<template>
  <div class="flex w-80 max-w-[calc(100vw-2rem)] flex-col">
    <div class="flex items-center gap-2 border-b border-border p-2">
      <div class="relative flex-1">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref="input"
          :model-value="query"
          type="search"
          class="h-8 pl-8 text-sm"
          :placeholder="$t('chat.gifs.search')"
          :aria-label="$t('chat.gifs.search')"
          @update:model-value="onInput"
        />
      </div>
    </div>

    <div class="flex flex-wrap gap-1 px-2 pt-2">
      <button
        v-for="chip in chips"
        :key="chip.key"
        type="button"
        :data-gif-suggestion="chip.key"
        class="rounded-sm px-2 py-1 font-mono text-[0.55rem] font-bold uppercase tracking-[0.14em] transition-colors duration-150 motion-reduce:transition-none"
        :class="
          active === chip.term
            ? 'bg-[hsl(var(--tac-amber)/0.16)] text-[hsl(var(--tac-amber))] ring-1 ring-inset ring-[hsl(var(--tac-amber)/0.55)]'
            : 'text-muted-foreground hover:text-foreground'
        "
        @click="pick(chip.term)"
      >
        {{ chip.label }}
      </button>
    </div>

    <div
      data-gif-scroll
      class="h-72 overflow-y-auto p-2"
      @scroll.passive="onScroll"
    >
      <FadeSwap>
        <div
          v-if="state === 'loading'"
          key="loading"
          class="columns-2 gap-1.5 [&>div]:mb-1.5"
        >
          <div
            v-for="index in 6"
            :key="index"
            class="animate-pulse rounded-md bg-muted/40 motion-reduce:animate-none"
            :class="index % 3 === 0 ? 'aspect-square' : 'aspect-[4/3]'"
          ></div>
        </div>
        <div
          v-else-if="state === 'ready'"
          :key="`results:${active}`"
          class="grid grid-cols-2 items-start gap-1.5"
        >
          <div
            v-for="(column, index) in columns"
            :key="index"
            data-gif-column
            class="flex flex-col gap-1.5"
          >
            <button
              v-for="gif in column"
              :key="gif.id"
              type="button"
              :data-gif-id="gif.id"
              class="group/gif relative block w-full overflow-hidden rounded-md ring-[hsl(var(--tac-amber))] transition-shadow duration-150 hover:ring-2 focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none"
              :style="{ aspectRatio: `${gif.width} / ${gif.height}` }"
              :aria-label="gif.title || $t('chat.gifs.label')"
              @click="select(gif)"
            >
              <FadeImage
                :src="chatGifUrl(gif.id, 'preview', still)"
                :alt="gif.title"
              />
              <span
                class="pointer-events-none absolute bottom-1 right-1 rounded-sm bg-black/70 px-1 py-0.5 font-mono text-[0.5rem] font-bold uppercase tracking-wider text-[hsl(var(--tac-amber))] opacity-0 transition-opacity duration-150 group-hover/gif:opacity-100 group-focus-visible/gif:opacity-100 motion-reduce:transition-none"
              >
                {{ $t("chat.gifs.click_to_send") }}
              </span>
            </button>
          </div>
        </div>
        <p
          v-else
          :key="state"
          class="px-2 py-10 text-center text-xs text-muted-foreground"
        >
          {{ message }}
        </p>
      </FadeSwap>
    </div>

    <p
      class="border-t border-border px-2.5 py-1.5 text-right font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
    >
      {{ $t("chat.gifs.powered_by") }}
    </p>
  </div>
</template>
