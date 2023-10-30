<template>
  <div class="flex flex-col">
    <div class="-m-1.5 overflow-x-auto">
      <div class="p-1.5 min-w-full inline-block align-middle">
        <div
          class="bg-white border border-gray-200 rounded shadow-sm overflow-hidden dark:bg-slate-900 dark:border-gray-700"
        >
          <div
            v-if="!!$slots.header"
            class="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-b border-gray-200 dark:border-gray-700"
          >
            <slot name="header"></slot>
          </div>

          <table class="clickable-table">
            <slot></slot>
          </table>

          <div
            v-if="!!$slots.footer"
            class="px-6 py-4 grid gap-3 md:flex md:justify-between md:items-center border-t border-gray-200 dark:border-gray-700"
          >
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts"></script>
