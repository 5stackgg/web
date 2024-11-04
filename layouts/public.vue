<script setup lang="ts">
import PublicFooter from "~/layouts/components/PublicFooter.vue";
import PublicHeader from "~/layouts/components/PublicHeader.vue";
</script>

<template>
  <public-header></public-header>
  <slot></slot>
  <public-footer />
</template>

<script lang="ts">
export default {};
</script>
