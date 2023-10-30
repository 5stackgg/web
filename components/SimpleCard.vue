<template>
  <div
    class="flex flex-col bg-white border shadow-sm rounded-xl dark:bg-slate-900 dark:border-gray-800"
  >
    <div class="p-4 md:p-5 flex justify-between gap-x-3">
      <div>
        <p class="text-xs uppercase tracking-wide text-gray-500">
          {{ title }}
        </p>
        <div class="mt-1 flex items-center gap-x-2">
          <h3 class="mt-1 text-xl font-medium text-gray-800 dark:text-gray-200">
            <slot></slot>
          </h3>
        </div>
      </div>
      <div
        class="flex-shrink-0 flex justify-center items-center w-[46px] h-[46px] bg-blue-600 text-white rounded-full dark:bg-blue-900 dark:text-blue-200"
        v-if="$slots.icon"
      >
        <slot name="icon"></slot>
      </div>
    </div>

    <slot name="link" v-if="$slots.link">
      <a
        class="py-3 px-4 md:px-5 inline-flex justify-between items-center text-sm text-gray-600 border-t border-gray-200 hover:bg-gray-50 rounded-b-xl dark:border-gray-700 dark:text-gray-400 dark:hover:bg-slate-800 dark:focus:outline-none dark:focus:ring-1 dark:focus:ring-gray-600"
      >
        <svg
          class="flex-shrink-0 w-4 h-4"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </a>
    </slot>
  </div>
</template>
<script lang="ts">
export default {
  props: {
    title: {
      required: true,
      type: String,
    },
  },
};
</script>
