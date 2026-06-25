<script setup lang="ts"></script>

<template>
  <div class="min-h-screen">
    <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        class="box-border h-[50px] w-[50px] animate-spin rounded-full border-4 border-white/30 border-t-white"
        :aria-label="$t('ui.tooltips.loading')"
        role="status"
      ></div>
    </div>
  </div>
</template>
