import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import SocialPanel from "~/components/hub/SocialPanel.vue";
import LanPlayersList from "~/components/hub/LanPlayersList.vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

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
  store.friends = [];
  useAuthStore().me = undefined;
});

const player = (steam_id: string, name: string) => ({ steam_id, name });

function atLan() {
  useAuthStore().me = { steam_id: ME, name: "me", role: "user" } as any;
  useApplicationSettingsStore().availableRegions = [
    { value: "vulkan", description: "Vulkan LAN", is_lan: true },
  ] as any;
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

describe("the social panel's LAN tab", () => {
  it("is not there when this tab isn't on a LAN", async () => {
    const wrapper = await mountSuspended(SocialPanel, {
      global: { stubs: { PlayersList: true } },
    });
    unmount = () => wrapper.unmount();

    expect(wrapper.find('[data-testid="lan-tab"]').exists()).toBe(false);
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(1);
  });

  it("counts everyone at the LAN the api says this tab is on", async () => {
    atLan();
    const wrapper = await mountSuspended(SocialPanel, {
      global: { stubs: { PlayersList: true, LanPlayersList: true } },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    const tab = wrapper.get('[data-testid="lan-tab"]');
    expect(tab.text()).toContain("LAN");
    expect(tab.text()).toContain("4");
  });
});

describe("the LAN list", () => {
  async function mountList() {
    const wrapper = await mountSuspended(LanPlayersList, {
      global: {
        stubs: {
          FriendListItem: {
            props: ["player", "online", "muted"],
            template:
              '<div class="lan-row" :data-online="String(online)">{{ player.name }}</div>',
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
      .findAll(`[data-testid="${section}"] .lan-row`)
      .map((row: any) => row.text());

  it("lists who's at the LAN like Others did: not me, not my friends, but someone I asked", async () => {
    atLan();
    const wrapper = await mountList();

    expect(wrapper.get('[data-testid="lan-region"]').text()).toBe("Vulkan LAN");
    expect(names(wrapper, "lan-players")).toEqual(["stranger", "asked"]);
  });

  it("shows arrivals as just arrived and a leaver as having left", async () => {
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
      wrapper.get('[data-left="true"] .lan-row').attributes("data-online"),
    ).toBe("false");
    expect(wrapper.text()).toContain("Left the LAN");
  });
});
