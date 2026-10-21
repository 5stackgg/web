<script setup lang="ts">
import { Card, CardContent } from "~/components/ui/card";

type LegalSection = {
  id: string;
  title: string;
  body?: string[];
  items?: string[];
  after?: string[];
};

defineProps<{
  intro: string;
  sections: LegalSection[];
}>();

const { locale } = useI18n();

const paragraphClasses = "text-sm leading-relaxed text-foreground/85";

const bullets =
  "flex flex-col gap-2 text-sm leading-relaxed text-foreground/85 [&>li]:relative [&>li]:pl-4 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.6em] [&>li]:before:h-px [&>li]:before:w-2 [&>li]:before:bg-[hsl(var(--tac-amber)/0.7)]";
</script>

<template>
  <Card class="bg-card/20">
    <CardContent class="p-4 sm:p-8">
      <article class="flex max-w-3xl flex-col gap-8">
        <div class="flex flex-col gap-3">
          <p class="text-[0.95rem] leading-relaxed text-foreground/90">
            {{ intro }}
          </p>
          <p v-if="locale !== 'en'" class="text-xs text-muted-foreground">
            {{ $t("legal.translation_note") }}
          </p>
        </div>

        <section
          v-for="(section, index) of sections"
          :id="section.id"
          :key="section.id"
          class="flex scroll-mt-6 flex-col gap-3"
        >
          <h2
            class="flex items-baseline gap-3 text-base font-semibold text-foreground"
          >
            <span
              class="font-mono text-xs tabular-nums text-[hsl(var(--tac-amber))]"
            >
              {{ String(index + 1).padStart(2, "0") }}
            </span>
            {{ section.title }}
          </h2>
          <p
            v-for="paragraph of section.body"
            :key="paragraph"
            :class="paragraphClasses"
          >
            {{ paragraph }}
          </p>
          <ul v-if="section.items?.length" :class="bullets">
            <li v-for="item of section.items" :key="item">{{ item }}</li>
          </ul>
          <p
            v-for="paragraph of section.after"
            :key="paragraph"
            :class="paragraphClasses"
          >
            {{ paragraph }}
          </p>
        </section>
      </article>
    </CardContent>
  </Card>
</template>
