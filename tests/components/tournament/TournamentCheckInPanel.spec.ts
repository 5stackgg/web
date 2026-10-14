import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentCheckInPanel from "~/components/tournament/TournamentCheckInPanel.vue";
import { e_player_roles_enum } from "~/generated/zeus";

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { mutate: vi.fn() } }),
}));

const OWNER = "76561198000000001";
const CAPTAIN = "76561198000000002";
const PLAYER = "76561198000000003";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
});

async function mountPanel(
  viewer: string,
  canManage: boolean,
  { organizer = false, entered = true } = {},
) {
  useAuthStore().me = {
    steam_id: viewer,
    name: "Viewer",
    role: e_player_roles_enum.user,
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(TournamentCheckInPanel, {
    props: {
      tournament: {
        id: "tournament-1",
        status: "RegistrationOpen",
        is_organizer: organizer,
        min_players_per_lineup: 2,
        start: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
      registration: {
        check_in_required: true,
        check_in_setting: "Captains",
        check_in_started: true,
        check_in_ends_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
      teams: entered
        ? [
            {
              id: "entry-1",
              name: "Northwind Academy",
              owner_steam_id: OWNER,
              captain_steam_id: CAPTAIN,
              can_manage: canManage,
              checked_in_at: null,
              roster: [
                {
                  player_steam_id: CAPTAIN,
                  player: { steam_id: CAPTAIN, name: "kappa" },
                },
                {
                  player_steam_id: PLAYER,
                  player: { steam_id: PLAYER, name: "rook" },
                },
              ],
            },
          ]
        : [],
      myTeamId: entered ? "entry-1" : null,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

const checkInButton = (wrapper: Awaited<ReturnType<typeof mountPanel>>) =>
  wrapper.findAll("button").find((button) => button.text() === "Check in");

describe("TournamentCheckInPanel, Captains mode", () => {
  it("lets the captain on the roster check the team in", async () => {
    const wrapper = await mountPanel(CAPTAIN, false);

    expect(checkInButton(wrapper)).toBeDefined();
  });

  it("lets a manager who plays on the team check it in", async () => {
    const wrapper = await mountPanel(PLAYER, true);

    expect(checkInButton(wrapper)).toBeDefined();
  });

  it("tells an owner who does not play that the captain checks the team in", async () => {
    const wrapper = await mountPanel(OWNER, true);

    expect(checkInButton(wrapper)).toBeUndefined();
    expect(wrapper.text()).toContain("Waiting for kappa to check in");
  });

  it("tells a rostered player who is not the captain who checks the team in", async () => {
    const wrapper = await mountPanel(PLAYER, false);

    expect(checkInButton(wrapper)).toBeUndefined();
    expect(wrapper.text()).toContain("Waiting for kappa to check in");
  });

  it("offers an organizer with no entry of their own nothing to press", async () => {
    const wrapper = await mountPanel(OWNER, true, {
      organizer: true,
      entered: false,
    });

    expect(checkInButton(wrapper)).toBeUndefined();
  });

  it("lets an organizer check in an entry of their own they do not play on", async () => {
    const wrapper = await mountPanel(OWNER, true, { organizer: true });

    expect(checkInButton(wrapper)).toBeDefined();
  });
});
