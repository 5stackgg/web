<template>
  <ol class="flex items-center whitespace-nowrap" aria-label="Breadcrumb">
    <li class="inline-flex items-center">
      <NuxtLink to="/" class="crumb"> Dashboard </NuxtLink>
    </li>

    <template v-for="(crumb, index) in crumbs" :key="index">
      <svg
        class="flex-shrink-0 mx-2 overflow-visible h-4 w-4 text-gray-400 dark:text-neutral-600 dark:text-neutral-600"
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

      <NuxtLink
        :to="crumb.to"
        class="crumb"
        :class="{
          [`crumb--active`]: crumbs.length - 1 == index,
        }"
      >
        {{ crumb.text }}
      </NuxtLink>
    </template>
  </ol>
</template>

<script lang="ts">
export default {
  computed: {
    crumbs() {
      const segments = this.$route.path.split("/").filter((segment: string) => {
        return segment.trim() !== "";
      });

      const breadcrumbs: Array<{
        text: string;
        to: string;
      }> = [];
      let path = "";
      segments.forEach((segment: string) => {
        path += `/${segment}`;
        breadcrumbs.push({
          text: segment,
          to: path,
        });
      });
      return breadcrumbs;
    },
  },
};
</script>

<style lang="scss">
.crumb {
  @apply text-gray-500 capitalize;
  &--active {
    @apply inline-flex items-center text-sm font-semibold text-gray-800 truncate dark:text-gray-200;
  }
}
</style>
