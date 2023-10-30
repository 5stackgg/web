<template>
  <app-nav></app-nav>
  <div class="w-full lg:ps-72 px-4 sm:px-6 md:px-8 pt-5">
    <bread-crumbs></bread-crumbs>
    <div class="pt-5">
      <slot></slot>
    </div>
  </div>
</template>

<script lang="ts">
import AppNav from "~/layouts/components/AppNav.vue";
import BreadCrumbs from "~/components/BreadCrumbs.vue";
import socket from "~/web-sockets/Socket";

export default {
  components: { BreadCrumbs, AppNav },
  setup() {
    useHead({
      htmlAttrs: {
        class: "dark h-full",
      },
      bodyAttrs: {
        class: "h-full bg-gray-50 dark:bg-slate-900",
      },
    });
  },
  created() {
    socket.connect();
  },
};
</script>
