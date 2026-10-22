import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayersPage from "~/pages/players/index.vue";
import PlayerPeekSheet from "~/components/player/PlayerPeekSheet.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const sidebar = vi.hoisted(() => ({ mobile: false }));

vi.mock("~/components/ui/sidebar/utils", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSidebar: () => ({ isMobile: ref(sidebar.mobile) }),
}));

const ZALRUS = "76561198000000001";
const RAWR = "76561198000000002";

const hits = () => [
  {
    document: {
      steam_id: ZALRUS,
      name: "zalrus",
      role: e_player_roles_enum.verified_user,
      wins: 22,
      losses: 19,
      stats: { kills: 104, deaths: 100 },
      elo_competitive: 4977,
      last_sign_in_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    document: {
      steam_id: RAWR,
      name: "rawr",
      role: e_player_roles_enum.user,
      wins: 0,
      losses: 0,
    },
  },
];

let unmount: (() => void) | undefined;

async function mountPage(viewerRole: e_player_roles_enum, mobile: boolean) {
  sidebar.mobile = mobile;
  useAuthStore().me = {
    steam_id: "76561198000000009",
    name: "Viewer",
    role: viewerRole,
  } as unknown as ReturnType<typeof useAuthStore>["me"];
  const wrapper = await mountSuspended(PlayersPage, { route: "/players" });
  unmount = () => wrapper.unmount();
  await vi.waitFor(() =>
    expect(
      wrapper.findAll("tr").some((row) => row.text().includes("zalrus")),
    ).toBe(true),
  );
  await flushPromises();
  return wrapper;
}

const headers = (wrapper: any) =>
  wrapper.findAll("th").map((th: any) => th.text().trim());

const row = (wrapper: any, name: string) =>
  wrapper.findAll("tr").find((tr: any) => tr.text().includes(name));

beforeEach(() => {
  localStorage.removeItem("players-filters");
  vi.stubGlobal(
    "$fetch",
    vi.fn((url: string) =>
      url === "/api/players-search"
        ? Promise.resolve({ found: 2, hits: hits() })
        : Promise.reject(new Error(`unexpected ${url}`)),
    ),
  );
});

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  vi.unstubAllGlobals();
  useAuthStore().me = undefined;
  localStorage.removeItem("players-filters");
  await flushPromises();
});

describe("players page on a phone", () => {
  it("gives staff Player, Elo and Seen, with the privilege under the name", async () => {
    const wrapper = await mountPage(e_player_roles_enum.administrator, true);

    expect(headers(wrapper)).toEqual(["Player", "Elo", "Seen"]);
    expect(row(wrapper, "zalrus").text()).toContain("Verified User");
    expect(row(wrapper, "zalrus").text()).toContain("3h");
  });

  it("opens a staff member's tap in the player sheet, not the profile", async () => {
    const wrapper = await mountPage(e_player_roles_enum.administrator, true);
    const sheet = wrapper.findComponent(PlayerPeekSheet);

    expect(row(wrapper, "zalrus").find("a[href]").exists()).toBe(false);
    expect(sheet.props("open")).toBe(false);

    await row(wrapper, "zalrus").trigger("click");

    expect(sheet.props("open")).toBe(true);
    expect(sheet.props("player")?.name).toBe("zalrus");
    expect(sheet.props("kd")).toBe("1.04");
  });

  it("gives a player Player, K/D and Elo, with the record under the name", async () => {
    const wrapper = await mountPage(e_player_roles_enum.user, true);

    expect(headers(wrapper)).toEqual(["Player", "KDR", "Elo"]);
    expect(row(wrapper, "zalrus").text()).toContain("W–L 22–19");
    expect(row(wrapper, "rawr").text()).toContain("No matches yet");
  });

  it("sends a player's tap straight to the profile", async () => {
    const wrapper = await mountPage(e_player_roles_enum.user, true);

    expect(row(wrapper, "zalrus").find("a[href]").attributes("href")).toBe(
      `/players/${ZALRUS}`,
    );

    await row(wrapper, "zalrus").trigger("click");

    expect(wrapper.findComponent(PlayerPeekSheet).props("open")).toBe(false);
  });
});

describe("players page on a desktop", () => {
  it("keeps every column for staff", async () => {
    const wrapper = await mountPage(e_player_roles_enum.administrator, false);

    expect(headers(wrapper)).toEqual([
      "Player",
      "Wins",
      "Losses",
      "KDR",
      "Elo",
      "Privilege",
      "Last Sign In At",
    ]);
    expect(row(wrapper, "zalrus").text()).toContain("3 hours ago");
  });
});
