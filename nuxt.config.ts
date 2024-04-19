// https://nuxt.com/docs/api/configuration/nuxt-config

// TODO : https://stackoverflow.com/questions/75001801/nuxt-dynamically-change-the-enviroment-variables-in-run-time-config
// https://nuxt.com/docs/guide/directory-structure/env

export default defineNuxtConfig({
  ssr: false,
  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },
  css: ["~/assets/css/tailwind.css"],
  postcss: {
    plugins: {
      "tailwindcss/nesting": "postcss-nesting",
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  modules: [
    "@nuxtjs/apollo",
    "@pinia/nuxt",
    "@nuxtjs/tailwindcss",
    "@nuxtjs/color-mode",
    "shadcn-nuxt",
  ],

  colorMode: {
    classSuffix: "",
    preference: "dark",
  },

  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: "",
    /**
     * Directory that the component lives in.
     * @default "./components/ui"
     */
    componentDir: "./components/ui",
  },

  plugins: [],

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
