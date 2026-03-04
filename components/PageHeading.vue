<script setup lang="ts"></script>

<template>
  <div class="flex justify-between items-start">
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">
        <slot name="title"></slot>
      </h2>
      <p class="text-muted-foreground">
        <slot name="description"></slot>
      </p>
    </div>

    <div class="flex-shrink-0">
      <slot name="actions"></slot>
    </div>
  </div>
</template>
