// https://nuxt.com/docs/api/configuration/nuxt-config

const sw = process.env.SW === 'true'

export default defineNuxtConfig({
  ssr: false,
  plugins: [],

  modules: [
    "@nuxtjs/apollo",
    "@pinia/nuxt",
    "@nuxtjs/tailwindcss",
    "@nuxtjs/color-mode",
    "shadcn-nuxt",
    "@nuxt/image",
    '@vite-pwa/nuxt'
  ],

  pwa: {
    injectRegister: 'auto',
    registerType: 'autoUpdate',
    devOptions: { enabled: true },
    manifest: {
      name: '5stack',
      short_name: '5stack',
      icons: [
        // {
        //   src: '/assets/favicon/android-chrome-96x96.png',
        //   sizes: '96x96',
        //   type : 'image/png'
        // },
        // {
        //   src: '/assets/favicon/android-chrome-192x192.png',
        //   sizes: '192x192',
        //   type : 'image/png'
        // },
        // {
        //   src: '/assets/favicon/android-chrome-512x512.png',
        //   sizes: '512x512',
        //   type: 'image/png',
        //   purpose: 'any'
        // },
      ],
      theme_color: '#000000',
      background_color: '#000000',
      display: 'standalone'
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,svg,ico,jpeg,webp}'],
      runtimeCaching: [{
        urlPattern: "/",
        handler: 'NetworkFirst',
      }],
      navigateFallback: undefined,
    },
  },

  colorMode: {
    classSuffix: "",
    preference: "dark",
  },

  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },

  // disable auto imports for components
  components: {
    dirs: [],
  },

  css: ["~/assets/css/tailwind.css"],

  postcss: {
    plugins: {
      "tailwindcss/nesting": "postcss-nesting",
      tailwindcss: {},
      autoprefixer: {},
    },
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
          // @ts-ignore
          credentials: "include",
        },
      },
    },
  },

  compatibilityDate: "2024-07-15",
});