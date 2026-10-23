import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayersList from "~/components/matchmaking-lobby/PlayersList.vue";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useAuthStore } from "~/stores/AuthStore";

const ME = "76561198000000701";
const ONLINE = "76561198000000702";
const OFFLINE = "76561198000000703";

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
});
