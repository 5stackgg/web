import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useRecomputeElo } from "~/composables/useRecomputeElo";
import { useReindexPlayers } from "~/composables/useReindexPlayers";
import { pinBrowserLocale } from "../helpers/browserLocale";

const NOW = Date.parse("2026-10-21T12:00:00Z");

const RUN = {
  running: true,
  canceled: false,
  started_at: new Date(NOW - 60_000).toISOString(),
  finished_at: null,
  total: 70,
  completed: 10,
  failed: 0,
  current_match_id: null,
  current_steam_id: null,
};

vi.mock("@vue/apollo-composable", () => ({
  useApolloClient: () => ({
    client: {
      mutate: async () => ({
        data: {
          recomputePlayerEloStatus: RUN,
          refreshAllPlayersStatus: RUN,
        },
      }),
    },
  }),
}));

pinBrowserLocale("en-US");

const i18n = () =>
  useNuxtApp().$i18n as unknown as { locale: { value: string } };

afterEach(() => {
  vi.useRealTimers();
  i18n().locale.value = "en";
});

describe.each([
  ["recomputing ELO", useRecomputeElo],
  ["reindexing players", useReindexPlayers],
])("the time left %s", (_, use) => {
  it.each([
    ["en", "6m 0s"],
    ["de", "6 Min. 0 Sek."],
  ])("reads in %s", async (locale, expected) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    i18n().locale.value = locale;

    let run!: ReturnType<typeof use>;
    const host = await mountSuspended(
      defineComponent({
        setup() {
          run = use();
          return () => h("div");
        },
      }),
    );
    await run.ensureLoaded();

    expect(run.eta.value).toBe(expected);
    host.unmount();
  });
});
