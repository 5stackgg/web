<script setup lang="ts"></script>

<template>
  <div class="space-y-0.5 flex justify-between items-start items-center">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        <slot name="title"></slot>
      </h2>
      <p class="text-muted-foreground">
        <slot name="description"></slot>
      </p>
    </div>

    <slot name="actions"></slot>
  </div>
</template>
