import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentTeam from "~/components/tournament/TournamentTeam.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

const CAPTAIN = "76561198000000001";
const MATE = "76561198000000002";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  toast.mockReset();
  vi.restoreAllMocks();
});

const ultimaRatio = {
  id: "entry-1",
  name: null,
  owner_steam_id: CAPTAIN,
  can_recruit: true,
  team_id: "team-1",
  team: { id: "team-1", name: "Ultima Ratio", short_name: "UR" },
};

const fridayMix = {
  id: "entry-2",
  name: "Friday Mix",
  short_name: "FM",
  can_recruit: true,
  team_id: null,
  team: null,
};

async function mountTeam(
  entry: Record<string, unknown>,
  options: {
    organizer?: boolean;
    invites?: Array<Record<string, unknown>>;
    role?: string;
  } = {},
) {
  useAuthStore().me = {
    steam_id: CAPTAIN,
    name: "sniddyus",
    role: options.role ?? "user",
  } as unknown as ReturnType<typeof useAuthStore>["me"];
  const wrapper = await mountSuspended(TournamentTeam, {
    props: {
      tournament: {
        id: "tournament-1",
        status: "RegistrationOpen",
        is_organizer: options.organizer ?? false,
        min_players_per_lineup: 5,
        max_players_per_lineup: 7,
        teams: [],
      },
      team: {
        can_manage: true,
        eligible_at: null,
        checked_in_at: null,
        roster: [
          {
            role: "Member",
            player: { steam_id: CAPTAIN, name: "sniddyus" },
          },
        ],
        invites: options.invites ?? [],
        ...entry,
      },
      expanded: true,
    },
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: { TournamentTeamMemberRow: true, PlayerSearch: true },
      mocks: { e_team_roles: [{ value: "Member", description: "Member" }] },
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountTeam>>;

const search = (wrapper: Wrapper) => wrapper.findComponent(PlayerSearch);

const labels = (wrapper: Wrapper) =>
  wrapper.findAll("span.rounded.border").map((span) => span.text());

describe("TournamentTeam says what adding a player does", () => {
  it("labels a team-backed entry as a team and searches everyone with a team invite", async () => {
    const wrapper = await mountTeam(ultimaRatio);

    expect(labels(wrapper)).toContain("Team");
    expect(labels(wrapper)).not.toContain("Tournament only");
    expect(search(wrapper).props("teamId")).toBeUndefined();
    expect(search(wrapper).props("fallbackTag")).toBe("Team + lineup invite");
    expect(search(wrapper).props("hint")).toBe(
      "Players outside Ultima Ratio get an invite. Accepting it adds them to the team and to this lineup.",
    );
  });

  it("marks players already on the team, who go straight onto the lineup", async () => {
    const wrapper = await mountTeam(ultimaRatio);
    (wrapper.vm as any).teamMemberSteamIds = [MATE];
    await flushPromises();

    expect(search(wrapper).props("tags")).toMatchObject({
      [MATE]: "On the team",
    });
  });

  it("labels a tournament-only team and says its invite is for this tournament", async () => {
    const wrapper = await mountTeam(fridayMix);

    expect(labels(wrapper)).toContain("Tournament only");
    expect(labels(wrapper)).not.toContain("Team");
    expect(search(wrapper).props("fallbackTag")).toBe("Tournament invite");
    expect(search(wrapper).props("hint")).toBe(
      "Players get an invite to Friday Mix, a team for this tournament only.",
    );
  });

  it("keeps the search to the team for a manager who cannot recruit for it", async () => {
    const wrapper = await mountTeam({ ...ultimaRatio, can_recruit: false });

    expect(search(wrapper).props("teamId")).toBe("team-1");
    expect(search(wrapper).props("fallbackTag")).toBeUndefined();
    expect(search(wrapper).props("hint")).toBeUndefined();
  });

  it("tells a tournament's organizer their pick for a tournament-only team is an invite", async () => {
    const wrapper = await mountTeam(fridayMix, { organizer: true });

    expect(search(wrapper).props("fallbackTag")).toBe("Tournament invite");
  });

  it("says nothing about invites to staff, who place players on any team", async () => {
    const wrapper = await mountTeam(fridayMix, {
      organizer: true,
      role: "administrator",
    });

    expect(search(wrapper).props("fallbackTag")).toBeUndefined();
    expect(search(wrapper).props("hint")).toBeUndefined();
  });

  it("says nothing about invites to an organizer, who places players outright", async () => {
    const wrapper = await mountTeam(ultimaRatio, { organizer: true });

    expect(search(wrapper).props("fallbackTag")).toBeUndefined();
    expect(search(wrapper).props("hint")).toBeUndefined();
  });

  it.each([
    [
      ultimaRatio,
      "Doofy has been invited to Ultima Ratio and joins this lineup once they accept",
    ],
    [
      fridayMix,
      "Doofy has been invited to Friday Mix for this tournament and needs to accept first",
    ],
  ])("names the invite in the toast (%#)", async (entry, description) => {
    const wrapper = await mountTeam(entry);
    vi.spyOn(
      (useNuxtApp() as any).$apollo.defaultClient,
      "mutate",
    ).mockResolvedValue({
      data: { insert_tournament_team_roster_one: null },
    });

    await (wrapper.vm as any).addMember({ steam_id: MATE, name: "Doofy" });

    expect(toast).toHaveBeenCalledWith({
      title: "Invite Sent",
      description,
    });
  });

  it.each([
    [ultimaRatio, "Invited to the team and this lineup"],
    [fridayMix, "Invited for this tournament only"],
  ])("labels a pending invite by what it joins (%#)", async (entry, label) => {
    const wrapper = await mountTeam(entry, {
      invites: [{ id: "invite-1", player: { steam_id: MATE, name: "Doofy" } }],
    });

    expect(wrapper.text()).toContain(label);
  });
});
