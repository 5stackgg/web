// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Only the pure status rule is under test; nothing here may reach Apollo.
vi.mock("~/stores/ApplicationSettings", () => ({
  useApplicationSettingsStore: vi.fn(),
}));
vi.mock("~/composables/useRecomputeElo", () => ({ useRecomputeElo: vi.fn() }));
vi.mock("~/composables/useReindexPlayers", () => ({
  useReindexPlayers: vi.fn(),
}));
vi.mock("~/composables/useReparseAllDemos", () => ({
  useReparseAllDemos: vi.fn(),
}));

import {
  settingsItemStatus,
  type SettingsStatusContext,
} from "~/composables/useSettingsStatus";

const context = (
  overrides: Partial<SettingsStatusContext> = {},
): SettingsStatusContext => ({
  settings: [],
  loaded: true,
  jobs: {},
  ...overrides,
});

const news = { path: "/settings/application/news" };
const twitch = {
  path: "/settings/application/twitch",
  requires: "public.supports_twitch",
};
const players = {
  path: "/settings/application/players",
  jobs: ["elo", "reindex"] as const,
};

describe("settingsItemStatus", () => {
  it("shows no setup warning until the settings have arrived", () => {
    expect(
      settingsItemStatus(twitch, context({ loaded: false })).attention,
    ).toBe(false);
  });

  it("says nothing about a feature's switch, on or off", () => {
    expect(settingsItemStatus(news, context()).chip).toBeNull();
    expect(
      settingsItemStatus(
        news,
        context({ settings: [{ name: "public.news_enabled", value: "true" }] }),
      ).chip,
    ).toBeNull();
  });

  it("flags a section whose required setup is missing", () => {
    const missing = settingsItemStatus(twitch, context());
    expect(missing.attention).toBe(true);
    expect(missing.chip).toEqual({ tone: "attention" });

    const done = settingsItemStatus(
      twitch,
      context({
        settings: [{ name: "public.supports_twitch", value: "true" }],
      }),
    );
    expect(done.attention).toBe(false);
    expect(done.chip).toBeNull();
  });

  it("shows a running job's percent first", () => {
    const status = settingsItemStatus(
      { ...players, jobs: [...players.jobs] },
      context({ jobs: { elo: null, reindex: 42 } }),
    );
    expect(status.chip).toEqual({ tone: "job", job: "reindex", pct: 42 });
  });

  it("says nothing about a plain section", () => {
    expect(
      settingsItemStatus({ path: "/settings/application/teams" }, context()),
    ).toEqual({ chip: null, attention: false });
  });
});
