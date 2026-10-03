<script setup lang="ts">
// Every hub tab's empty state, in one place and one shape: centred in the
// space under the tab's own toolbar, lifted a little above true centre (the
// eye reads true centre as low), with a title, one line on what goes here,
// and the action that fills it when there is one. No icon: it read as clip
// art above the words.
defineProps<{
  title: string;
  description?: string | null;
}>();
</script>

<template>
  <div
    class="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-6 pb-[12%] pt-6 text-center"
  >
    <div class="space-y-1">
      <p class="text-sm font-medium text-foreground">{{ title }}</p>
      <p
        v-if="description"
        class="mx-auto max-w-[16rem] text-balance text-xs text-muted-foreground"
      >
        {{ description }}
      </p>
    </div>
    <slot />
  </div>
</template>
