import { afterEach, beforeEach, describe, expect, it } from "vitest";
import localePlugin from "~/plugins/locale.client";
import {
  resetBrowserLanguages,
  setBrowserLanguages,
} from "../helpers/browserLocale";

const PICKED_LOCALE_KEY = "5stack:locale";

const app = () =>
  useNuxtApp() as unknown as {
    $i18n: {
      locale: { value: string };
      setLocale: (code: string) => Promise<void>;
    };
    _vueI18n: { __firstAccess: boolean };
  };

const locale = () => app().$i18n.locale.value;

async function boot() {
  app()._vueI18n.__firstAccess = true;
  await (localePlugin as unknown as () => Promise<void>)();
  await new Promise((resolve) => setTimeout(resolve, 10));
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = "i18n_redirected=; max-age=0; path=/";
});

afterEach(async () => {
  resetBrowserLanguages();
  localStorage.clear();
  document.cookie = "i18n_redirected=; max-age=0; path=/";
  await app().$i18n.setLocale("en");
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
