<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useMediaQuery } from "@vueuse/core";
import { ChevronDown, Search, X } from "lucide-vue-next";
import { Input } from "~/components/ui/input";
import { Fold } from "~/components/ui/transitions";
import type { FaqPart } from "~/composables/useFaq";
import { useFaqSearch } from "~/composables/useFaq";

const props = defineProps<{ parts: FaqPart[] }>();

const emit = defineEmits<{ go: [string] }>();

const { search } = useFaqSearch();
const query = ref("");
const contentsOpen = ref(false);
const isDesktop = useMediaQuery("(min-width: 1024px)");
const hits = computed(() => search(query.value, 8));

const sections = computed(() => props.parts.flatMap((part) => part.sections));
const active = ref<{ section: string; sub: string | null }>({
  section: "",
  sub: null,
});

const LINE = 140;
let travelling = false;
let settle: ReturnType<typeof setTimeout> | undefined;
let frame = 0;

function read() {
  frame = 0;
  if (travelling) {
    return;
  }
  let section = sections.value[0]?.id ?? "";
  let sub: string | null = null;
  for (const candidate of sections.value) {
    const element = document.getElementById(candidate.id);
    if (element && element.getBoundingClientRect().top <= LINE) {
      section = candidate.id;
      sub = null;
      for (const child of candidate.subs ?? []) {
        const subElement = document.getElementById(child.id);
        if (subElement && subElement.getBoundingClientRect().top <= LINE) {
          sub = child.id;
        }
      }
    }
  }
  active.value = { section, sub };
}

function onScroll() {
  if (travelling) {
    clearTimeout(settle);
    settle = setTimeout(() => {
      travelling = false;
      read();
    }, 140);
    return;
  }
  if (!frame) {
    frame = requestAnimationFrame(read);
  }
}

function stopTravelling() {
  travelling = false;
}

onMounted(() => {
  document.addEventListener("scroll", onScroll, {
    capture: true,
    passive: true,
  });
  window.addEventListener("wheel", stopTravelling, { passive: true });
  window.addEventListener("touchstart", stopTravelling, { passive: true });
  read();
});

onBeforeUnmount(() => {
  document.removeEventListener("scroll", onScroll, { capture: true });
  window.removeEventListener("wheel", stopTravelling);
  window.removeEventListener("touchstart", stopTravelling);
  cancelAnimationFrame(frame);
  clearTimeout(settle);
});

function owner(anchor: string) {
  for (const section of sections.value) {
    if (section.id === anchor) {
      return { section: section.id, sub: null };
    }
    if (section.subs?.some((sub) => sub.id === anchor)) {
      return { section: section.id, sub: anchor };
    }
  }
  return null;
}

function go(anchor: string) {
  const where = owner(anchor);
  if (where) {
    active.value = where;
  }
  travelling = true;
  clearTimeout(settle);
  settle = setTimeout(() => {
    travelling = false;
    read();
  }, 900);
  query.value = "";
  contentsOpen.value = false;
  emit("go", anchor);
}

const list = ref<HTMLElement | null>(null);
const marker = ref({ top: 0, height: 0, visible: false });

async function placeMarker() {
  await nextTick();
  const row = list.value?.querySelector<HTMLElement>(
    `[data-faq-row="${active.value.section}"]`,
  );
  if (!row || !list.value) {
    marker.value = { ...marker.value, visible: false };
    return;
  }
  marker.value = {
    top: row.offsetTop,
    height: row.offsetHeight,
    visible: true,
  };
}

watch(() => active.value.section, placeMarker);

let listObserver: ResizeObserver | undefined;
watch(list, (element) => {
  listObserver?.disconnect();
  if (element && typeof ResizeObserver !== "undefined") {
    listObserver = new ResizeObserver(() => void placeMarker());
    listObserver.observe(element);
  }
});
onBeforeUnmount(() => listObserver?.disconnect());

function onEnter(event: KeyboardEvent) {
  const first = hits.value[0];
  if (event.key === "Enter" && first) {
    event.preventDefault();
    go(first.id);
  }
}
</script>

<template>
  <nav class="flex flex-col gap-4" :aria-label="$t('faq.contents')">
    <div class="relative">
      <Search
        class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        v-model="query"
        type="search"
        class="pl-9 pr-8"
        :placeholder="$t('faq.search_placeholder')"
        :aria-label="$t('faq.search_placeholder')"
        @keydown="onEnter"
      />
      <button
        v-if="query"
        type="button"
        class="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
        :aria-label="$t('common.clear')"
        @click="query = ''"
      >
        <X class="size-3.5" />
      </button>
    </div>

    <div v-if="query.trim()" class="flex flex-col gap-1">
      <span
        class="px-2 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("faq.search_results", { count: hits.length }) }}
      </span>
      <TransitionGroup
        tag="ul"
        class="flex flex-col"
        enter-active-class="transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none"
        enter-from-class="opacity-0 -translate-y-0.5"
      >
        <li v-for="hit in hits" :key="hit.id">
          <a
            :href="`#${hit.id}`"
            class="flex flex-col gap-0.5 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
            @click.prevent="go(hit.id)"
          >
            <span class="text-sm font-medium leading-snug">{{
              hit.title
            }}</span>
            <span class="text-[0.7rem] text-muted-foreground">{{
              hit.part
            }}</span>
          </a>
        </li>
      </TransitionGroup>
      <p v-if="!hits.length" class="px-2 text-xs text-muted-foreground">
        {{ $t("faq.no_results", { term: query }) }}
      </p>
    </div>

    <template v-else>
      <button
        type="button"
        class="flex items-center justify-between rounded-md border border-border/70 bg-background/40 px-3 py-2 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:hidden"
        :aria-expanded="contentsOpen"
        @click="contentsOpen = !contentsOpen"
      >
        {{ $t("faq.contents") }}
        <ChevronDown
          class="size-3.5 transition-transform duration-200 motion-reduce:transition-none"
          :class="contentsOpen && 'rotate-180'"
        />
      </button>
      <div
        class="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none lg:grid-rows-[1fr]"
        :class="contentsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
      >
        <div
          class="min-h-0 overflow-hidden lg:overflow-visible"
          :inert="!contentsOpen && !isDesktop"
        >
          <div ref="list" class="relative flex flex-col">
            <span
              aria-hidden="true"
              class="absolute left-0 w-0.5 rounded bg-[hsl(var(--tac-amber))] transition-[top,height,opacity] duration-300 ease-out motion-reduce:transition-none"
              :style="{
                top: `${marker.top}px`,
                height: `${marker.height}px`,
                opacity: marker.visible ? 1 : 0,
              }"
            />
            <template v-for="(part, index) in parts" :key="part.id">
              <span
                class="flex items-center gap-2 px-3 pb-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                :class="index > 0 && 'pt-4'"
              >
                <span class="tabular-nums text-muted-foreground/60">{{
                  String(index + 1).padStart(2, "0")
                }}</span>
                {{ part.title }}
              </span>
              <div
                v-for="section in part.sections"
                :key="section.id"
                class="flex flex-col"
              >
                <a
                  :href="`#${section.id}`"
                  :data-faq-row="section.id"
                  class="border-l border-border/60 py-1.5 pl-3 pr-2 text-[0.8rem] leading-snug transition-colors duration-150"
                  :class="
                    active.section === section.id
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  :aria-current="
                    active.section === section.id ? 'location' : undefined
                  "
                  @click.prevent="go(section.id)"
                >
                  {{ section.title }}
                </a>
                <Fold
                  :open="
                    !!section.subs?.length && active.section === section.id
                  "
                >
                  <div class="flex flex-col border-l border-border/60 pb-1">
                    <a
                      v-for="sub in section.subs"
                      :key="sub.id"
                      :href="`#${sub.id}`"
                      class="py-1 pl-6 pr-2 text-[0.74rem] leading-snug transition-colors duration-150"
                      :class="
                        active.sub === sub.id
                          ? 'text-[hsl(var(--tac-amber))]'
                          : 'text-muted-foreground/80 hover:text-foreground'
                      "
                      @click.prevent="go(sub.id)"
                    >
                      {{ sub.title }}
                    </a>
                  </div>
                </Fold>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </nav>
</template>
