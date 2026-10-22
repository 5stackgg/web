<script setup lang="ts">
import { ArrowLeft, ArrowRight } from "lucide-vue-next";
import BackLink from "~/components/common/BackLink.vue";
import DemoDraftHandoff from "~/components/faq/demo/DemoDraftHandoff.vue";

const { t } = useI18n();

useHead({ title: () => t("faq.demo_draft.title") });
</script>

<template>
  <div class="mx-auto flex w-full max-w-[90rem] flex-col gap-4 pb-10">
    <!-- Back to the FAQ, or across to the other demo. -->
    <div class="flex items-center justify-between gap-4">
      <BackLink
        to="/faq#veto-flow"
        class="inline-flex w-fit items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-[hsl(var(--tac-amber))]"
      >
        <ArrowLeft class="size-3.5" />
        {{ $t("faq.title") }}
      </BackLink>
      <NuxtLink
        to="/faq/demo-match"
        class="ml-auto inline-flex w-fit items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-[hsl(var(--tac-amber))]"
      >
        {{ $t("faq.demo.title") }}
        <ArrowRight class="size-3.5" />
      </NuxtLink>
    </div>
    <DemoDraftHandoff />
  </div>
</template>
