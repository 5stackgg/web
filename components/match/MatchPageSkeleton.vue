<script setup lang="ts">
import { Skeleton } from "~/components/ui/skeleton";
</script>

<!-- The match page's outline while the match loads: the stage with its
     scorebug, then the maps beside the tabs, at the sizes they arrive at. -->
<template>
  <div aria-busy="true" class="flex flex-col gap-4 md:gap-6">
    <div
      class="rounded-2xl bg-muted/20 px-4 pb-5 pt-4 ring-1 ring-inset ring-white/[0.07] md:px-6"
    >
      <div class="flex h-9 items-center gap-4">
        <Skeleton class="h-4 w-36" />
        <Skeleton class="h-4 w-48 max-sm:hidden" />
      </div>
      <div
        class="mt-[18px] hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-5 md:grid"
      >
        <div class="flex items-center justify-end gap-4">
          <Skeleton class="h-5 w-28" />
          <Skeleton class="size-14 rounded-xl" />
        </div>
        <Skeleton class="h-[72px] w-[17rem] rounded-[10px]" />
        <div class="flex items-center gap-4">
          <Skeleton class="size-14 rounded-xl" />
          <Skeleton class="h-5 w-28" />
        </div>
      </div>
      <div class="mt-4 grid gap-2.5 md:hidden">
        <div v-for="i in 2" :key="i" class="flex items-center gap-3">
          <Skeleton class="size-10 rounded-lg" />
          <Skeleton class="h-4 w-32" />
          <Skeleton class="ml-auto h-6 w-8" />
        </div>
      </div>
    </div>

    <div
      class="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-[minmax(320px,_400px)_minmax(0,1fr)] lg:gap-8"
    >
      <Skeleton class="h-[22rem] rounded-xl" />
      <div class="min-w-0">
        <div class="mb-4 flex h-8 items-center gap-2">
          <Skeleton v-for="i in 5" :key="i" class="h-7 w-20" />
        </div>
        <Skeleton class="h-96 rounded-xl" />
      </div>
    </div>
  </div>
</template>
