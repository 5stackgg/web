<script setup lang="ts">
import { FilePen, PencilLine, Send } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { dateLocale } from "~/utilities/dateLocale";
import type { NewsDraft } from "~/components/news/newsTypes";

/** Authors' unpublished posts, on the page they'll appear on once published. */
defineProps<{
  drafts: NewsDraft[];
  publishing?: string | null;
}>();

const emit = defineEmits<{ publish: [draft: NewsDraft] }>();

const edited = (value: string) =>
  new Date(value).toLocaleDateString(dateLocale(), {
    month: "short",
    day: "numeric",
  });
</script>

<template>
  <ul class="m-0 grid list-none gap-2 p-0">
    <li
      v-for="draft in drafts"
      :key="draft.id"
      class="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-lg border border-dashed border-muted-foreground/35 bg-muted/10 py-2.5 pl-3.5 pr-3"
    >
      <span
        class="inline-flex h-[1.375rem] items-center gap-1.5 rounded-md bg-muted/60 px-2 text-xs font-semibold text-foreground/85"
      >
        <FilePen class="h-3 w-3 text-muted-foreground" />
        {{ $t("pages.news.manage.draft") }}
      </span>
      <span class="grid min-w-0 flex-[1_1_16rem] gap-0.5">
        <b class="truncate text-sm font-bold">
          {{ draft.title || $t("pages.news.form.title_placeholder") }}
        </b>
        <span class="text-xs text-muted-foreground">
          {{ $t("pages.news.draft_hint", { date: edited(draft.updated_at) }) }}
        </span>
      </span>
      <span class="flex gap-1.5">
        <Button as-child variant="outline" size="sm">
          <NuxtLink :to="`/news/manage/${draft.id}`">
            <PencilLine class="h-3.5 w-3.5" />
            {{ $t("pages.news.manage.edit") }}
          </NuxtLink>
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.15)] hover:text-[hsl(var(--tac-amber))]"
          :loading="publishing === draft.id"
          @click="emit('publish', draft)"
        >
          <Send class="h-3.5 w-3.5" />
          {{ $t("pages.news.manage.publish") }}
        </Button>
      </span>
    </li>
  </ul>
</template>
