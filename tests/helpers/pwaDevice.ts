import { vi } from "vitest";
import { clearNuxtState, useNuxtApp } from "#imports";

export const userAgents = {
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
  androidWebView:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36",
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  desktopChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};

export function emulateDevice({
  userAgent,
  width = 1280,
  standalone = false,
}: {
  userAgent: string;
  width?: number;
  standalone?: boolean;
}) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
    const maxWidth = query.match(/max-width:\s*(\d+)px/);
    const matches = query.includes("display-mode: standalone")
      ? standalone
      : maxWidth
        ? width <= Number(maxWidth[1])
        : false;

    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as MediaQueryList;
  });
}

export function fakePwa({
  showInstallPrompt = false,
  outcome = "dismissed",
}: {
  showInstallPrompt?: boolean;
  outcome?: "accepted" | "dismissed";
} = {}) {
  const pwa = useNuxtApp().$pwa!;
  const original = {
    install: pwa.install,
    showInstallPrompt: pwa.showInstallPrompt,
    isPWAInstalled: pwa.isPWAInstalled,
  };

  const install = vi.fn(async () => {
    pwa.showInstallPrompt = false;
    return { outcome, platform: "web" };
  });

  pwa.install = install;
  pwa.showInstallPrompt = showInstallPrompt;
  pwa.isPWAInstalled = false;
  clearNuxtState("pwa-installed-here");

  return {
    install,
    restore() {
      pwa.install = original.install;
      pwa.showInstallPrompt = original.showInstallPrompt;
      pwa.isPWAInstalled = original.isPWAInstalled;
      clearNuxtState("pwa-installed-here");
    },
  };
}
