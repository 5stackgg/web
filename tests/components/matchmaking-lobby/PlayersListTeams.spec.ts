import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayersList from "~/components/matchmaking-lobby/PlayersList.vue";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useAuthStore } from "~/stores/AuthStore";

const ME = "76561198000000701";
const ONLINE = "76561198000000702";
const OFFLINE = "76561198000000703";
const FRIEND = "76561198000000704";

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  const store = useMatchmakingStore();
  store.myTeams = [];
  store.friends = [];
  useAuthStore().me = undefined;
});

const member = (steam_id: string, name: string) => ({
  player: { steam_id, name },
});

const austrianForce = {
  id: "team-1",
  name: "Austrian Force",
  roster: [member(ME, "me"), member(OFFLINE, "wiesel"), member(ONLINE, "alex")],
};

async function mountList() {
  const InProvider = defineComponent({
    render: () => h(TooltipProvider, () => h(PlayersList)),
  });
  const wrapper = await mountSuspended(InProvider, {
    global: {
      stubs: {
        FriendListItem: {
          props: ["player", "muted"],
          template:
            '<div class="team-row" :data-muted="String(muted)">{{ player.name }}</div>',
        },
      },
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

describe("teams in the friends list", () => {
  it("lists each team I'm on with its other members, online first", async () => {
    useAuthStore().me = { steam_id: ME, name: "me", role: "user" } as any;
    const store = useMatchmakingStore();
    store.ensureMyTeams = () => {};
    store.friends = [];
    store.myTeams = [
      {
        id: "team-1",
        name: "Austrian Force",
        roster: [
          member(ME, "me"),
          member(OFFLINE, "wiesel"),
          member(ONLINE, "alex"),
        ],
      },
      { id: "team-2", name: "Just Me", roster: [member(ME, "me")] },
    ] as any;
    store.setFriendsOnline([ONLINE]);

    const InProvider = defineComponent({
      render: () => h(TooltipProvider, () => h(PlayersList)),
    });
    const wrapper = await mountSuspended(InProvider, {
      global: {
        stubs: {
          FriendListItem: {
            props: ["player", "muted"],
            template:
              '<div class="team-row" :data-muted="String(muted)">{{ player.name }}</div>',
          },
        },
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain("Team · Austrian Force");
    expect(text).toContain("1/2");
    expect(text).not.toContain("Just Me");
    expect(
      wrapper
        .findAll(".team-row")
        .map((row) => [row.text(), row.attributes("data-muted")]),
    ).toEqual([
      ["alex", "false"],
      ["wiesel", "true"],
    ]);
  });

  it("sits below the offline friends", async () => {
    useAuthStore().me = { steam_id: ME, name: "me", role: "user" } as any;
    const store = useMatchmakingStore();
    store.ensureMyTeams = () => {};
    store.friends = [
      { steam_id: FRIEND, name: "bob", status: "Accepted" },
    ] as any;
    store.myTeams = [austrianForce] as any;
    store.setFriendsOnline([ONLINE]);

    const text = (await mountList()).text();
    expect(text.indexOf("Offline")).toBeGreaterThan(-1);
    expect(text.indexOf("Team · Austrian Force")).toBeGreaterThan(
      text.indexOf("bob"),
    );
  });

  it("folds a team shut, remembers it, and opens it while searching", async () => {
    useAuthStore().me = { steam_id: ME, name: "me", role: "user" } as any;
    const store = useMatchmakingStore();
    store.ensureMyTeams = () => {};
    store.friends = [];
    store.myTeams = [austrianForce] as any;
    store.setFriendsOnline([ONLINE]);

    let wrapper = await mountList();
    const toggle = () => wrapper.find("button[aria-expanded]");
    expect(toggle().attributes("aria-expanded")).toBe("true");

    await toggle().trigger("click");
    expect(toggle().attributes("aria-expanded")).toBe("false");
    expect(wrapper.findAll(".team-row")).toHaveLength(0);
    expect(wrapper.text()).toContain("1/2");
    expect(localStorage.getItem("hub-friends-collapsed-teams")).toContain(
      "team-1",
    );

    unmount?.();
    wrapper = await mountList();
    expect(toggle().attributes("aria-expanded")).toBe("false");

    await wrapper.find("input").setValue("wie");
    await nextTick();
    expect(wrapper.findAll(".team-row").map((row) => row.text())).toEqual([
      "wiesel",
    ]);

    await wrapper.find("input").setValue("");
    await toggle().trigger("click");
    expect(wrapper.findAll(".team-row")).toHaveLength(2);
  });
});
