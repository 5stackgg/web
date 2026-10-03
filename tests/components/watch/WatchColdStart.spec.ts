import { afterEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import WatchColdStart from "~/components/watch/WatchColdStart.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

function signIn(role = "user") {
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;
}

function setRoles(matches: string, tournaments: string) {
  useApplicationSettingsStore().settings = [
    { name: "public.create_matches_role", value: matches },
    { name: "public.create_tournaments_role", value: tournaments },
  ];
}

afterEach(() => {
  useAuthStore().me = undefined as any;
  useApplicationSettingsStore().settings = [];
});

describe("WatchColdStart", () => {
  it("asks a guest to sign in with Steam", async () => {
    const wrapper = await mountSuspended(WatchColdStart);

    expect(wrapper.text()).toContain("No matches on this server yet");
    expect(wrapper.text()).toContain("Sign in with Steam");
    expect(wrapper.find('a[href="/matches/create"]').exists()).toBe(false);
  });

  it("offers a match and a tournament to someone allowed to create both", async () => {
    signIn();
    setRoles("user", "user");

    const wrapper = await mountSuspended(WatchColdStart);

    expect(wrapper.text()).not.toContain("Sign in with Steam");
    expect(wrapper.find('a[href="/matches/create"]').text()).toContain(
      "Start a match",
    );
    expect(wrapper.find('a[href="/tournaments/create"]').text()).toContain(
      "Create a tournament",
    );
  });

  it("hides what the role can't create", async () => {
    signIn();
    setRoles("user", "administrator");

    const wrapper = await mountSuspended(WatchColdStart);

    expect(wrapper.find('a[href="/matches/create"]').exists()).toBe(true);
    expect(wrapper.find('a[href="/tournaments/create"]').exists()).toBe(false);
  });
});
