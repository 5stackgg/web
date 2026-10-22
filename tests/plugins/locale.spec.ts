import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, type EffectScope } from "vue";
import localePlugin from "~/plugins/locale.client";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { savePickedLocale } from "~/utilities/locale";
import {
  resetBrowserLanguages,
  setBrowserLanguages,
} from "../helpers/browserLocale";

const SETTINGS_CACHE_KEY = "5stack:application-settings";
const PICKED_LOCALE_KEY = "5stack:locale";
const NON_ENGLISH_CHROME = ["nl-NL", "nl", "en-US", "en"];

const app = () =>
  useNuxtApp() as unknown as {
    $i18n: {
      locale: { value: string };
      setLocale: (code: string) => Promise<void>;
    };
    _vueI18n: { __firstAccess: boolean };
  };

const locale = () => app().$i18n.locale.value;

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

function siteDefault(value: string) {
  return [{ name: "public.default_language", value }];
}

let scope: EffectScope | undefined;

async function boot() {
  let mounted: (() => void) | undefined;
  app()._vueI18n.__firstAccess = true;
  await (localePlugin as unknown as (nuxtApp: unknown) => Promise<void>)({
    hook: (name: string, callback: () => void) => {
      if (name === "app:mounted") {
        mounted = callback;
      }
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 10));

  return () => {
    scope = effectScope();
    scope.run(() => mounted!());
  };
}

// The app booted its own copy of this plugin, and its watcher answers every
// change to the store too. Each test starts after it has settled.
beforeEach(async () => {
  localStorage.clear();
  document.cookie = "i18n_redirected=; max-age=0; path=/";
  useApplicationSettingsStore().settings = [];
  await settle();
  await app().$i18n.setLocale("en");
});

afterEach(() => {
  scope?.stop();
  scope = undefined;
  resetBrowserLanguages();
});

describe("the language a visitor first sees", () => {
  it("is Traditional Chinese for a zh-TW browser, and stays that way across pages", async () => {
    setBrowserLanguages(["zh-TW", "zh", "en-US"]);

    await boot();
    expect(locale()).toBe("zh-Hant");

    await useRouter().push("/faq");
    await useRouter().push("/");
    expect(locale()).toBe("zh-Hant");
  });

  it("is the visitor's own pick over their browser", async () => {
    setBrowserLanguages(["zh-TW"]);
    localStorage.setItem(PICKED_LOCALE_KEY, "ja");

    await boot();

    expect(locale()).toBe("ja");
  });

  it("is not written to a cookie for the next visit", async () => {
    setBrowserLanguages(["de-DE"]);

    await boot();
    await useRouter().push("/faq");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(document.cookie).not.toContain("i18n_redirected");
  });

  it("is the cached site default when we don't have the browser's language", async () => {
    setBrowserLanguages(NON_ENGLISH_CHROME);
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(siteDefault("pt")));

    await boot();

    expect(locale()).toBe("pt");
  });

  it("is the browser's language when we have it, whatever the site default", async () => {
    setBrowserLanguages(["zh-TW"]);
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(siteDefault("pt")));

    await boot();

    expect(locale()).toBe("zh-Hant");
  });

  it("is English with no site default and no browser language we have", async () => {
    setBrowserLanguages(NON_ENGLISH_CHROME);

    await boot();

    expect(locale()).toBe("en");
  });
});

describe("a change to the site default", () => {
  it("reaches a visitor shown the fallback", async () => {
    setBrowserLanguages(NON_ENGLISH_CHROME);
    const mount = await boot();
    mount();

    useApplicationSettingsStore().settings = siteDefault("ja");

    await vi.waitFor(() => expect(locale()).toBe("ja"));
  });

  it("is applied when the settings arrive before the page mounts", async () => {
    setBrowserLanguages(NON_ENGLISH_CHROME);
    useApplicationSettingsStore().settings = siteDefault("ja");
    await settle();

    const mount = await boot();
    expect(locale()).toBe("en");
    mount();

    await vi.waitFor(() => expect(locale()).toBe("ja"));
  });

  it("leaves a visitor on their browser's language", async () => {
    setBrowserLanguages(["de-DE"]);
    const mount = await boot();
    mount();

    useApplicationSettingsStore().settings = siteDefault("ja");
    await settle();

    expect(locale()).toBe("de");
  });

  it("leaves a visitor on a language they picked after the page loaded", async () => {
    setBrowserLanguages(NON_ENGLISH_CHROME);
    const mount = await boot();
    mount();

    savePickedLocale("sv");
    await app().$i18n.setLocale("sv");
    useApplicationSettingsStore().settings = siteDefault("ja");
    await settle();

    expect(locale()).toBe("sv");
  });
});

describe("the old i18n_redirected cookie", () => {
  it("no longer holds a zh-TW browser on Simplified Chinese", async () => {
    setBrowserLanguages(["zh-TW"]);
    document.cookie = "i18n_redirected=zh-Hans; path=/";

    await boot();

    expect(locale()).toBe("zh-Hant");
    expect(localStorage.getItem(PICKED_LOCALE_KEY)).toBeNull();
    expect(document.cookie).not.toContain("i18n_redirected");
  });

  it("carries over a language the visitor picked", async () => {
    setBrowserLanguages(["en-US"]);
    document.cookie = "i18n_redirected=de; path=/";

    await boot();

    expect(locale()).toBe("de");
    expect(localStorage.getItem(PICKED_LOCALE_KEY)).toBe("de");
    expect(document.cookie).not.toContain("i18n_redirected");
  });
});
