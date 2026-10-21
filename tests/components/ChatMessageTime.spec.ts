import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ChatMessage from "~/components/chat/ChatMessage.vue";
import {
  resetBrowserLanguages,
  setBrowserLanguages,
} from "../helpers/browserLocale";

const NOW = new Date(2026, 9, 20, 15, 40);

const message = (sent: Date, overrides: Record<string, unknown> = {}) => ({
  id: "m-1",
  message: "on my way",
  source: "web",
  timestamp: sent.toISOString(),
  from: { steam_id: "76561198000000001", name: "kairo" },
  ...overrides,
});

const i18n = () => (useNuxtApp() as any).$i18n;

let unmounts: Array<() => void> = [];

beforeEach(() => {
  vi.useFakeTimers({
    now: NOW,
    toFake: ["Date", "setInterval", "clearInterval"],
  });
});

afterEach(async () => {
  for (const unmount of unmounts) {
    unmount();
  }
  unmounts = [];
  vi.useRealTimers();
  resetBrowserLanguages();
  await i18n().setLocale("en");
});

async function mountLine(sent: Date, overrides: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(ChatMessage, {
    props: { message: message(sent, overrides) },
  });
  unmounts.push(() => wrapper.unmount());
  await flushPromises();
  return wrapper;
}

function shown(element: Element | null | undefined) {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function nameLineTime(wrapper: Awaited<ReturnType<typeof mountLine>>) {
  return shown(wrapper.get("h4").element.nextElementSibling);
}

const bands: Array<[string, Date]> = [
  ["59 minutes old", new Date(2026, 9, 20, 14, 41)],
  ["an hour old", new Date(2026, 9, 20, 14, 40)],
  ["from earlier today", new Date(2026, 9, 20, 9, 5)],
  ["from yesterday", new Date(2026, 9, 19, 21, 14)],
  ["from last year", new Date(2025, 9, 18, 21, 14)],
];

describe.each([
  [
    "English on a 12-hour browser",
    "en",
    "en-US",
    [
      "59 minutes ago",
      "2:40 PM",
      "9:05 AM",
      "Mon, Oct 19, 9:14 PM",
      "Sat, Oct 18, 2025, 9:14 PM",
    ],
  ],
  [
    "German on a 24-hour browser",
    "de",
    "de-DE",
    [
      "vor 59 Minuten",
      "14:40",
      "9:05",
      "Mo., 19. Okt., 21:14",
      "Sa., 18. Okt. 2025, 21:14",
    ],
  ],
])("chat message time, %s", (_name, ui, browser, expected) => {
  beforeEach(async () => {
    setBrowserLanguages([browser]);
    await i18n().setLocale(ui);
  });

  it.each(bands.map(([band, sent], index) => [band, sent, index] as const))(
    "a message %s",
    async (_band, sent, index) => {
      const wrapper = await mountLine(sent);

      await vi.waitFor(() =>
        expect(nameLineTime(wrapper)).toBe(expected[index]),
      );
    },
  );
});

describe("chat message time as the clock runs", () => {
  beforeEach(() => {
    setBrowserLanguages(["en-US"]);
  });

  it("turns from minutes ago to the time of day once the message is an hour old", async () => {
    const wrapper = await mountLine(new Date(2026, 9, 20, 14, 41));

    expect(nameLineTime(wrapper)).toBe("59 minutes ago");

    await vi.advanceTimersByTimeAsync(61_000);

    expect(nameLineTime(wrapper)).toBe("2:41 PM");
  });

  it("never reads 1 hour ago on the way there", async () => {
    const wrapper = await mountLine(new Date(2026, 9, 20, 14, 40, 35));
    const seen = [nameLineTime(wrapper)];

    for (let second = 0; second < 60; second++) {
      await vi.advanceTimersByTimeAsync(1000);
      if (nameLineTime(wrapper) !== seen.at(-1)) {
        seen.push(nameLineTime(wrapper));
      }
    }

    expect(seen).toEqual(["59 minutes ago", "2:40 PM"]);
  });

  it("adds the day and date once the day it was sent is over", async () => {
    vi.setSystemTime(new Date(2026, 9, 20, 23, 59, 30));
    const wrapper = await mountLine(new Date(2026, 9, 20, 13, 5));

    expect(nameLineTime(wrapper)).toBe("1:05 PM");

    await vi.advanceTimersByTimeAsync(60_000);

    expect(nameLineTime(wrapper)).toBe("Tue, Oct 20, 1:05 PM");
  });

  it("does the same for the time under the name when a GIF leads", async () => {
    const wrapper = await mountLine(new Date(2026, 9, 20, 12, 40), {
      message: "",
      gif: { id: "abc123", width: 480, height: 270 },
    });

    expect(shown(wrapper.find("[data-chat-media-time]").element)).toBe(
      "12:40 PM",
    );
  });
});
