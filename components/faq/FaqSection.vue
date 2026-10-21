<script setup lang="ts">
import { computed, inject } from "vue";
import { Link2 } from "lucide-vue-next";
import { FAQ_CONTEXT } from "~/components/faq/faqContext";
import { faqSectionOf } from "~/composables/useFaq";

const props = defineProps<{ id: string }>();

const faq = inject(FAQ_CONTEXT)!;

const section = computed(
  () => faqSectionOf(faq.outline.value, props.id)?.section ?? null,
);
const shown = computed(() => !faq.only.value || faq.only.value === props.id);
</script>

<template>
  <section
    v-if="shown && section"
    :id="id"
    class="group/section scroll-mt-6"
    :class="
      faq.only.value
        ? ''
        : 'rounded-xl border border-border/60 bg-card/20 [backdrop-filter:blur(2px)]'
    "
  >
    <header
      class="flex flex-col gap-1"
      :class="faq.only.value ? 'pb-4' : 'px-5 pb-4 pt-5 sm:px-6'"
    >
      <h3
        class="flex items-center gap-2 text-lg font-bold tracking-tight sm:text-xl"
      >
        {{ section.title }}
        <a
          v-if="!faq.only.value"
          :href="`#${id}`"
          class="text-muted-foreground/0 transition-colors duration-150 hover:text-[hsl(var(--tac-amber))] focus-visible:text-muted-foreground group-hover/section:text-muted-foreground/60"
          :aria-label="$t('faq.link_to', { title: section.title })"
        >
          <Link2 class="size-4" />
        </a>
      </h3>
      <p v-if="section.lede" class="max-w-2xl text-sm text-muted-foreground">
        {{ section.lede }}
      </p>
    </header>
    <div
      class="flex flex-col gap-6"
      :class="faq.only.value ? '' : 'px-5 pb-6 sm:px-6'"
    >
      <slot />
    </div>
  </section>
</template>
