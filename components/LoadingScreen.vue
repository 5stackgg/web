<script setup lang="ts"></script>

<template>
  <!-- Centers in ITS OWN box, not the viewport. `fixed` here put the spinner in
       the middle of the screen no matter where the loading thing actually was —
       fine for a whole-page placeholder, wrong for a plugin mounted inside one
       tab of the player profile, where it landed over an unrelated section.
       Callers that want the old full-screen behaviour pass `class="min-h-screen"`. -->
  <div class="flex min-h-[200px] w-full items-center justify-center px-4">
    <div
      class="box-border h-[50px] w-[50px] animate-spin rounded-full border-4 border-white/30 border-t-white"
      :aria-label="$t('ui.tooltips.loading')"
      role="status"
    ></div>
  </div>
</template>
