// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },
  css: ["~/assets/styles/public.scss"],
  postcss: {
    plugins: {
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
