<script setup lang="ts">
import { computed } from "vue";
import { Skeleton } from "~/components/ui/skeleton";
import type { TournamentPreview } from "~/composables/useTournamentPreview";

// The tournament page's header and first section, drawn while its queries are
// in flight. With a preview from the list you came from it already shows the
// real name and banner, so the swap to the loaded page is only the details.
const props = defineProps<{ preview?: TournamentPreview | null }>();

const bannerSrc = computed(() =>
  props.preview?.banner
    ? `https://${useRuntimeConfig().public.apiDomain}/${props.preview.banner}`
    : null,
);
</script>

<template>
  <div aria-busy="true" :aria-label="preview?.name ?? $t('common.loading')">
    <header class="overflow-hidden rounded-xl border border-border bg-card/40">
      <div
        v-if="bannerSrc"
        class="aspect-[5/2] max-h-[18.75rem] w-full bg-muted/40 sm:aspect-[4/1]"
      >
        <img
          :src="bannerSrc"
          alt=""
          class="h-full w-full object-cover object-[50%_40%]"
        />
      </div>
      <div
        class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-5 pt-5 max-sm:px-4 max-sm:pt-4"
      >
        <div class="grid min-w-0 gap-2">
          <div class="flex flex-wrap items-center gap-1.5">
            <span
              v-if="preview?.statusLabel"
              class="inline-flex h-6 items-center rounded-md border border-border bg-muted/30 px-2 text-xs font-semibold text-muted-foreground"
            >
              {{ preview.statusLabel }}
            </span>
            <Skeleton v-else class="h-6 w-28 rounded-md" />
            <Skeleton class="h-6 w-20 rounded-md" />
          </div>
          <h1
            v-if="preview?.name"
            class="m-0 text-[clamp(1.5rem,3.4vw,2.25rem)] font-extrabold leading-[1.05] [text-wrap:balance]"
          >
            {{ preview.name }}
          </h1>
          <Skeleton v-else class="h-9 w-80 max-w-full rounded-md" />
          <Skeleton class="h-4 w-72 max-w-full rounded-md" />
        </div>
        <div class="flex gap-2 max-sm:w-full">
          <Skeleton class="h-9 w-32 rounded-md max-sm:flex-1" />
          <Skeleton class="h-9 w-28 rounded-md" />
        </div>
      </div>
      <div
        class="mt-4 flex h-11 items-center gap-7 border-t border-border px-4"
      >
        <Skeleton v-for="i in 4" :key="i" class="h-3 w-16 rounded-sm" />
      </div>
    </header>

    <div class="mt-6 grid gap-8">
      <Skeleton class="h-[4.5rem] rounded-lg" />
      <div class="grid gap-3">
        <Skeleton class="h-3 w-24 rounded-sm" />
        <Skeleton class="h-28 rounded-lg" />
      </div>
    </div>
  </div>
</template>
