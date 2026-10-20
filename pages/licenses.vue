<script setup lang="ts">
import { ArrowUpRight } from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Card, CardContent } from "~/components/ui/card";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";

const linkClasses =
  "inline-flex w-fit items-center gap-1.5 rounded-md border border-border/70 bg-background/40 px-2 py-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-[hsl(var(--tac-amber))]";
</script>

<template>
  <PageTransition>
    <div class="mx-auto flex w-full max-w-[74rem] flex-col gap-6 pb-12">
      <TacticalPageHeader>
        <template #title>{{ $t("licenses.title") }}</template>
      </TacticalPageHeader>

      <Card class="bg-card/20">
        <CardContent class="flex flex-col gap-4 p-4 sm:p-6">
          <a
            href="https://5stack.gg"
            target="_blank"
            rel="noopener noreferrer"
            class="w-fit text-lg font-semibold text-foreground transition-colors hover:text-[hsl(var(--tac-amber))]"
          >
            Powered by 5Stack
          </a>
          <p class="max-w-3xl text-sm leading-relaxed text-foreground/90">
            {{ $t("licenses.intro") }}
          </p>
          <p class="text-xs text-muted-foreground">
            Copyright © 2024–2026 Luke Policinski
          </p>
          <div class="flex flex-wrap gap-2">
            <a
              :class="linkClasses"
              href="https://github.com/5stackgg"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ $t("licenses.source") }}
              <ArrowUpRight class="h-3 w-3" />
            </a>
            <a
              :class="linkClasses"
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ $t("licenses.license_text") }}
              <ArrowUpRight class="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      <section class="flex flex-col gap-3">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("licenses.third_party.title") }}
        </div>
        <p class="max-w-3xl text-sm leading-relaxed text-foreground/90">
          {{ $t("licenses.third_party.description") }}
        </p>
        <a
          :class="linkClasses"
          href="/third-party-licenses.txt"
          target="_blank"
          rel="noopener"
        >
          {{ $t("licenses.third_party.link") }}
          <ArrowUpRight class="h-3 w-3" />
        </a>
      </section>
    </div>
  </PageTransition>
</template>
