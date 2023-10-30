<template>
  <div class="tab--content">
    <slot />
  </div>
</template>

<script>
export default {
  props: {
    title: {
      required: true,
      validator(value) {
        return typeof value === "string" || value.components;
      },
    },
  },
};
</script>
