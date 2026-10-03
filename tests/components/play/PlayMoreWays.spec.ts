import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayMoreWays from "~/components/play/PlayMoreWays.vue";
import PlayMoreWaysView from "~/components/play/PlayMoreWaysView.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const currentSeason = ref<any>(null);
vi.mock("~/composables/useCurrentLeagueSeason", () => ({
  useCurrentLeagueSeason: () => ({ currentSeason }),
}));

function setSettings(values: Record<string, string>) {
  useApplicationSettingsStore().settings = Object.entries(values).map(
    ([name, value]) => ({ name, value }),
  );
}

afterEach(() => {
  useApplicationSettingsStore().settings = [];
});

async function viewProps() {
  const wrapper = await mountSuspended(PlayMoreWays);
  return wrapper.findComponent(PlayMoreWaysView).props();
}

describe("PlayMoreWays feature flags", () => {
  it("offers a practice server only when practice is turned on", async () => {
    setSettings({ "public.utility_practice_enabled": "true" });
    expect((await viewProps()).practiceEnabled).toBe(true);

    setSettings({});
    expect((await viewProps()).practiceEnabled).toBe(false);
  });

  it("drops the scrims card when the scrim finder is off", async () => {
    setSettings({ "public.scrim_finder_enabled": "false" });
    expect((await viewProps()).scrims).toBeNull();
  });

  it("has no league card while leagues are off", async () => {
    currentSeason.value = { id: "s3", status: "RegistrationOpen" };
    setSettings({ "public.leagues_enabled": "false" });
    expect((await viewProps()).league).toBeNull();
    currentSeason.value = null;
  });
});
