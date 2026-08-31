// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from "node:url";
import federation from "@originjs/vite-plugin-federation";

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
  // during dep re-optimization → runtime "cn is not a function". It lives at
  // lib/utils/index.ts rather than lib/utils.ts so the module stops warning
  // that its own generated file can be removed.
  alias: {
    "@/lib/utils": fileURLToPath(
      new URL("./lib/utils/index.ts", import.meta.url),
    ),
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
      // The app is dark-only. shadcn's light palette still lives under :root,
      // but <html> is permanently in the .dark scope so it is never used.
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
            /* The overlay lives in ::before/::after rather than on <body>
               itself: fading <body> would fade the app mounted inside it,
               so the reveal could only ever be a hard cut. As pseudo
               elements the panel and spinner fade *over* live content. */
            .pre-loader {
              margin: 0;
              overflow: hidden;
            }
            .pre-loader::before,
            .pre-loader::after {
              content: '';
              position: fixed;
              z-index: 9999;
              pointer-events: none;
              transition: opacity 0.3s ease;
            }
            .pre-loader::before {
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-color: hsl(240 10% 3.9%);
              background-image: url("/topo-preloader.svg");
              background-size: cover;
              background-position: center;
              background-repeat: no-repeat;
            }
            .pre-loader::after {
              box-sizing: border-box;
              top: 50%;
              left: 50%;
              width: 50px;
              height: 50px;
              margin: -25px 0 0 -25px;
              border: 4px solid rgba(255, 255, 255, 0.3);
              border-top: 4px solid white;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            }
            .pre-loader--fade::before,
            .pre-loader--fade::after {
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

  // NOTE: the watcher exclusion that keeps `nuxt dev` from EMFILE-looping lives
  // in .nuxtignore, not here — nuxt.config's `ignore` array is a no-op in Nuxt
  // 3.17.2 (see the comment in .nuxtignore for the upstream bug).

  experimental: {
    // Watch the project tree via @parcel/watcher (FSEvents) instead of one
    // registration per path, which keeps Nuxt's own watcher off the same cap.
    watcher: "parcel",

    defaults: {
      nuxtLink: {
        prefetchOn: {
          visibility: false,
          interaction: true,
        },
      },
    },
  },

  hooks: {
    // Nuxt marks every build chunk `prefetch: true`, and with ssr:false the
    // shell renders that as ~345 <link rel="prefetch"> tags. The browser then
    // opens a few hundred speculative connections while the entry chunk is
    // still downloading and parsing, and first paint waits behind them.
    // Measured on a 4x-CPU / 9Mbps profile: FCP 1372ms -> 580ms, app reveal
    // -575ms with these stripped.
    //
    // Nothing is lost that the app needs to boot: the entry keeps its
    // modulepreload, route chunks are dynamic imports that load on navigation,
    // and NuxtLink's interaction prefetch (see experimental.defaults above)
    // still warms a route on hover/touch.
    "build:manifest"(manifest) {
      for (const chunk of Object.values(manifest)) {
        chunk.prefetch = false;
      }
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
      // Where to tell *another device* to open the panel -- the camera QR, the
      // call QR. The same as webDomain in a real deployment, and only different
      // behind a dev tunnel, where the app is served somewhere the API's own
      // web-domain routes (/auth, /discord-invite) are not. Blank falls back to
      // webDomain; modules/dev-tunnel.ts is the only thing that sets it.
      deviceDomain: "",
      demosDomain: "",
      relayDomain: "",
      // CDN base for 3D-replay collision meshes and map callouts.
      // Served by the panel's own worker (cloudflare-workers/backblaze-proxy)
      // out of B2, keyed maps/<cs2 build>/<map>.tri.gz. Off jsDelivr because its
      // ~20MiB per-file cap forced heavy decimation; the build id keeps the URL
      // immutable. Override with NUXT_PUBLIC_MAP_MESH_CDN.
      mapMeshCdn: "https://demo-dl.5stack.gg/maps/24957633",
    },
  },

  modules: [
    "@nuxtjs/apollo",
    "@pinia/nuxt",
    "@nuxtjs/tailwindcss",
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
      // Adds `push` / `notificationclick` handlers to the generated service
      // worker without giving up the default generateSW strategy for a custom
      // SW file. Served unhashed from public/, so bump the ?v= on any change.
      importScripts: ["/sw-push.js?v=4"],
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
        // Padded, opaque variant of the same art. Android masks launcher icons
        // into a circle/squircle, and with only `any` icons declared it crops
        // whatever it's given and fills the rest with a colour of its own
        // choosing -- the crest's gun barrels reach the edges, so they were the
        // part that got cut. Content here sits at 80% on a filled field so the
        // mask lands on background instead. iOS ignores maskable entirely and
        // keeps using the `any` icon above.
        {
          src: "/favicon/512-maskable.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
      theme_color: "#000000",
      background_color: "#000000",
      display: "standalone",
    },
  },

  devtools: {
    enabled: true,

    // Disables vite-plugin-vue-tracer, which rewrites every vnode in dev to
    // carry source positions. After an edit it can serve a render function
    // referencing $setup bindings that the same file's setup() no longer
    // returns -- the component renders as `undefined` with no error, and only
    // a dev-server restart clears it. Not worth the click-to-source.
    componentInspector: false,

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
      // graphql (126 requests) and @apollo/client (103) are shipped module by
      // module in dev otherwise. That is invisible on localhost and brutal
      // through the dev tunnel, where every one of them is a round-trip to
      // whoever is running the dev server.
      //
      // The list has to name the specifier each importer actually writes --
      // Vite matches these as strings, not as resolved files. "@apollo/client/
      // core" does NOT cover "@apollo/client/core/index.js", and missing that
      // one alone leaves apollo un-optimized: the raw module's own relative
      // imports then cascade into ~103 separate requests. The three that are
      // easy to miss, and who asks for them:
      //   @apollo/client            -> @nuxtjs/apollo
      //   @apollo/client/core/index.js -> @vue/apollo-composable, @vue/apollo-option
      //   @apollo/client/link/context  -> our own plugins/composables
      include: [
        "monaco-editor",
        "graphql",
        "graphql/language/parser",
        "graphql-tag",
        "graphql-ws",
        "@apollo/client",
        "@apollo/client/core",
        "@apollo/client/core/index.js",
        "@apollo/client/cache",
        "@apollo/client/link/context",
        "@apollo/client/link/error",
        "@apollo/client/link/retry",
        "@apollo/client/link/subscriptions",
        "@apollo/client/utilities",
        "@vue/apollo-composable",
        "@vue/apollo-option",
      ],
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
        // Deliberately empty — do NOT add packages here.
        //
        // Every entry makes vite-plugin-federation rewrite that package's
        // imports into `await importShared(...)`, turning most of the app into
        // async modules (it was 308 of 474 chunks). Safari then throws
        // "Cannot access '<x>' before initialization" whenever several modules
        // import the same top-level-await module at once — WebKit bug 242740,
        // fixed only in STP 243+, so shipping iOS Safari still has it. Upstream
        // has no fix either: originjs/vite-plugin-federation#403 is the same
        // catch-22, open with no root-cause response.
        //
        // Remotes get the panel's Vue from `window.__5stack_shared__` instead —
        // see plugins/shared-globals.client.ts and docs/plugins.md. `remotes`
        // above stays non-empty purely so this build still counts as a host.
        shared: {},
      }),
    ],
    build: {
      target: "esnext",
    },
  },
});
