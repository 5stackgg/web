<template>
  <div class="flex flex-col border shadow-sm rounded-xl dark:border-gray-700 dark:shadow-slate-700/[.7]">
    <div class="p-4 md:p-5">
      <h3 class="text-lg font-bold text-gray-800 dark:text-white">
        {{ map.name }}
        <slot></slot>
      </h3>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  props: {
    map: {
      type: Object,
      required: true,
    }
  }
}
</script>