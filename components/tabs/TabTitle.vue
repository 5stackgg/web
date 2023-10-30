<template>
  <div class="tab" :class="{ 'tab--disabled': disabled === true }">
    <template v-if="titleIsComponent">
      <component :is="title" v-bind="tabData" />
    </template>
    <template v-else>
      <span v-html="title" />
    </template>
  </div>
</template>

<script>
export default {
  props: {
    tab: {
      required: true,
      type: Object,
    },
    disabled: {
      required: false,
      type: Boolean,
      default: false,
    },
  },
  computed: {
    title() {
      return this.tabData?.title;
    },
    titleIsComponent() {
      return typeof this.tabData?.title === "object";
    },
    tabData() {
      return this.tab?.props;
    },
  },
};
</script>
