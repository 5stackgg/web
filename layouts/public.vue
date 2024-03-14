<template>
  <public-header></public-header>
  <slot></slot>
  <public-footer />
</template>

<script>
import Index from "~/pages/index.vue";
import PublicFooter from "~/layouts/components/PublicFooter.vue";
import PublicHeader from "~/layouts/components/PublicHeader.vue";

export default {
  components: { PublicFooter, PublicHeader, Index },
  setup() {
    useHead({
      htmlAttrs: {
        class: "h-full bg-white",
      },
      bodyAttrs: {
        class: "h-full",
      },
    });
  },
  data() {
    return {
      loaded: useState("loaded"),
    };
  },
};
</script>
