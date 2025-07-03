// https://nuxt.com/docs/api/configuration/nuxt-config

const sw = process.env.SW === "true";

const title = "5Stack | Counter-Strike Management System";
const description =
  "A Comprehensive Panel for Managing Servers, Matches, and Tournaments";

// TODO - i tired to get SSO to work but it wont
const url = `https://5stack.gg`;

export default defineNuxtConfig({
  ssr: false,

  app: {
    head: {
      charset: "utf-8",
      viewport:
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      meta: [
        { name: "robots", content: "index, follow" },
        { name: "title", content: title },
        { name: "description", content: description },
        { name: "site_name", content: "5Stack" },

        { property: "og:locale", content: "en" },
        { property: "og:type", content: "website" },

        { property: "og:title", content: title },
        { property: "og:site_name", content: "5Stack" },

        { property: "og:url", content: url },
        { property: "og:image", content: `${url}/_ipx/_/favicon/512.png` },
      ],
      bodyAttrs: {
        class: "pre-loader",
      },
      style: [
        {
          innerHTML: `
            .pre-loader::before {
              content: '';
              position: absolute;
              border: 4px solid rgba(255, 255, 255, 0.3);
              border-top: 4px solid white;
              border-radius: 50%;
              width: 50px;
              height: 50px;
              animation: spin 1s linear infinite;
            }
            .pre-loader {
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
      { code: "tr", name: "Türkçe", file: "tr_TR.json", flag: "🇹🇷" }, // Turkish
      { code: "uk", name: "Українська", file: "uk_UA.json", flag: "🇺🇦" }, // Ukrainian
      { code: "zh-Hans", name: "中文 (简体)", file: "zh_Hans.json", flag: "🇨🇳" }, // Simplified Chinese
      { code: "zh-Hant", name: "中文 (繁體)", file: "zh_Hant.json", flag: "🇨🇳" } // Traditional Chinese
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
      globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff}"],
    },
    includeAssets: [
      "img/**/*.png",
      "img/**/*.svg",
      "img/**/*.webp",
      "fonts/*.woff",
      "favicon/*.png",
    ],
    devOptions: {
      enabled: true,
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
});
