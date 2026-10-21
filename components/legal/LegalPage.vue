<script setup lang="ts">
import { computed } from "vue";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { dateLocale } from "~/utilities/dateLocale";

const props = defineProps<{
  title: string;
  updated?: string;
}>();

useHead({ title: () => props.title });

const links = [
  { name: "terms", label: "legal.terms.title" },
  { name: "privacy", label: "legal.privacy.title" },
  { name: "licenses", label: "licenses.title" },
];

const linkClasses =
  "inline-flex items-center rounded-md border border-border/70 bg-background/40 px-2.5 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:text-[hsl(var(--tac-amber))] [&.router-link-active]:border-[hsl(var(--tac-amber)/0.5)] [&.router-link-active]:bg-[hsl(var(--tac-amber)/0.08)] [&.router-link-active]:text-[hsl(var(--tac-amber))]";

const updatedLabel = computed(() =>
  props.updated
    ? new Date(`${props.updated}T00:00:00`).toLocaleDateString(dateLocale(), {
        dateStyle: "long",
      })
    : null,
);
</script>

<template>
  <PageTransition>
    <div class="mx-auto flex w-full max-w-[74rem] flex-col gap-6 pb-12">
      <TacticalPageHeader>
        <template #description>{{ $t("legal.section") }}</template>
        <template #title>{{ title }}</template>
        <template v-if="updatedLabel" #subtitle>
          {{ $t("legal.updated", { date: updatedLabel }) }}
        </template>
        <template #actions>
          <nav class="flex items-center gap-2">
            <NuxtLink
              v-for="link of links"
              :key="link.name"
              :to="{ name: link.name }"
              :class="linkClasses"
            >
              {{ $t(link.label) }}
            </NuxtLink>
          </nav>
        </template>
      </TacticalPageHeader>

      <slot />
    </div>
  </PageTransition>
</template>
