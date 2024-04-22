<script setup lang="ts"></script>

<template>
  <div class="space-y-0.5">
    <h2 class="text-2xl font-bold tracking-tight"><slot></slot></h2>
    <p class="text-muted-foreground" v-if="$slots.description">
      <slot name="description"></slot>
    </p>
  </div>
  <Separator class="my-6" />
</template>
