<template>
  <div
    class="relative aspect-video w-full animate-pulse overflow-hidden rounded-lg border border-white/[0.07] bg-card/40"
  >
    <div
      class="absolute inset-0 [background:radial-gradient(120%_120%_at_50%_0%,hsl(var(--muted)/0.35),transparent_60%)]"
    />
    <div class="absolute inset-x-2.5 top-2.5 flex items-center justify-between">
      <div class="h-[26px] w-[5.5rem] rounded-md bg-muted/50" />
      <div class="h-[26px] w-10 rounded-md bg-muted/40" />
    </div>
    <div class="absolute inset-x-3 bottom-3 grid gap-1.5">
      <div class="h-3.5 w-2/3 rounded bg-muted/50" />
      <div class="flex items-center gap-1.5">
        <div class="h-5 w-5 rounded-full bg-muted/50" />
        <div class="h-2.5 w-1/4 rounded bg-muted/40" />
      </div>
    </div>
  </div>
</template>
