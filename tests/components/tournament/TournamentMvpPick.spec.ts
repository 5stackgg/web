import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentMvpPick from "~/components/tournament/TournamentMvpPick.vue";

const { query, mutate, hasFields, missingFields } = vi.hoisted(() => ({
  query: vi.fn(),
  mutate: vi.fn(),
  hasFields: { value: true },
  missingFields: new Set<string>(),
}));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query, mutate } }),
}));

vi.mock("~/utilities/schemaHasType", () => ({
  schemaHasField: async (_client: unknown, type: string, field: string) =>
    hasFields.value && !missingFields.has(`${type}.${field}`),
  schemaHasType: async () => hasFields.value,
}));

const KAIRO = "76561198000000001";
const ROOK = "76561198000000002";
const FEXX = "76561198000000003";
const LUKE = "76561198000000009";

const northwind = {
  id: "tt-1",
  name: null,
  team: { id: "team-1", name: "Northwind" },
  roster: [KAIRO, ROOK, FEXX].map((steam_id, index) => ({
    player: { steam_id, name: ["kairo", "rook", "fexx"][index] },
  })),
};

const candidates = [
  {
    player_steam_id: KAIRO,
    name: "kairo",
    avatar_url: null,
    tournament_team_id: "tt-1",
    rank: 1,
    avg_impact: 1.14,
    matches: 6,
    kdr: 1.42,
    adr: 92.4,
    headshot_percentage: 54,
  },
  {
    player_steam_id: FEXX,
    name: "fexx",
    avatar_url: null,
    tournament_team_id: "tt-1",
    rank: 3,
    avg_impact: 1.05,
    matches: 6,
    kdr: 1.18,
    adr: 88,
    headshot_percentage: 61,
  },
  {
    player_steam_id: ROOK,
    name: "rook",
    avatar_url: null,
    tournament_team_id: "tt-1",
    rank: 2,
    avg_impact: 1.08,
    matches: 6,
    kdr: 1.21,
    adr: 84,
    headshot_percentage: 49,
  },
];

let pickState: Record<string, unknown>;
let refetch: ReturnType<typeof vi.fn>;
let mounted: { unmount: () => void } | null = null;

function mvpAward(steamId: string, overrides: Record<string, unknown> = {}) {
  const player = northwind.roster.find(
    (row) => row.player.steam_id === steamId,
  )!.player;
  return {
    id: `mvp-${steamId}`,
    placement: 0,
    source: "tournament",
    awarded_by_steam_id: null,
    note: null,
    player_steam_id: steamId,
    player,
    tournament_team_id: "tt-1",
    tournament_team: northwind,
    ...overrides,
  };
}

function tournament(overrides: Record<string, unknown> = {}) {
  return {
    id: "tournament-1",
    status: "Finished",
    awards_enabled: true,
    teams: [northwind],
    awards: [mvpAward(KAIRO)],
    ...overrides,
  };
}

async function mountPick(props: Record<string, unknown>) {
  const wrapper = await mountSuspended(TournamentMvpPick, {
    props: { tournament: props },
    attachTo: document.body,
    global: { provide: { refetchTournamentStatic: refetch } },
  });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
}

function bodyButton(label: string) {
  const button = [...document.body.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim().includes(label),
  );
  expect(button, label).toBeDefined();
  return button!;
}

async function click(element: Element) {
  (element as HTMLElement).click();
  await flushPromises();
}

function radios() {
  return [...document.body.querySelectorAll('[role="radio"]')];
}

beforeEach(() => {
  hasFields.value = true;
  missingFields.clear();
  refetch = vi.fn().mockResolvedValue(undefined);
  pickState = {
    id: "tournament-1",
    can_pick_mvp: true,
    organizer_picks_mvp: false,
    finished_at: "2026-10-12T18:30:00Z",
    mvp_picks: [],
  };
  query.mockReset();
  query.mockImplementation(async ({ query: document }: any) => {
    const name = document.definitions[0].name.value;
    if (name === "TournamentMvpPickState") {
      return { data: { tournaments_by_pk: pickState } };
    }
    if (name === "TournamentMvpCandidates") {
      return { data: { tournamentMvpCandidates: candidates } };
    }
    throw new Error(`unexpected query ${name}`);
  });
  mutate.mockReset();
  mutate.mockResolvedValue({ data: {} });
});

afterEach(async () => {
  mounted?.unmount();
  mounted = null;
  useAuthStore().me = undefined;
  await flushPromises();
});

describe("TournamentMvpPick", () => {
  it("is left out on an api without the pick", async () => {
    hasFields.value = false;
    const wrapper = await mountPick(tournament());

    expect(wrapper.text()).not.toContain("Tournament MVP");
    expect(query).not.toHaveBeenCalled();
  });

  it("asks for organizer access when the session cannot pick", async () => {
    pickState.can_pick_mvp = false;
    const wrapper = await mountPick(tournament());

    expect(wrapper.text()).toContain("Organizer access required");
    expect(wrapper.text()).not.toContain("Change MVP");
  });

  it("says when the MVP is picked before the finish, and offers the switch", async () => {
    const wrapper = await mountPick(tournament({ status: "Live", awards: [] }));

    expect(wrapper.text()).toContain(
      "The MVP is picked when the tournament finishes",
    );
    expect(wrapper.text()).toContain("I'll pick the MVP myself");
  });

  it("says there is no MVP while awards are off", async () => {
    const wrapper = await mountPick(tournament({ awards_enabled: false }));

    expect(wrapper.text()).toContain("Awards are off, so there's no MVP");
  });

  it("shows the automatic MVP as the suggestion with its score", async () => {
    const wrapper = await mountPick(tournament());

    const text = wrapper.text();
    expect(text).toContain("kairo");
    expect(text).toContain("Suggested");
    expect(text).toContain("impact 1.14");
    expect(text).toContain("6 matches");
  });

  it("lists the winning team's players by the automatic score and marks the suggestion", async () => {
    await mountPick(tournament());
    await click(bodyButton("Change MVP"));

    expect(radios().map((row) => row.getAttribute("data-steam-id"))).toEqual([
      KAIRO,
      ROOK,
      FEXX,
    ]);
    expect(radios()[0].textContent).toContain("Suggested");
    expect(radios()[1].textContent).not.toContain("Suggested");
    expect(radios()[0].textContent).toContain("1.14");
    expect(radios()[0].textContent).toContain("1.42");
    expect(radios()[0].textContent).toContain("92");
    expect(radios()[0].textContent).toContain("54%");
    expect(radios()[0].getAttribute("aria-checked")).toBe("true");
  });

  it("confirms another player with the note, then refreshes the tournament", async () => {
    await mountPick(tournament());
    await click(bodyButton("Change MVP"));
    await click(radios()[2]);

    const input = document.body.querySelector("input") as HTMLInputElement;
    input.value = "Held B alone";
    input.dispatchEvent(new Event("input"));
    await flushPromises();

    await click(bodyButton("Continue"));
    const dialog = document.body.textContent ?? "";
    expect(dialog).toContain("Make fexx the Tournament MVP?");
    expect(dialog).toContain("kairo was picked automatically");
    expect(dialog).toContain("fexx gets the award and its notification.");

    await click(bodyButton("Confirm MVP"));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [{ mutation, variables }] = mutate.mock.calls[0];
    expect(mutation.definitions[0].name.value).toBe("SetTournamentMvp");
    expect(variables).toEqual({
      id: "tournament-1",
      steamId: FEXX,
      note: "Held B alone",
    });
    expect(refetch).toHaveBeenCalled();
  });

  it("keeps a non-admin organizer off their own row", async () => {
    useAuthStore().me = { steam_id: FEXX, role: "user" } as any;
    await mountPick(tournament());
    await click(bodyButton("Change MVP"));

    const own = radios()[2];
    expect(own.getAttribute("data-steam-id")).toBe(FEXX);
    expect(own.getAttribute("aria-disabled")).toBe("true");

    await click(own);

    expect(own.getAttribute("aria-checked")).toBe("false");
    expect(radios()[0].getAttribute("aria-checked")).toBe("true");
  });

  it("lets an administrator pick themselves", async () => {
    useAuthStore().me = { steam_id: FEXX, role: "administrator" } as any;
    await mountPick(tournament());
    await click(bodyButton("Change MVP"));

    const own = radios()[2];
    expect(own.getAttribute("aria-disabled")).toBe("false");

    await click(own);

    expect(own.getAttribute("aria-checked")).toBe("true");
  });

  it("turns the automatic pick off through the switch", async () => {
    const wrapper = await mountPick(tournament());

    await click(wrapper.find('[role="switch"]').element);

    expect(mutate).toHaveBeenCalledTimes(1);
    const [{ mutation, variables }] = mutate.mock.calls[0];
    expect(mutation.definitions[0].name.value).toBe(
      "SetTournamentOrganizerPicksMvp",
    );
    expect(variables).toEqual({ id: "tournament-1", value: true });
  });

  it("reloads the history after the switch, where turning it on records the kept pick", async () => {
    await mountPick(tournament());
    const loads = () =>
      query.mock.calls.filter(
        ([{ query: document }]: any) =>
          document.definitions[0].name.value === "TournamentMvpPickState",
      ).length;
    const before = loads();

    await click(document.body.querySelector('[role="switch"]')!);

    expect(loads()).toBe(before + 1);
    expect(refetch).toHaveBeenCalled();
  });

  it("asks for kept picks only from an api that has them", async () => {
    const fieldsAsked = () =>
      query.mock.calls
        .map(([{ query: document }]: any) => document)
        .filter(
          (document: any) =>
            document.definitions[0].name.value === "TournamentMvpPickState",
        )
        .map((document: any) => document.loc.source.body);

    await mountPick(tournament());
    expect(fieldsAsked().at(-1)).toContain("kept_automatic");

    mounted?.unmount();
    query.mockClear();
    missingFields.add("tournament_mvp_picks.kept_automatic");
    await mountPick(tournament());
    expect(fieldsAsked().at(-1)).not.toContain("kept_automatic");
  });

  it("shows a kept automatic pick as the automatic one, current while it holds", async () => {
    pickState.organizer_picks_mvp = true;
    pickState.mvp_picks = [
      {
        id: "kept",
        player_steam_id: KAIRO,
        note: null,
        replaced_steam_id: null,
        kept_automatic: true,
        created_at: "2026-10-13T20:00:00Z",
        player: { steam_id: KAIRO, name: "kairo" },
        picked_by: { steam_id: LUKE, name: "luke" },
        replaced_player: null,
      },
    ];
    const wrapper = await mountPick(tournament());

    const rows = wrapper.findAll("li");
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain("kairo");
    expect(rows[0].text()).toContain("picked automatically");
    expect(rows[0].text()).not.toContain("picked by");
    expect(rows[0].find(".line-through").exists()).toBe(false);
  });

  it("still shows the automatic pick once an organizer picks over a kept one", async () => {
    pickState.organizer_picks_mvp = true;
    pickState.mvp_picks = [
      {
        id: "pick",
        player_steam_id: FEXX,
        note: null,
        replaced_steam_id: KAIRO,
        kept_automatic: false,
        created_at: "2026-10-13T21:04:00Z",
        player: { steam_id: FEXX, name: "fexx" },
        picked_by: { steam_id: LUKE, name: "luke" },
        replaced_player: { steam_id: KAIRO, name: "kairo" },
      },
      {
        id: "kept",
        player_steam_id: KAIRO,
        note: null,
        replaced_steam_id: null,
        kept_automatic: true,
        created_at: "2026-10-13T20:00:00Z",
        player: { steam_id: KAIRO, name: "kairo" },
        picked_by: { steam_id: LUKE, name: "luke" },
        replaced_player: null,
      },
    ];
    const wrapper = await mountPick(
      tournament({ awards: [mvpAward(FEXX, { awarded_by_steam_id: LUKE })] }),
    );

    const rows = wrapper.findAll("li");
    expect(rows.map((row) => row.text())).toHaveLength(2);
    expect(rows[0].text()).toContain("fexx");
    expect(rows[0].text()).toContain("picked by luke");
    expect(rows[0].find(".line-through").exists()).toBe(false);
    expect(rows[1].text()).toContain("kairo");
    expect(rows[1].text()).toContain("picked automatically");
    expect(rows[1].find(".line-through").exists()).toBe(true);
  });

  it("offers a pick when the organizers pick and none is made yet", async () => {
    pickState.organizer_picks_mvp = true;
    const wrapper = await mountPick(tournament({ awards: [] }));

    expect(wrapper.text()).toContain("You pick the MVP for this tournament.");
    expect(wrapper.text()).toContain("No MVP yet.");
    await click(bodyButton("Pick MVP"));
    expect(document.body.textContent).toContain("Pick the Tournament MVP");
  });

  it("keeps every pick in the history, with the automatic pick it replaced", async () => {
    pickState.mvp_picks = [
      {
        id: "pick-2",
        player_steam_id: FEXX,
        note: "Held B alone",
        replaced_steam_id: ROOK,
        created_at: "2026-10-13T21:04:00Z",
        player: { steam_id: FEXX, name: "fexx" },
        picked_by: { steam_id: LUKE, name: "luke" },
        replaced_player: { steam_id: ROOK, name: "rook" },
      },
      {
        id: "pick-1",
        player_steam_id: ROOK,
        note: null,
        replaced_steam_id: KAIRO,
        created_at: "2026-10-13T20:00:00Z",
        player: { steam_id: ROOK, name: "rook" },
        picked_by: { steam_id: LUKE, name: "luke" },
        replaced_player: { steam_id: KAIRO, name: "kairo" },
      },
    ];
    const wrapper = await mountPick(
      tournament({
        awards: [
          mvpAward(FEXX, { awarded_by_steam_id: LUKE, note: "Held B alone" }),
        ],
      }),
    );

    const text = wrapper.text();
    expect(text).toContain("Picked by organizers");
    expect(text).toContain("“Held B alone”");

    const rows = wrapper.findAll("li").map((row) => row.text());
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain("fexx");
    expect(rows[0]).toContain("picked by luke");
    expect(rows[1]).toContain("rook");
    expect(rows[2]).toContain("kairo");
    expect(rows[2]).toContain("picked automatically");
    expect(wrapper.findAll("li")[0].find(".line-through").exists()).toBe(
      false,
    );
    expect(wrapper.findAll("li")[1].find(".line-through").exists()).toBe(
      true,
    );
  });
});
