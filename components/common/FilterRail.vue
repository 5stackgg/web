<template>
  <!-- Chips plus a hairline that runs out to the edge, so a rail holding a
       single filter still reads as a bar rather than a stray pill. -->
  <div class="flex items-center gap-1.5">
    <slot />
    <span class="h-px min-w-4 flex-1 bg-border/50" />
  </div>
</template>
