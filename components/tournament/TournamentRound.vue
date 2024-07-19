<template>
  <ol class="flex flex-1 flex-col justify-around mr-5 ml-5 round">
    <template v-for="match in matches">
      <li
        class="flex items-center m-2 p-1 leading-relaxed bg-gray-600 text-gray-300 rounded-full relative with-connector"
      >
        <span
          class="w-6 h-6 ml-1 mr-1 inline-block bg-gray-300 rounded-full"
        ></span>
        <pre>Match #{{ match.match_number }}</pre>
      </li>
      <li
        class="flex items-center m-2 p-1 leading-relaxed bg-gray-600 text-gray-300 rounded-full relative with-connector"
      >
        <span
          class="w-6 h-6 ml-1 mr-1 inline-block bg-gray-300 rounded-full"
        ></span>
      </li>
    </template>
  </ol>
</template>
<script lang="ts">
export default {
  props: {
    matches: {
      type: Array,
      required: true,
    },
  },
};
</script>
