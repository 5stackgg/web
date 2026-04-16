<script setup lang="ts">
import PublicFooter from "~/layouts/components/PublicFooter.vue";
import TopoBackground from "~/layouts/components/TopoBackground.vue";
import { useGtm } from "@/layouts/composables/useGtm";

useGtm();
</script>

<template>
  <TopoBackground />
  <div class="relative z-10">
    <slot></slot>
    <public-footer />
  </div>
</template>

<script lang="ts">
export default {};
</script>
