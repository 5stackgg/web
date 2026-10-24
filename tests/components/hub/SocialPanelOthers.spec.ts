import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import SocialPanel from "~/components/hub/SocialPanel.vue";
import OthersPlayersList from "~/components/hub/OthersPlayersList.vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

vi.mock("@vueuse/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vueuse/core")>()),
  useElementVisibility: () => ref(true),
}));

const ME = "76561198000000601";
const FRIEND = "76561198000000602";
const STRANGER = "76561198000000603";
const ASKED = "76561198000000604";
const NEWCOMER = "76561198000000605";

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  const store = useMatchmakingStore();
  store.setLanRoster({ region: null, players: [] });
  store.setOnlineListed(false);
  store.watchOnline(false);
  store.friends = [];
  useAuthStore().me = undefined;
});

const player = (steam_id: string, name: string) => ({ steam_id, name });

function signedIn() {
  useAuthStore().me = { steam_id: ME, name: "me", role: "user" } as any;
  const store = useMatchmakingStore();
  store.friends = [
    { steam_id: FRIEND, name: "friend", status: "Accepted" },
    {
      steam_id: ASKED,
      name: "asked",
      status: "Pending",
      invited_by_steam_id: ME,
    },
  ] as any;
  return store;
}

function atLan() {
  const store = signedIn();
  useApplicationSettingsStore().availableRegions = [
    { value: "vulkan", description: "Vulkan LAN", is_lan: true },
  ] as any;
  store.setLanRoster({
    region: "vulkan",
    players: [
      player(ME, "me"),
      player(FRIEND, "friend"),
      player(STRANGER, "stranger"),
      player(ASKED, "asked"),
    ],
  });
  return store;
}

// Answers page requests from `pages`, keyed by the cursor asked for.
function listed(
  store: ReturnType<typeof useMatchmakingStore>,
  pages: Record<string, { players: Array<any>; next: string | null }>,
) {
  const asked: Array<{ after: string | null; query: string }> = [];
  const watches: Array<boolean> = [];
  store.sendOnlineWatch = (watching: boolean) => {
    watches.push(watching);
  };
  store.sendOnlinePage = (
    requestId: string,
    after: string | null,
    query: string,
  ) => {
    asked.push({ after, query });
    const page = pages[`${after}|${query}`] ?? { players: [], next: null };
    queueMicrotask(() =>
      store.setOnlinePage({ requestId, listed: true, ...page }),
    );
  };
  store.setOnlineListed(true);
  return { asked, watches };
}

describe("the social panel's Others tab", () => {
  it("is not there off a LAN while everyone online isn't listed", async () => {
    signedIn();
    const wrapper = await mountSuspended(SocialPanel, {
      global: { stubs: { PlayersList: true } },
    });
    unmount = () => wrapper.unmount();

    expect(wrapper.find('[data-testid="others-tab"]').exists()).toBe(false);
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(1);
  });

  it("is the LAN tab, counting everyone at the LAN, while nobody else is listed", async () => {
    atLan();
    const wrapper = await mountSuspended(SocialPanel, {
      global: { stubs: { PlayersList: true, OthersPlayersList: true } },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    const tab = wrapper.get('[data-testid="others-tab"]');
    expect(tab.text()).toContain("LAN");
    expect(tab.text()).toContain("4");
  });

  it("is Others, counting who's online outside my circle, while everyone is listed", async () => {
    const store = signedIn();
    store.setOnlineCount(12);
    store.setFriendsOnline([FRIEND]);
    store.setOnlineListed(true);
    const wrapper = await mountSuspended(SocialPanel, {
      global: { stubs: { PlayersList: true, OthersPlayersList: true } },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    const tab = wrapper.get('[data-testid="others-tab"]');
    expect(tab.text()).toContain("Others");
    expect(tab.text()).toContain("10");
  });
});

describe("the Others list", () => {
  async function mountList() {
    const wrapper = await mountSuspended(OthersPlayersList, {
      global: {
        stubs: {
          FriendListItem: {
            props: ["player", "online", "muted"],
            template:
              '<div class="row" :data-online="String(online)">{{ player.name }}</div>',
          },
        },
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  }

  const names = (wrapper: any, section: string) =>
    wrapper
      .findAll(`[data-testid="${section}"] .row`)
      .map((row: any) => row.text());

  it("lists who's at the LAN: not me, not my friends, but someone I asked", async () => {
    atLan();
    const wrapper = await mountList();

    expect(wrapper.get('[data-testid="lan-region"]').text()).toBe(
      "At Vulkan LAN",
    );
    expect(names(wrapper, "lan-players")).toEqual(["stranger", "asked"]);
    expect(wrapper.find('[data-testid="online-players"]').exists()).toBe(false);
  });

  it("shows LAN arrivals as just arrived and a leaver as having left", async () => {
    const store = atLan();
    const wrapper = await mountList();

    store.applyLanPresence({
      region: "vulkan",
      joined: [player(NEWCOMER, "newcomer")],
      left: [STRANGER],
    });
    await flushPromises();

    expect(names(wrapper, "lan-arrived")).toEqual(["newcomer"]);
    expect(
      wrapper.get('[data-left="true"] .row').attributes("data-online"),
    ).toBe("false");
    expect(wrapper.text()).toContain("Left the LAN");
  });

  it("watches everyone online and pages through them as the end comes into view", async () => {
    const store = signedIn();
    const page1 = Array.from({ length: 25 }, (_, index) =>
      player(`7656119800000${String(index).padStart(4, "0")}`, `p${index}`),
    );
    const { asked, watches } = listed(store, {
      "null|": { players: page1, next: "cursor-1" },
      "cursor-1|": { players: [player(STRANGER, "last")], next: null },
    });

    const wrapper = await mountList();
    await flushPromises();

    expect(watches).toEqual([true]);
    expect(asked).toEqual([
      { after: null, query: "" },
      { after: "cursor-1", query: "" },
    ]);
    expect(names(wrapper, "online-players")).toEqual([
      ...page1.map(({ name }) => name),
      "last",
    ]);
    expect(wrapper.find('[data-testid="online-more"]').exists()).toBe(false);

    wrapper.unmount();
    unmount = undefined;
    expect(watches).toEqual([true, false]);
  });

  it("leaves out me, my friends and anyone already in the LAN section", async () => {
    const store = atLan();
    listed(store, {
      "null|": {
        players: [
          player(FRIEND, "friend"),
          player(STRANGER, "stranger"),
          player(NEWCOMER, "newcomer"),
        ],
        next: null,
      },
    });

    const wrapper = await mountList();
    await flushPromises();

    expect(names(wrapper, "lan-players")).toEqual(["stranger", "asked"]);
    expect(names(wrapper, "online-players")).toEqual(["newcomer"]);
    expect(wrapper.get('[data-testid="online-players"]').text()).toContain(
      "Online elsewhere",
    );
  });

  it("says when nobody else is at the LAN or online elsewhere", async () => {
    const store = signedIn();
    useApplicationSettingsStore().availableRegions = [
      { value: "vulkan", description: "Vulkan LAN", is_lan: true },
    ] as any;
    store.setLanRoster({ region: "vulkan", players: [player(ME, "me")] });
    listed(store, { "null|": { players: [], next: null } });

    const wrapper = await mountList();
    await flushPromises();

    expect(wrapper.get('[data-testid="lan-group"]').text()).toContain(
      "Nobody else is here yet",
    );
    expect(wrapper.get('[data-testid="online-players"]').text()).toContain(
      "Nobody else is online",
    );
  });

  it("greys out who went offline and counts arrivals until asked to show them", async () => {
    const store = signedIn();
    const { asked } = listed(store, {
      "null|": { players: [player(STRANGER, "stranger")], next: null },
    });
    const wrapper = await mountList();
    await flushPromises();

    store.applyOnlinePresence({ steam_id: STRANGER, online: false });
    store.applyOnlinePresence({ steam_id: NEWCOMER, online: true });
    store.applyOnlinePresence({ steam_id: FRIEND, online: true });
    await flushPromises();

    expect(
      wrapper.get('[data-left="true"] .row').attributes("data-online"),
    ).toBe("false");
    expect(wrapper.text()).toContain("Went offline");
    const pill = wrapper.get('[data-testid="online-new"]');
    expect(pill.text()).toBe("1 new online · Show");

    await pill.trigger("click");
    await flushPromises();

    expect(asked).toHaveLength(2);
    expect(wrapper.find('[data-testid="online-new"]').exists()).toBe(false);
  });

  it("searches everyone online through the api", async () => {
    vi.useFakeTimers();
    const store = signedIn();
    const { asked } = listed(store, {
      "null|": { players: [player(STRANGER, "stranger")], next: null },
      "null|new": { players: [player(NEWCOMER, "newcomer")], next: null },
    });
    const wrapper = await mountList();
    await flushPromises();

    await wrapper.get("input").setValue("new");
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    vi.useRealTimers();

    expect(asked.at(-1)).toEqual({ after: null, query: "new" });
    expect(names(wrapper, "online-players")).toEqual(["newcomer"]);
  });

  it("stops listing when the api says too many are online", async () => {
    const store = signedIn();
    listed(store, {
      "null|": { players: [player(STRANGER, "stranger")], next: null },
    });
    const wrapper = await mountList();
    await flushPromises();

    store.setOnlineListed(false);
    await flushPromises();

    expect(wrapper.find('[data-testid="online-players"]').exists()).toBe(false);
  });
});
