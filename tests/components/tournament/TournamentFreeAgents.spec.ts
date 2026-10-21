import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TournamentFreeAgents from "~/components/tournament/TournamentFreeAgents.vue";

const pool = ref<Array<Record<string, unknown>>>([]);
const { mutate, toast } = vi.hoisted(() => ({
  mutate: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query: vi.fn(), mutate } }),
  useSubscription: () => ({
    result: ref({ tournament_free_agents: pool.value }),
  }),
}));

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  pool.value = [];
  mutate.mockReset();
  toast.mockReset();
  document.body.innerHTML = "";
});

function agent(steamId: string, player: Record<string, unknown>) {
  return {
    id: `agent-${steamId}`,
    status: "registered",
    created_at: "2026-10-01T12:00:00Z",
    tournament_team_id: null,
    tournament_team: null,
    player: { steam_id: steamId, name: `Player ${steamId}`, ...player },
  };
}

async function mountPool(
  myTeam: Record<string, unknown> | null = null,
  status = "RegistrationOpen",
) {
  const wrapper = await mountSuspended(TournamentFreeAgents, {
    props: {
      tournament: {
        id: "tournament-1",
        status,
        min_players_per_lineup: 2,
        max_players_per_lineup: 2,
        is_organizer: false,
      },
      myTeam,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

describe("TournamentFreeAgents", () => {
  it("shows each free agent's Premier and FACEIT ranks", async () => {
    pool.value = [
      agent("76561198000000001", {
        premier_rank: 18234,
        faceit_skill_level: 7,
        faceit_elo: 1650,
      }),
    ];

    const wrapper = await mountPool();

    expect(wrapper.text()).toContain((18234).toLocaleString());
    expect(wrapper.find('[title^="Faceit"]').exists()).toBe(true);
  });

  it("leaves the ranks out for a free agent who has none", async () => {
    pool.value = [agent("76561198000000002", {})];

    const wrapper = await mountPool();

    expect(wrapper.text()).toContain("Player 76561198000000002");
    expect(wrapper.find('[title^="Faceit"]').exists()).toBe(false);
  });

  describe("recruiting", () => {
    const captainsTeam = (overrides: Record<string, unknown> = {}) => ({
      id: "team-1",
      can_manage: true,
      roster: [{ player: { steam_id: "76561198000000099" } }],
      invites: [],
      ...overrides,
    });

    const inviteButton = (wrapper: Awaited<ReturnType<typeof mountPool>>) =>
      wrapper.findAll("button").find((button) => button.text() === "Invite");

    it("lets a captain with an open seat invite a free agent", async () => {
      pool.value = [agent("76561198000000003", {})];
      mutate.mockResolvedValue({
        data: { insert_tournament_team_roster_one: null },
      });

      const wrapper = await mountPool(captainsTeam());
      const button = inviteButton(wrapper);
      expect(button).toBeDefined();
      await button?.trigger("click");
      await flushPromises();

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(mutate.mock.calls[0][0])).toContain(
        "insert_tournament_team_roster_one",
      );
    });

    it("shows a free agent the team already invited as invited", async () => {
      pool.value = [agent("76561198000000003", {})];

      const wrapper = await mountPool(
        captainsTeam({
          invites: [{ id: "invite-1", player: { steam_id: "76561198000000003" } }],
        }),
      );

      expect(inviteButton(wrapper)).toBeUndefined();
      expect(wrapper.text()).toContain("Invited");
    });

    it("does not offer an invite once the team is full", async () => {
      pool.value = [agent("76561198000000003", {})];

      const wrapper = await mountPool(
        captainsTeam({
          roster: [
            { player: { steam_id: "76561198000000098" } },
            { player: { steam_id: "76561198000000099" } },
          ],
        }),
      );

      expect(inviteButton(wrapper)).toBeUndefined();
    });

    it("does not offer an invite once registration has closed", async () => {
      pool.value = [agent("76561198000000003", {})];

      const wrapper = await mountPool(captainsTeam(), "RegistrationClosed");

      expect(inviteButton(wrapper)).toBeUndefined();
    });

    it("does not offer an invite to someone who cannot manage a team", async () => {
      pool.value = [agent("76561198000000003", {})];

      const wrapper = await mountPool(captainsTeam({ can_manage: false }));

      expect(inviteButton(wrapper)).toBeUndefined();
    });

    it("does not offer an invite onto a team-backed entry without the right to recruit for it", async () => {
      pool.value = [agent("76561198000000003", {})];

      const wrapper = await mountPool(
        captainsTeam({ team_id: "squad", can_recruit: false }),
      );

      expect(inviteButton(wrapper)).toBeUndefined();
    });

    it.each([
      [
        {
          team_id: "squad",
          can_recruit: true,
          invites_join_team: true,
          team: { name: "Ultima Ratio" },
        },
        "Player 76561198000000003 has been invited to Ultima Ratio and joins this lineup once they accept",
      ],
      [
        {
          team_id: "squad",
          can_recruit: true,
          invites_join_team: false,
          team: { name: "Ultima Ratio" },
        },
        "Player 76561198000000003 has been invited to stand in for Ultima Ratio in this tournament and needs to accept first",
      ],
      [
        { name: "Friday Mix" },
        "Player 76561198000000003 has been invited to Friday Mix for this tournament and needs to accept first",
      ],
    ])("names what the invite joins in its toast (%#)", async (team, description) => {
      pool.value = [agent("76561198000000003", {})];
      mutate.mockResolvedValue({
        data: { insert_tournament_team_roster_one: null },
      });

      const wrapper = await mountPool(captainsTeam(team));
      await inviteButton(wrapper)?.trigger("click");
      await flushPromises();

      expect(toast).toHaveBeenCalledWith({ title: "Invite Sent", description });
    });

  });

  describe("after the draft", () => {
    const drafted = (steamId: string) => ({
      ...agent(steamId, {}),
      status: "drafted",
      tournament_team_id: "pickup-1",
      tournament_team: { id: "pickup-1", name: "Team 1" },
    });

    it("lists only the players still waiting", async () => {
      pool.value = [
        drafted("76561198000000004"),
        { ...agent("76561198000000005", {}), status: "waitlisted" },
      ];

      const wrapper = await mountPool();

      expect(wrapper.text()).not.toContain("Player 76561198000000004");
      expect(wrapper.text()).toContain("Player 76561198000000005");
      expect(wrapper.text()).toContain("1 on the waitlist");
    });

    it("says nobody is waiting once everyone was drafted", async () => {
      pool.value = [drafted("76561198000000004")];

      const wrapper = await mountPool();

      expect(wrapper.text()).toContain("Nobody is waiting");
      expect(wrapper.text()).not.toContain("Player 76561198000000004");
    });
  });

  describe("organizer pool controls", () => {
    const LOCKED =
      "Free agents can change while registration is open or during check-in review.";

    async function mountAsOrganizer(
      status: string,
      tournament: Record<string, unknown> = {},
    ) {
      const wrapper = await mountSuspended(TournamentFreeAgents, {
        props: {
          tournament: {
            id: "tournament-1",
            status,
            min_players_per_lineup: 2,
            max_players_per_lineup: 2,
            is_organizer: true,
            teams: [],
            ...tournament,
          },
          myTeam: null,
        },
      });
      unmount = () => wrapper.unmount();
      await flushPromises();
      return wrapper;
    }

    type Wrapper = Awaited<ReturnType<typeof mountAsOrganizer>>;

    const addSearch = (wrapper: Wrapper) => wrapper.findComponent(PlayerSearch);

    const lockedAdd = (wrapper: Wrapper) =>
      wrapper
        .findAll("button")
        .find((button) => button.text().includes("Add Free Agent"));

    const removeButton = (wrapper: Wrapper, steamId: string) =>
      wrapper.find(`button[aria-label="Remove Player ${steamId}"]`);

    const confirmRemove = () =>
      Array.from(
        document.body.querySelectorAll<HTMLButtonElement>(
          '[role="alertdialog"] button',
        ),
      ).find((button) => button.textContent?.trim() === "Remove");

    const sent = () =>
      mutate.mock.calls.map(([{ mutation }]) => print(mutation));

    it.each(["Setup", "RegistrationOpen", "CheckInReview"])(
      "lets an organizer add and remove free agents in %s",
      async (status) => {
        pool.value = [agent("76561198000000006", {})];

        const wrapper = await mountAsOrganizer(status);

        expect(addSearch(wrapper).exists()).toBe(true);
        expect(addSearch(wrapper).props("label")).toBe("Add Free Agent");
        expect(removeButton(wrapper, "76561198000000006").exists()).toBe(true);
      },
    );

    it("puts Add above an empty pool", async () => {
      const wrapper = await mountAsOrganizer("RegistrationOpen");

      expect(addSearch(wrapper).exists()).toBe(true);
      expect(wrapper.text()).toContain("No free agents yet");
    });

    it("shows Add disabled with the reason once registration closes", async () => {
      pool.value = [agent("76561198000000006", {})];

      const wrapper = await mountAsOrganizer("RegistrationClosed");

      expect(addSearch(wrapper).exists()).toBe(false);
      expect(lockedAdd(wrapper)?.attributes("disabled")).toBeDefined();
      expect(wrapper.find(`[role="img"][aria-label="${LOCKED}"]`).exists()).toBe(
        true,
      );
      expect(removeButton(wrapper, "76561198000000006").exists()).toBe(false);
    });

    it.each(["Live", "Paused", "Finished"])(
      "hides the controls once the tournament is %s",
      async (status) => {
        pool.value = [
          { ...agent("76561198000000006", {}), status: "waitlisted" },
        ];

        const wrapper = await mountAsOrganizer(status);

        expect(addSearch(wrapper).exists()).toBe(false);
        expect(lockedAdd(wrapper)).toBeUndefined();
        expect(removeButton(wrapper, "76561198000000006").exists()).toBe(
          false,
        );
      },
    );

    it("gives players who are not organizers neither control", async () => {
      pool.value = [agent("76561198000000006", {})];

      const wrapper = await mountPool(null, "RegistrationOpen");

      expect(addSearch(wrapper).exists()).toBe(false);
      expect(removeButton(wrapper, "76561198000000006").exists()).toBe(false);
    });

    it("greys out players already in the pool or on a team", async () => {
      pool.value = [agent("76561198000000006", {})];

      const wrapper = await mountAsOrganizer("RegistrationOpen", {
        teams: [
          {
            id: "team-1",
            name: "Iron Wolves",
            roster: [{ player: { steam_id: "76561198000000007" } }],
          },
        ],
      });

      expect(addSearch(wrapper).props("ineligible")).toEqual({
        "76561198000000006": "Already in the free agent pool.",
        "76561198000000007": "Already rostered on Iron Wolves in this tournament.",
      });
    });

    it("adds the picked player to this tournament's pool", async () => {
      mutate.mockResolvedValue({
        data: { addTournamentFreeAgent: { success: true } },
      });
      const wrapper = await mountAsOrganizer("RegistrationOpen");

      addSearch(wrapper).vm.$emit("selected", {
        steam_id: "76561198000000008",
        name: "mono",
      });
      await flushPromises();

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(sent()[0]).toContain("addTournamentFreeAgent");
      expect(sent()[0]).toContain('tournament_id: "tournament-1"');
      expect(sent()[0]).toContain('steam_id: "76561198000000008"');
    });

    it("shows the api's reason when an add is refused", async () => {
      mutate.mockRejectedValue(
        new Error(
          "that player is already in this tournament's free agent pool",
        ),
      );
      const wrapper = await mountAsOrganizer("RegistrationOpen");

      addSearch(wrapper).vm.$emit("selected", {
        steam_id: "76561198000000008",
        name: "mono",
      });
      await flushPromises();

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description:
            "that player is already in this tournament's free agent pool",
        }),
      );
    });

    it("asks first, then removes that player from this tournament's pool", async () => {
      mutate.mockResolvedValue({
        data: { removeTournamentFreeAgent: { success: true } },
      });
      pool.value = [
        { ...agent("76561198000000006", {}), status: "waitlisted" },
      ];
      const wrapper = await mountAsOrganizer("CheckInReview");

      await removeButton(wrapper, "76561198000000006").trigger("click");
      await flushPromises();

      expect(document.body.textContent).toContain(
        "Remove Player 76561198000000006 from free agents?",
      );
      expect(mutate).not.toHaveBeenCalled();

      confirmRemove()!.click();
      await flushPromises();

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(sent()[0]).toContain("removeTournamentFreeAgent");
      expect(sent()[0]).toContain('tournament_id: "tournament-1"');
      expect(sent()[0]).toContain('steam_id: "76561198000000006"');
    });

    it("shows the api's reason when a removal is refused", async () => {
      mutate.mockRejectedValue(
        new Error(
          "only a registered or waitlisted free agent can be removed from the pool",
        ),
      );
      pool.value = [agent("76561198000000006", {})];
      const wrapper = await mountAsOrganizer("RegistrationOpen");

      await removeButton(wrapper, "76561198000000006").trigger("click");
      await flushPromises();
      confirmRemove()!.click();
      await flushPromises();

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description:
            "only a registered or waitlisted free agent can be removed from the pool",
        }),
      );
    });

    it("never offers Remove on a drafted player", async () => {
      pool.value = [
        {
          ...agent("76561198000000004", {}),
          status: "drafted",
          tournament_team_id: "pickup-1",
          tournament_team: { id: "pickup-1", name: "Team 1" },
        },
        agent("76561198000000006", {}),
      ];

      const wrapper = await mountAsOrganizer("RegistrationOpen");

      expect(wrapper.text()).toContain("Player 76561198000000004");
      expect(removeButton(wrapper, "76561198000000004").exists()).toBe(false);
      expect(removeButton(wrapper, "76561198000000006").exists()).toBe(true);
    });
  });
});
