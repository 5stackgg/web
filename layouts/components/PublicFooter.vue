<script setup lang="ts">
const linkClasses =
  "text-muted-foreground no-underline transition-colors duration-150 hover:text-foreground";
</script>

<template>
  <footer
    class="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4 pb-4"
  >
    <p
      class="pointer-events-auto flex items-center gap-2 font-sans text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground"
    >
      <a
        :class="linkClasses"
        href="https://5stack.gg"
        target="_blank"
        rel="noopener noreferrer"
      >
        Powered by 5Stack
      </a>
    </p>
  </footer>
</template>
