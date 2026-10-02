import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import BracketNegotiation from "~/components/tournament/BracketNegotiation.vue";
import ProposeTimeDialog from "~/components/league/ProposeTimeDialog.vue";
import ProposeTimeForm from "~/components/league/ProposeTimeForm.vue";
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import { useAuthStore } from "~/stores/AuthStore";
import {
  PROPOSE_TIME_MUTATION,
  RESPOND_PROPOSAL_MUTATION,
} from "~/graphql/leagues";

const CAPTAIN_1 = "76561198000000001";
const CAPTAIN_2 = "76561198000000002";
const OWNER_1 = "76561198000000003";
const SPECTATOR = "76561198000000005";

const TEAMS: Record<string, any> = {
  "team-1": {
    id: "team-1",
    owner_steam_id: OWNER_1,
    captain_steam_id: CAPTAIN_1,
    roster: [],
  },
  "team-2": {
    id: "team-2",
    owner_steam_id: CAPTAIN_2,
    captain_steam_id: CAPTAIN_2,
    roster: [],
  },
};

const ROUND_WINDOW = {
  round: 2,
  opens_at: "2099-10-01T00:00:00.000Z",
  closes_at: "2099-10-04T23:00:00.000Z",
  default_match_at: null,
};

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "proposal-1",
    proposed_time: "2099-10-03T20:00:00.000Z",
    status: "Pending",
    message: "after work works best for us",
    proposed_by_steam_id: CAPTAIN_1,
    proposed_by: { steam_id: CAPTAIN_1, name: "kairo" },
    ...overrides,
  };
}

function bracket(overrides: Record<string, any> = {}) {
  return {
    id: "bracket-1",
    round: 2,
    match_number: 2,
    bye: false,
    finished: false,
    scheduled_at: null,
    team_1: {
      id: "tt-1",
      name: "Iron Wolves",
      team_id: "team-1",
      team: { name: "Iron Wolves" },
    },
    team_2: {
      id: "tt-2",
      name: "Night Owls",
      team_id: "team-2",
      team: { name: "Night Owls" },
    },
    match: null,
    scheduling_proposals: [],
    ...overrides,
  };
}

let query: ReturnType<typeof vi.fn>;
let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;

function signIn(steamId: string | null, managedTeamIds: string[] = []) {
  useAuthStore().me = steamId
    ? ({ steam_id: steamId, role: "user" } as any)
    : (undefined as any);
  query.mockResolvedValue({
    data: { teams: managedTeamIds.map((id) => TEAMS[id]) },
  });
}

beforeEach(() => {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  query = vi.fn();
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(client, "query").mockImplementation(query);
  vi.spyOn(client, "mutate").mockImplementation(mutate);
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.restoreAllMocks();
  useAuthStore().me = undefined as any;
});

async function mountNegotiation(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(BracketNegotiation, {
    props: {
      bracket: bracket(),
      windows: [ROUND_WINDOW],
      title: "Round 2 Match 2",
      bestOf: 3,
      ...props,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountNegotiation>>;

function chip(wrapper: Wrapper) {
  return wrapper.find('[data-testid="negotiation-status"]');
}

async function openDialog(wrapper: Wrapper) {
  const open = wrapper
    .findAll("button")
    .find((button) => button.text().includes("Schedule"));
  expect(open, "Schedule button").toBeDefined();
  await open!.trigger("click");
  await flushPromises();
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  expect(dialog, "negotiation dialog").not.toBeNull();
  return dialog!;
}

function dialogButton(dialog: HTMLElement, label: string) {
  return Array.from(dialog.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === label,
  );
}

function mutationsOf(document: unknown) {
  return mutate.mock.calls
    .map(([options]) => options)
    .filter((options) => options.mutation === document);
}

describe("BracketNegotiation status chip", () => {
  it("tells the team that has to answer that they were sent a time", async () => {
    signIn(CAPTAIN_2, ["team-2"]);

    const wrapper = await mountNegotiation({
      bracket: bracket({ scheduling_proposals: [proposal()] }),
    });

    expect(chip(wrapper).text()).toBe("They proposed");
    expect(wrapper.text()).toContain("Oct 3");
  });

  it("tells the proposer it is waiting on the other team", async () => {
    signIn(CAPTAIN_1, ["team-1"]);

    const wrapper = await mountNegotiation({
      bracket: bracket({ scheduling_proposals: [proposal()] }),
    });

    expect(chip(wrapper).text()).toBe("Awaiting opponent");
  });

  it("tells the proposer's teammate it is waiting on the other team", async () => {
    signIn(OWNER_1, ["team-1"]);

    const wrapper = await mountNegotiation({
      bracket: bracket({ scheduling_proposals: [proposal()] }),
    });

    expect(chip(wrapper).text()).toBe("Awaiting opponent");
    const dialog = await openDialog(wrapper);
    expect(dialogButton(dialog, "Accept")).toBeUndefined();
  });

  it("locks in an agreed time", async () => {
    signIn(SPECTATOR);

    const wrapper = await mountNegotiation({
      bracket: bracket({ scheduled_at: "2099-10-03T20:00:00.000Z" }),
    });

    expect(chip(wrapper).text()).toBe("Agreed");
    expect(chip(wrapper).find("svg").exists()).toBe(true);
    expect(wrapper.text()).toContain("Oct 3");
  });

  it("flags a bracket nobody has scheduled", async () => {
    signIn(SPECTATOR);

    const wrapper = await mountNegotiation();

    expect(chip(wrapper).text()).toBe("Not scheduled");
  });
});

describe("BracketNegotiation dialog", () => {
  it("lets the other team accept, counter or decline the proposal", async () => {
    signIn(CAPTAIN_2, ["team-2"]);
    const wrapper = await mountNegotiation({
      bracket: bracket({ scheduling_proposals: [proposal()] }),
    });

    const dialog = await openDialog(wrapper);
    expect(dialog.textContent).toContain("Round 2 Match 2");
    expect(dialog.textContent).toContain("Iron Wolves");
    expect(dialog.textContent).toContain("Night Owls");
    expect(dialog.textContent).toContain("after work works best for us");
    expect(dialogButton(dialog, "Counter")).toBeDefined();
    expect(dialogButton(dialog, "Decline")).toBeDefined();

    dialogButton(dialog, "Accept")!.click();
    await flushPromises();

    expect(mutationsOf(RESPOND_PROPOSAL_MUTATION)).toHaveLength(1);
    expect(mutationsOf(RESPOND_PROPOSAL_MUTATION)[0].variables).toEqual({
      proposalId: "proposal-1",
      status: "Accepted",
    });
  });

  it("shows the proposer that the other side has to answer", async () => {
    signIn(CAPTAIN_1, ["team-1"]);
    const wrapper = await mountNegotiation({
      bracket: bracket({ scheduling_proposals: [proposal()] }),
    });

    const dialog = await openDialog(wrapper);

    expect(dialog.textContent).toContain("Waiting on opponent");
    expect(dialogButton(dialog, "Accept")).toBeUndefined();
    expect(dialogButton(dialog, "Propose new time")).toBeDefined();
  });

  it("counters by proposing the new time and marking the standing one Countered", async () => {
    signIn(CAPTAIN_2, ["team-2"]);
    const wrapper = await mountNegotiation({
      bracket: bracket({ scheduling_proposals: [proposal()] }),
    });

    const dialog = await openDialog(wrapper);
    dialogButton(dialog, "Counter")!.click();
    await flushPromises();

    const propose = wrapper.findComponent(ProposeTimeDialog);
    expect(propose.exists()).toBe(true);
    propose.vm.$emit("submit", "2099-10-02T19:00:00.000Z", "earlier?");
    await flushPromises();

    expect(mutationsOf(RESPOND_PROPOSAL_MUTATION)[0].variables).toEqual({
      proposalId: "proposal-1",
      status: "Countered",
    });
    expect(mutationsOf(PROPOSE_TIME_MUTATION)[0].variables).toEqual({
      bracketId: "bracket-1",
      proposedTime: "2099-10-02T19:00:00.000Z",
      message: "earlier?",
    });
    const order = mutate.mock.calls.map(([options]) => options.mutation);
    expect(order.indexOf(PROPOSE_TIME_MUTATION)).toBeLessThan(
      order.indexOf(RESPOND_PROPOSAL_MUTATION),
    );
  });

  it("keeps the standing proposal when the counter time is rejected", async () => {
    signIn(CAPTAIN_2, ["team-2"]);
    mutate.mockImplementation(async (options) => {
      if (options.mutation === PROPOSE_TIME_MUTATION) {
        throw new Error("Proposed time is outside the scheduling window");
      }
      return { data: {} };
    });
    const wrapper = await mountNegotiation({
      bracket: bracket({ scheduling_proposals: [proposal()] }),
    });

    const dialog = await openDialog(wrapper);
    dialogButton(dialog, "Counter")!.click();
    await flushPromises();
    wrapper
      .findComponent(ProposeTimeDialog)
      .vm.$emit("submit", "2099-10-09T19:00:00.000Z", "");
    await flushPromises();

    expect(mutationsOf(PROPOSE_TIME_MUTATION)).toHaveLength(1);
    expect(mutationsOf(RESPOND_PROPOSAL_MUTATION)).toHaveLength(0);
  });

  it("feeds the round window and tournament wording to the propose dialog", async () => {
    signIn(CAPTAIN_1, ["team-1"]);
    const wrapper = await mountNegotiation();

    const dialog = await openDialog(wrapper);
    expect(dialog.textContent).toContain(
      "Times must fall inside this round's window",
    );
    dialogButton(dialog, "Propose time")!.click();
    await flushPromises();

    const propose = wrapper.findComponent(ProposeTimeDialog);
    expect(propose.props("weekOpensAt")).toBe(ROUND_WINDOW.opens_at);
    expect(propose.props("weekClosesAt")).toBe(ROUND_WINDOW.closes_at);
    expect(propose.props("outsideWindowMessage")).toBe(
      "The proposed time is outside this round's scheduling window.",
    );
  });

  it("counters when the answering side proposes a new time", async () => {
    signIn(CAPTAIN_2, ["team-2"]);
    const wrapper = await mountNegotiation({
      bracket: bracket({ scheduling_proposals: [proposal()] }),
    });

    const dialog = await openDialog(wrapper);
    dialogButton(dialog, "Propose new time")!.click();
    await flushPromises();
    wrapper
      .findComponent(ProposeTimeDialog)
      .vm.$emit("submit", "2099-10-02T19:00:00.000Z", "");
    await flushPromises();

    expect(mutationsOf(PROPOSE_TIME_MUTATION)).toHaveLength(1);
    expect(mutationsOf(RESPOND_PROPOSAL_MUTATION)[0].variables).toEqual({
      proposalId: "proposal-1",
      status: "Countered",
    });
  });

  it("says the next two weeks when the round has no window", async () => {
    signIn(CAPTAIN_1, ["team-1"]);
    const wrapper = await mountNegotiation({ windows: [] });

    const dialog = await openDialog(wrapper);
    expect(dialog.textContent).toContain(
      "Times must be within the next two weeks.",
    );
    expect(dialog.textContent).not.toContain("this round's window");
    dialogButton(dialog, "Propose time")!.click();
    await flushPromises();

    expect(
      wrapper.findComponent(ProposeTimeDialog).props("outsideWindowMessage"),
    ).toBe("The proposed time must be within the next two weeks.");
  });

  it("asks for the viewer's teams once, from the cache, without rosters", async () => {
    signIn(CAPTAIN_1, ["team-1"]);
    await mountNegotiation();

    const [options] = query.mock.calls[0];
    const document = print(options.query);
    expect(options.fetchPolicy).toBe("cache-first");
    expect(document).not.toContain("avatar_url");
    expect(document).not.toContain("player {");
  });

  it("lists past proposals as history", async () => {
    signIn(SPECTATOR);
    const wrapper = await mountNegotiation({
      bracket: bracket({
        scheduling_proposals: [
          proposal({
            id: "proposal-0",
            status: "Countered",
            proposed_by: { steam_id: CAPTAIN_2, name: "sable" },
          }),
        ],
      }),
    });

    const dialog = await openDialog(wrapper);

    expect(dialog.textContent).toContain("sable");
    expect(dialog.textContent).toContain("Countered");
  });

  it("lets spectators read the negotiation without acting on it", async () => {
    signIn(SPECTATOR);
    const wrapper = await mountNegotiation({
      bracket: bracket({ scheduling_proposals: [proposal()] }),
    });

    const dialog = await openDialog(wrapper);

    expect(dialogButton(dialog, "Accept")).toBeUndefined();
    expect(dialogButton(dialog, "Propose new time")).toBeUndefined();
    expect(dialog.textContent).toContain(
      "Only the teams' owners, captains and roster admins can propose a time.",
    );
  });
});

describe("ProposeTimeForm window copy", () => {
  it("shows the caller's out-of-window message", async () => {
    const wrapper = await mountSuspended(ProposeTimeForm, {
      props: {
        weekOpensAt: "2099-10-05T00:00:00.000Z",
        weekClosesAt: "2099-10-09T00:00:00.000Z",
        initialDate: "2099-10-01T12:00:00.000Z",
        outsideWindowMessage:
          "The proposed time is outside this round's scheduling window.",
      },
    });
    unmount = () => wrapper.unmount();

    expect(wrapper.text()).toContain(
      "The proposed time is outside this round's scheduling window.",
    );
    expect(wrapper.text()).not.toContain("match week");
  });
});

describe("TournamentMatch negotiation", () => {
  const stage = { type: "SingleElimination", windows: [ROUND_WINDOW] };

  async function mountCard(tournament: Record<string, unknown>) {
    const wrapper = await mountSuspended(TournamentMatch, {
      props: {
        round: 2,
        brackets: [bracket({ scheduled_eta: "2099-10-03T20:00:00.000Z" })],
        stage,
        tournament: { is_organizer: true, ...tournament },
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  }

  it("opens the negotiation without opening the organizer's schedule dialog", async () => {
    signIn(CAPTAIN_1, ["team-1"]);
    const wrapper = await mountCard({ scheduling_mode: "negotiated" });

    const schedule = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Schedule"));
    expect(schedule, "Schedule button").toBeDefined();
    await schedule!.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("schedule-bracket")).toBeUndefined();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();

    await wrapper.find(".tournament-match").trigger("click");
    expect(wrapper.emitted("schedule-bracket")).toHaveLength(1);
  });

  it("leaves auto-scheduled tournaments as they were", async () => {
    signIn(CAPTAIN_1, ["team-1"]);
    const wrapper = await mountCard({ scheduling_mode: "auto" });

    expect(wrapper.find('[data-testid="negotiation-status"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("Scheduled for");
  });

  it("leaves league division fixtures to the league schedule", async () => {
    signIn(CAPTAIN_1, ["team-1"]);
    const wrapper = await mountCard({
      scheduling_mode: "negotiated",
      league_season_division: { id: "division-1" },
    });

    expect(wrapper.find('[data-testid="negotiation-status"]').exists()).toBe(
      false,
    );
  });
});
