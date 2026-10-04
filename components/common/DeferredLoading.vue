<script setup lang="ts">
import { useDeferredLoading } from "~/composables/useDeferredLoading";

// useDeferredLoading for Options API pages, whose loading flag lives in
// `data()` where a `<script setup>` composable can't read it.
const props = defineProps<{ loading: boolean }>();

const { skeleton, refreshing, loaded } = useDeferredLoading(
  () => props.loading,
);
</script>

<!-- A real root, so it can sit in a <Transition> and take the caller's class. -->
<template>
  <div>
    <slot :skeleton="skeleton" :refreshing="refreshing" :loaded="loaded" />
  </div>
</template>
