import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useNotificationStore } from "~/stores/NotificationStore";

const ME = "76561198000000001";

const AVAILABLE = [
  { name: "public.external_matches_enabled", value: "true" },
  { name: "public.supports_imported_highlights", value: "true" },
];

let observers: Array<{ name: string; observer: any }> = [];
let mutate: ReturnType<typeof vi.fn>;

function serve() {
  const client = useApollo().clients!.default;
  const query = client.query.bind(client);

  vi.spyOn(client, "subscribe").mockImplementation(
    (options: any) =>
      ({
        subscribe(observer: any) {
          observers.push({
            name: options.query.definitions[0].name?.value,
            observer,
          });
          return { unsubscribe() {}, closed: false };
        },
      }) as any,
  );
  vi.spyOn(client, "query").mockImplementation((options: any) =>
    options.query.definitions[0].name?.value === "SchemaHasType"
      ? (Promise.resolve({ data: { __type: { name: "t" } } }) as any)
      : query(options),
  );
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(client, "mutate").mockImplementation(mutate as any);
}

async function signIn(settings = AVAILABLE) {
  serve();
  useApplicationSettingsStore().settings = settings;
  useAuthStore().me = { steam_id: ME } as any;
  await flushPromises();
  await flushPromises();
  return useNotificationStore();
}

function answer(name: string, data: unknown) {
  const feed = observers.find((entry) => entry.name === name);
  expect(feed, `${name} subscription`).toBeDefined();
  feed!.observer.next({ data });
}

const dismissals = (keys: string[]) =>
  answer("FeatureSpotlightDismissals", {
    player_dismissals: keys.map((key) => ({ key })),
  });

const matchHistory = (linked: boolean) =>
  answer("FeatureSpotlightMatchHistory", {
    player_steam_match_auth_by_pk: linked ? { steam_id: ME } : null,
  });

afterEach(async () => {
  useAuthStore().me = undefined;
  useApplicationSettingsStore().settings = [];
  await flushPromises();
  observers = [];
  vi.restoreAllMocks();
});

describe("NotificationStore feature spotlight", () => {
  it("waits for the dismissals and the link state before showing", async () => {
    const store = await signIn();
    expect(store.featureSpotlight).toBeNull();

    dismissals([]);
    expect(store.featureSpotlight).toBeNull();

    const before = store.unreadNotificationCount;
    matchHistory(false);

    expect(store.featureSpotlight).toMatchObject({
      key: "auto_highlights",
      to: "/settings/linked-accounts",
    });
    expect(store.unreadNotificationCount).toBe(before + 1);
    expect(store.hasPersonalNotifications).toBe(true);
  });

  it("clears itself once the player links their match history", async () => {
    const store = await signIn();
    dismissals([]);
    matchHistory(false);
    expect(store.featureSpotlight).not.toBeNull();

    matchHistory(true);

    expect(store.featureSpotlight).toBeNull();
  });

  it("is gone at once on dismiss and saves that on the player", async () => {
    const store = await signIn();
    dismissals([]);
    matchHistory(false);

    store.dismissFeatureSpotlight("auto_highlights");

    expect(store.featureSpotlight).toBeNull();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].variables.key).toBe(
      "feature_spotlight:auto_highlights",
    );
  });

  it("stays hidden for a dismissal made on another device", async () => {
    const store = await signIn();
    dismissals(["feature_spotlight:auto_highlights"]);
    matchHistory(false);

    expect(store.featureSpotlight).toBeNull();
  });

  it.each([
    [
      "imported matches get no highlights",
      [{ name: "public.external_matches_enabled", value: "true" }],
    ],
    [
      "match imports are off",
      [{ name: "public.supports_imported_highlights", value: "true" }],
    ],
  ])("never asks the API when %s", async (_case, settings) => {
    const store = await signIn(settings);

    expect(
      observers.filter((entry) => entry.name?.startsWith("FeatureSpotlight")),
    ).toEqual([]);
    expect(store.featureSpotlight).toBeNull();
  });

  it("forgets what it knew when the player signs out", async () => {
    const store = await signIn();
    dismissals([]);
    matchHistory(false);
    expect(store.featureSpotlight).not.toBeNull();

    useAuthStore().me = undefined;
    await flushPromises();

    expect(store.featureSpotlight).toBeNull();
  });
});
