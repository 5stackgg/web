// https://nuxt.com/docs/api/configuration/nuxt-config

// TODO : https://stackoverflow.com/questions/75001801/nuxt-dynamically-change-the-enviroment-variables-in-run-time-config
// https://nuxt.com/docs/guide/directory-structure/env

export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },
  css: ["~/assets/styles/public.scss"],
  postcss: {
    plugins: {
      "tailwindcss/nesting": "postcss-nesting",
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  modules: ["@nuxtjs/apollo", "@pinia/nuxt"],

  plugins: ["~/plugins/preline.client.ts"],

  apollo: {
    proxyCookies: true,
    clients: {
      default: {
        httpEndpoint: "https://api.5stack.gg/v1/graphql",
        httpLinkOptions: {
          credentials: "include",
        },
        wsEndpoint: "wss://api.5stack.gg/v1/graphql",
        wsLinkOptions: {
          credentials: "include",
        },
      },
    },
  },
});
