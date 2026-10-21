<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import BackLink from "~/components/common/BackLink.vue";
import DemoMatch from "~/components/faq/demo/DemoMatch.vue";

const { t } = useI18n();

useHead({ title: () => t("faq.demo.title") });
</script>

<template>
  <div class="mx-auto flex w-full max-w-[90rem] flex-col gap-4 pb-10">
    <BackLink
      to="/faq#demo-match"
      class="inline-flex w-fit items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-[hsl(var(--tac-amber))]"
    >
      <ArrowLeft class="size-3.5" />
      {{ $t("faq.title") }}
    </BackLink>
    <DemoMatch />
  </div>
</template>
