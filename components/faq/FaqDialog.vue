<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from "vue";
import { ArrowUpRight } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  faqSectionOf,
  useFaqDialog,
  useFaqOutline,
} from "~/composables/useFaq";

const FaqContent = defineAsyncComponent(
  () => import("~/components/faq/FaqContent.vue"),
);

const { anchor, open, close } = useFaqDialog();
const outline = useFaqOutline();

const shown = ref<string | null>(null);
watch(
  anchor,
  (value) => {
    if (value) {
      shown.value = value;
    }
  },
  { immediate: true },
);

const found = computed(() =>
  shown.value ? faqSectionOf(outline.value, shown.value) : null,
);

const body = ref<HTMLElement | null>(null);
const ready = ref(false);

async function reveal(target: string) {
  if (!ready.value) {
    return;
  }
  await nextTick();
  const element = body.value?.querySelector<HTMLElement>(
    `#${CSS.escape(target)}`,
  );
  if (!element || found.value?.section.id === target) {
    body.value?.scrollTo({ top: 0 });
    return;
  }
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function onReady() {
  ready.value = true;
  if (anchor.value) {
    void reveal(anchor.value);
  }
}

watch(anchor, (value) => {
  if (value) {
    void reveal(value);
  }
});

const route = useRoute();
watch(
  () => route.fullPath,
  () => close(),
);

const isOpen = computed({
  get: () => anchor.value !== null,
  set: (value: boolean) => {
    if (!value) {
      close();
    }
  },
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent
      class="flex max-h-[85svh] max-w-3xl flex-col gap-0 overflow-hidden p-0"
    >
      <DialogHeader class="border-b border-border/60 px-6 pb-4 pt-5 text-left">
        <span
          class="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--tac-amber))]"
        >
          {{ $t("faq.title")
          }}<template v-if="found"> · {{ found.part.title }}</template>
        </span>
        <DialogTitle class="text-xl">{{ found?.section.title }}</DialogTitle>
        <DialogDescription v-if="found?.section.lede">
          {{ found.section.lede }}
        </DialogDescription>
        <NuxtLink
          v-if="shown"
          :to="`/faq#${shown}`"
          class="mt-1 inline-flex w-fit items-center gap-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-[hsl(var(--tac-amber))]"
          @click="close()"
        >
          {{ $t("faq.open_full") }}
          <ArrowUpRight class="size-3" />
        </NuxtLink>
      </DialogHeader>
      <div
        ref="body"
        class="faq-dialog-body min-h-0 flex-1 overflow-y-auto px-6 py-5"
      >
        <FaqContent
          v-if="found"
          :only="found.section.id"
          :go="open"
          @ready="onReady"
          class="[&_section>header]:hidden"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
