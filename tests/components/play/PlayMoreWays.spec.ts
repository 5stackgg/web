import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayMoreWays from "~/components/play/PlayMoreWays.vue";
import PlayMoreWaysView from "~/components/play/PlayMoreWaysView.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";

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

const practiceSession = ref<any>(null);
vi.mock("~/composables/useUtilityPracticeSession", () => ({
  useUtilityPracticeSession: () => ({
    session: computed(() => practiceSession.value),
    booting: computed(() => practiceSession.value?.status === "Starting"),
    mapName: computed(() => practiceSession.value?.map_name ?? null),
    switching: computed(() => !!practiceSession.value?.map_changing_at),
    canManage: computed(() => practiceSession.value?.can_manage === true),
  }),
}));

function setSettings(values: Record<string, string>) {
  useApplicationSettingsStore().settings = Object.entries(values).map(
    ([name, value]) => ({ name, value }),
  );
}

afterEach(() => {
  useApplicationSettingsStore().settings = [];
  useAuthStore().me = undefined;
  practiceSession.value = null;
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

describe("PlayMoreWays practice tile and the create matches role", () => {
  function signIn(role: string, createMatchesRole: string) {
    setSettings({
      "public.utility_practice_enabled": "true",
      "public.create_matches_role": createMatchesRole,
    });
    useAuthStore().me = { steam_id: "76561198000000001", role } as any;
  }

  it("offers no practice server to a player below the role the api asks for", async () => {
    signIn("user", "verified_user");

    expect((await viewProps()).practiceEnabled).toBe(false);
  });

  it("offers one to a player at the role", async () => {
    signIn("verified_user", "verified_user");

    expect((await viewProps()).practiceEnabled).toBe(true);
  });

  it("still shows a player below the role the server somebody let them on", async () => {
    signIn("user", "verified_user");
    practiceSession.value = { id: "s-1", status: "Ready", can_manage: false };

    expect((await viewProps()).practiceEnabled).toBe(true);
  });

  it("still asks a guest to sign in for one", async () => {
    setSettings({
      "public.utility_practice_enabled": "true",
      "public.create_matches_role": "verified_user",
    });

    expect((await viewProps()).practiceEnabled).toBe(true);
  });
});
