<template>
  <NuxtLayout :name="layout">
    <NuxtPage></NuxtPage>
  </NuxtLayout>
</template>

<script>
import "./assets/styles/public.scss";
import { useAuthStore } from "@/stores/AuthStore";

export default {
  beforeCreate() {
    useHead({
      title: "5stack",
      meta: [{ name: "description", content: "5stack.gg" }],
      link: [
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/favicon/apple-touch-icon.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon/favicon-32x32.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: "/favicon/favicon-16x16.png",
        },
        { rel: "manifest", href: "/favicon/manifest.json" },
        {
          rel: "mask-icon",
          href: "/favicon/safari-pinned-tab.svg",
          color: "#48acf0",
        },
        { rel: "shortcut icon", href: "/favicon/favicon.ico" },
      ],
    });
  },
  computed: {
    layout() {
      return useAuthStore().me ? "default" : "public";
    },
  },
};
</script>
