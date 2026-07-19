// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "node:url";
import federation from "@originjs/vite-plugin-federation";
import { FEDERATION_SHARED } from "./lib/federation.shared";

const sw = process.env.SW === "true";

const title = "5Stack — The System Behind the Game—Yours";
const description =
  "Counter-Strike Management System — a comprehensive panel for managing servers, matches, and tournaments.";

// TODO - i tired to get SSO to work but it wont
const url = `https://5stack.gg`;

export default defineNuxtConfig({
  ssr: false,

  // Pin the shadcn `cn` helper to a real committed module. shadcn-nuxt
  // otherwise aliases @/lib/utils to a virtual template that Vite can drop
  // during dep re-optimization → runtime "cn is not a function".
  alias: {
    "@/lib/utils": fileURLToPath(new URL("./lib/utils.ts", import.meta.url)),
  },

  app: {
    head: {
      charset: "utf-8",
      viewport:
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      title,
      titleTemplate: (pageTitle?: string) =>
        pageTitle && pageTitle !== title ? `${pageTitle} | 5Stack` : title,
      meta: [
        { name: "color-scheme", content: "dark" },
        { name: "theme-color", content: "#0a0a0b" },
        { name: "robots", content: "index, follow" },
        { name: "title", content: title },
        { name: "description", content: description },
        { name: "site_name", content: "5Stack" },

        { property: "og:locale", content: "en" },
        { property: "og:type", content: "website" },

        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:site_name", content: "5Stack" },

        { property: "og:url", content: url },
        { property: "og:image", content: `${url}/_ipx/_/favicon/512.png` },
      ],
      htmlAttrs: {
        class: "dark",
        style: "background-color: hsl(240 10% 3.9%)",
      },
      bodyAttrs: {
        class: "pre-loader",
      },
      style: [
        {
          innerHTML: `
            .pre-loader::before {
              content: '';
              box-sizing: border-box;
              border: 4px solid rgba(255, 255, 255, 0.3);
              border-top: 4px solid white;
              border-radius: 50%;
              width: 50px;
              height: 50px;
              animation: spin 1s linear infinite;
            }
            .pre-loader {
              margin: 0;
              background-color: hsl(240 10% 3.9%);
              background-image: url("/topo-preloader.svg");
              background-size: cover;
              background-position: center;
              background-repeat: no-repeat;
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 9999;
              transition: opacity 0.3s;
            }
            .pre-loader--fade {
              opacity: 0;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `,
        },
      ],
    },
  },

  experimental: {
    defaults: {
      nuxtLink: {
        prefetchOn: {
          visibility: false,
          interaction: true,
        },
      },
    },
  },

  i18n: {
    strategy: "no_prefix",
    bundle: {
      optimizeTranslationDirective: false,
    },
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_redirected",
      redirectOn: "root",
      fallbackLocale: "en",
    },
    locales: [
      { code: "en", name: "English", file: "en.json", flag: "🇬🇧" },
      { code: "ar", name: "العربية", file: "ar_SA.json", flag: "🇸🇦" }, // Arabic
      { code: "da", name: "Dansk", file: "da_DK.json", flag: "🇩🇰" }, // Danish
      { code: "de", name: "Deutsch", file: "de_DE.json", flag: "🇩🇪" }, // German
      { code: "es", name: "Español", file: "es_ES.json", flag: "🇪🇸" }, // Spanish
      { code: "fr", name: "Français", file: "fr_FR.json", flag: "🇫🇷" }, // French
      { code: "it", name: "Italiano", file: "it_IT.json", flag: "🇮🇹" }, // Italian
      { code: "ja", name: "日本語", file: "ja_JP.json", flag: "🇯🇵" }, // Japanese
      { code: "ko", name: "한국어", file: "ko_KR.json", flag: "🇰🇷" }, // Korean
      { code: "pl", name: "Polski", file: "pl_PL.json", flag: "🇵🇱" }, // Polish
      {
        code: "pt",
        name: "Português (Brasil)",
        file: "pt_BR.json",
        flag: "🇧🇷",
      }, // Brazilian Portuguese
      { code: "ru", name: "Русский", file: "ru_RU.json", flag: "🇷🇺" }, // Russian
      { code: "sv", name: "Svenska", file: "sv_SE.json", flag: "🇸🇪" }, // Swedish
      { code: "tr", name: "Türkçe", file: "tr_TR.json", flag: "🇹🇷" }, // Turkish
      { code: "uk", name: "Українська", file: "uk_UA.json", flag: "🇺🇦" }, // Ukrainian
      {
        code: "zh-Hans",
        name: "中文 (简体)",
        file: "zh_Hans.json",
        flag: "🇨🇳",
      }, // Simplified Chinese
      {
        code: "zh-Hant",
        name: "中文 (繁體)",
        file: "zh_Hant.json",
        flag: "🇨🇳",
      }, // Traditional Chinese
    ],
    lazy: true,
    defaultLocale: "en",
  },

  runtimeConfig: {
    public: {
      apiDomain: "",
      wsDomain: "",
      webDomain: "",
      demosDomain: "",
      relayDomain: "",
      // CDN base for 3D-replay collision meshes (.tri). Pin the awpy build tag so
      // the URL is immutable/cache-forever. Override with NUXT_PUBLIC_MAP_MESH_CDN
      // to swap to cdn.5stack.gg (R2) later — no code change needed.
      mapMeshCdn:
        "https://cdn.jsdelivr.net/gh/5stackgg/replay-map-meshes@17595823-5",
    },
  },

  modules: [
    "@nuxtjs/apollo",
    "@pinia/nuxt",
    "@nuxtjs/tailwindcss",
    "@nuxtjs/color-mode",
    "shadcn-nuxt",
    "@nuxt/image",
    "@vite-pwa/nuxt",
    "@nuxtjs/i18n",
  ],

  pwa: {
    injectRegister: "auto",
    registerType: "autoUpdate",
    client: {
      installPrompt: true,
    },
    workbox: {
      cleanupOutdatedCaches: true,
      maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      // Do not precache every Nuxt chunk during service-worker install.
      // Runtime caching below stores route assets only after a visited page needs them.
      globPatterns: [],
      // No precache manifest, so disable the navigate fallback —
      // otherwise workbox calls createHandlerBoundToURL('/') and throws non-precached-url.
      navigateFallback: null,
      navigateFallbackDenylist: [
        /^\/auth/,
        /^\/discord-invite/,
        /^\/discord-bot/,
      ],
      runtimeCaching: [
        {
          urlPattern: ({ url }: { url: URL }) =>
            url.pathname.startsWith("/_nuxt/"),
          handler: "CacheFirst",
          options: {
            cacheName: "nuxt-assets",
            expiration: {
              maxEntries: 300,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /\.(?:png|svg|webp|ico)$/i,
          handler: "CacheFirst",
          options: {
            cacheName: "images",
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /\.(?:ttf|woff|woff2)$/i,
          handler: "CacheFirst",
          options: {
            cacheName: "fonts",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365,
            },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /\/v1\/graphql/,
          handler: "NetworkOnly",
        },
      ],
    },
    devOptions: {
      enabled: sw,
      suppressWarnings: true,
    },
    manifest: {
      name: "5stack",
      short_name: "5stack",
      icons: [
        {
          src: "/favicon/64.png",
          sizes: "64x64",
          type: "image/png",
        },
        {
          src: "/favicon/192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/favicon/512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
      ],
      theme_color: "#000000",
      background_color: "#000000",
      display: "standalone",
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
        httpEndpoint: `https://temp/v1/graphql`,
      },
    },
  },

  compatibilityDate: "2024-07-15",

  vite: {
    optimizeDeps: {
      include: ["monaco-editor"],
    },
    // Plugins host: enables the `__federation__` virtual module so
    // `pages/apps/[slug].vue` can register + load plugin remotes at runtime.
    // Every real remote is added dynamically from the custom_pages registry, so
    // new plugins need no web rebuild.
    plugins: [
      federation({
        name: "host",
        remotes: {
          // NOT optional, and never actually loaded. vite-plugin-federation
          // decides `isHost` from `remotes` being non-empty, and only a host
          // gets `__rf_placeholder__shareScope` in the `__federation__` virtual
          // module substituted with the real shared-scope map. With `remotes:
          // {}` the production bundle ships that placeholder as a bare
          // identifier, so the moment `wrapShareScope()` runs — i.e. the first
          // time any plugin remote loads — it throws "__rf_placeholder__shareScope
          // is not defined". Dev is unaffected (its transform isn't gated on
          // isHost), so this only ever shows up in a built deploy.
          __federation_host_placeholder__: {
            external: "http://localhost/__federation_placeholder__.js",
            format: "esm",
            from: "vite",
          },
        },
        shared: FEDERATION_SHARED,
      }),
    ],
    build: {
      target: "esnext",
    },
  },
});
