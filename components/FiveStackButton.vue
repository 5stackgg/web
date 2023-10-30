<template>
  <button
    type="submit"
    :disabled="disabled"
    class="py-3 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded border dark:focus:outline-none cursor-pointer"
    :class="{
      ['hover:bg-gray-50 text-gray-800 border-gray-200 dark:bg-slate-900 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800 dark:focus:ring-1 dark:focus:ring-gray-600']:
        type === undefined,
      ['border-transparent bg-blue-600 text-white hover:bg-blue-700 dark:focus:ring-1 dark:focus:ring-gray-600']:
        type && type === 'success',
      ['disabled:opacity-50']: disabled,
    }"
  >
    <slot></slot>
    <slot name="icon"></slot>
  </button>
</template>

<script>
export default {
  props: {
    type: {
      type: String,
      required: false,
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
};
</script>
