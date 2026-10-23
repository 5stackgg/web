import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentDetail from "~/components/tournament/TournamentDetail.vue";
import { print } from "graphql";
import { useAuthStore } from "~/stores/AuthStore";

const ME = "76561198000000001";

type Observer = { next: (result: any) => void };
type Live = {
  client: string;
  root: string;
  fields: string[];
  query: any;
  observer: Observer;
};

let lives: Live[] = [];
let mounted: { unmount: () => void } | null = null;

const root = (query: any) => query.definitions[0].selectionSet.selections[0];
const names = (selection: any) =>
  selection.selectionSet.selections.map((s: any) => (s.alias ?? s.name).value);
const child = (selection: any, name: string) =>
  selection.selectionSet.selections.find(
    (s: any) => (s.alias ?? s.name).value === name,
  );

// The page's live tournament subscriptions, told apart by what they ask for.
const tournament = () => lives.filter((l) => l.root === "tournaments_by_pk");
const full = () =>
  tournament().filter(
    (l) => l.fields.includes("name") && l.fields.includes("can_join"),
  );
const shared = () =>
  tournament().filter(
    (l) => l.fields.includes("stages") && !l.fields.includes("can_join"),
  );
const personal = () =>
  tournament().filter(
    (l) => l.fields.includes("can_join") && !l.fields.includes("name"),
  );
// The check-in list is every team with its roster; the viewer's own teams are
// asked for by steam id and are left alone.
const checkIn = () =>
  lives.filter(
    (l) =>
      l.root === "tournament_teams" &&
      !print(l.query).includes("$steam_id") &&
      (l.fields.includes("checked_in_at") || l.fields.includes("can_manage")),
  );

function spySubscriptions(name: "default" | "public") {
  const client = (useApollo().clients as Record<string, any>)[name];
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: Observer) {
      const field = root(options.query).name.value;
      if (["tournaments_by_pk", "tournament_teams"].includes(field)) {
        lives.push({
          client: name,
          root: field,
          fields: names(root(options.query)),
          query: options.query,
          observer,
        });
      }
      return { unsubscribe() {}, closed: false };
    },
  }));
}

async function mountDetail(role?: string) {
  useAuthStore().me = role ? ({ steam_id: ME, role } as any) : undefined;
  spySubscriptions("default");
  spySubscriptions("public");
  const wrapper = await mountSuspended(TournamentDetail, {
    route: "/tournaments/t-1",
    shallow: true,
    // vue-apollo reads a component's `apollo` option through the app's mixins.
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
}

async function emit(live: Live, tournament: Record<string, unknown> | null) {
  live.observer.next({ data: { tournaments_by_pk: tournament } });
  await flushPromises();
}

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  lives = [];
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

const sharedTournament = (overrides: Record<string, unknown> = {}) => ({
  id: "t-1",
  name: "Autumn Cup",
  status: "Live",
  teams: [
    { id: "a", name: "Alpha", roster: [] },
    { id: "b", name: "Bravo", roster: [] },
  ],
  stages: [
    { id: "s-1", order: 1, brackets: [{ id: "x", round: 1, team_1: null }] },
  ],
  ...overrides,
});

const personalTournament = (overrides: Record<string, unknown> = {}) => ({
  id: "t-1",
  is_organizer: false,
  can_join: true,
  joined_tournament: false,
  can_start: false,
  can_cancel: false,
  can_open_registration: false,
  can_close_registration: false,
  can_pause: false,
  can_resume: false,
  can_setup: false,
  teams: [
    { id: "b", can_recruit: true, can_manage: true },
    { id: "a", can_recruit: false, can_manage: false },
  ],
  stages: [
    {
      id: "s-1",
      brackets: [
        {
          id: "x",
          parent_bracket: null,
          loser_bracket: null,
          match: { id: "m", status: "Canceled" },
        },
      ],
    },
  ],
  ...overrides,
});

// Everyone watching a tournament reads the same teams, rosters and brackets,
// so a signed-in player reads them as a guest and shares one Hasura poll with
// every other viewer. Their own permissions, and the bracket matches a guest
// sees fewer of, come from a small subscription on their session.
describe("the tournament page for a signed-in player", () => {
  it("reads the tournament as a guest and only the viewer's own fields on their session", async () => {
    await mountDetail("user");

    expect(full()).toHaveLength(0);
    expect(shared().map((l) => l.client)).toEqual(["public"]);
    expect(personal().map((l) => l.client)).toEqual(["default"]);

    const guest = root(shared()[0].query);
    for (const field of [
      "is_organizer",
      "can_join",
      "joined_tournament",
      "can_start",
    ]) {
      expect(names(guest)).not.toContain(field);
    }
    expect(names(child(guest, "teams"))).not.toContain("can_manage");
    expect(names(child(child(guest, "stages"), "brackets"))).not.toContain(
      "match",
    );

    const mine = root(personal()[0].query);
    expect(names(mine)).toEqual([
      "id",
      "is_organizer",
      "can_join",
      "joined_tournament",
      "can_start",
      "can_cancel",
      "can_open_registration",
      "can_close_registration",
      "can_pause",
      "can_resume",
      "can_setup",
      "teams",
      "stages",
    ]);
    expect(names(child(mine, "teams"))).toEqual([
      "id",
      "can_recruit",
      "can_manage",
    ]);
  });

  it("shows the tournament once both halves are in, with the viewer's own fields on it", async () => {
    const wrapper = await mountDetail("user");

    await emit(shared()[0], sharedTournament());
    expect((wrapper.vm as any).tournamentLive).toBeUndefined();

    await emit(personal()[0], personalTournament());
    expect((wrapper.vm as any).tournamentLive).toMatchObject({
      name: "Autumn Cup",
      can_join: true,
      teams: [
        { id: "a", name: "Alpha", can_manage: false },
        { id: "b", name: "Bravo", can_manage: true },
      ],
      stages: [
        {
          brackets: [
            { id: "x", round: 1, match: { id: "m", status: "Canceled" } },
          ],
        },
      ],
    });
  });

  // A tournament still in setup is hidden from guests but not from its
  // organizers: the page reads it the old way, on the viewer's session.
  it("reads a tournament a guest can't see on the viewer's own session", async () => {
    const wrapper = await mountDetail("user");

    await emit(shared()[0], null);
    await emit(personal()[0], personalTournament({ is_organizer: true }));

    expect((wrapper.vm as any).tournamentLive).toBeUndefined();
    expect(full().map((l) => l.client)).toEqual(["default"]);

    await emit(full()[0], {
      ...sharedTournament(),
      ...personalTournament({ is_organizer: true }),
      status: "Setup",
    });
    expect((wrapper.vm as any).tournamentLive).toMatchObject({
      status: "Setup",
      is_organizer: true,
    });
  });

  it("lets the tournament go when it is gone", async () => {
    const wrapper = await mountDetail("user");
    await emit(shared()[0], sharedTournament());
    await emit(personal()[0], personalTournament());
    expect((wrapper.vm as any).tournamentLive).toBeTruthy();

    await emit(personal()[0], null);

    expect((wrapper.vm as any).tournamentLive).toBeNull();
  });
});

describe("the check-in list for a signed-in player", () => {
  async function mountCheckIn(role?: string) {
    const wrapper = await mountDetail(role);
    (wrapper.vm as any).tournamentRegistration = { check_in_required: true };
    await flushPromises();
    return wrapper;
  }

  it("reads every team as a guest and only whether the viewer may check each in", async () => {
    const wrapper = await mountCheckIn("user");

    const [guest] = checkIn().filter((l) => l.client === "public");
    const [mine] = checkIn().filter((l) => l.client === "default");
    expect(checkIn()).toHaveLength(2);
    expect(guest.fields).not.toContain("can_manage");
    expect(guest.fields).toEqual(
      expect.arrayContaining(["checked_in_at", "roster"]),
    );
    expect(mine.fields).toEqual(["id", "can_manage"]);

    teams(guest, [
      { id: "a", name: "Alpha", roster: [] },
      { id: "b", name: "Bravo", roster: [] },
    ]);
    teams(mine, [
      { id: "b", can_manage: true },
      { id: "a", can_manage: false },
    ]);
    await flushPromises();

    expect((wrapper.vm as any).checkInTeams).toEqual([
      { id: "a", name: "Alpha", roster: [], can_manage: false },
      { id: "b", name: "Bravo", roster: [], can_manage: true },
    ]);
  });

  it("leaves elo out of the check-in list, which never shows it", async () => {
    await mountCheckIn("moderator");

    const [list] = checkIn();
    expect(print(list.query)).toContain("is_banned");
    expect(print(list.query)).not.toMatch(/^\s*elo\b/m);
  });

  it("reads the whole list on one subscription for a moderator", async () => {
    await mountCheckIn("moderator");

    expect(
      checkIn().map((l) => [l.client, l.fields.includes("can_manage")]),
    ).toEqual([["default", true]]);
  });
});

function teams(subscription: Live, rows: Array<Record<string, unknown>>) {
  subscription.observer.next({ data: { tournament_teams: rows } });
}

// A signed-out visitor is a guest on both halves, so they share the poll with
// everyone else and their guest fields are read once for all of them.
describe("the tournament page for a signed-out visitor", () => {
  it("reads the shared tournament as a guest, with the guest fields beside it", async () => {
    await mountDetail(undefined);

    expect(full()).toHaveLength(0);
    expect(shared().map((l) => l.client)).toEqual(["public"]);
    expect(personal().map((l) => l.client)).toEqual(["default"]);
  });
});

// Polled every second for every viewer, so it asks only for what the page
// shows: no per-player eligibility check, no rank columns a roster never
// displays, and only the stage options the stage form and bracket cards read.
describe("what the tournament page polls", () => {
  it("leaves out fields nothing on the page reads", async () => {
    await mountDetail("moderator");
    const document = print(full()[0].query);

    for (const field of [
      "target_eligible",
      "premier_rank",
      "faceit_skill_level",
      "faceit_elo",
      "knife_round",
      "default_models",
      "rounds_won",
      "matches_remaining",
      "match_options_id",
    ]) {
      expect(document).not.toContain(field);
    }
    expect(document).toContain("roster_counts: teams");
  });

  it("leaves roster elo to the rows someone opens", async () => {
    await mountDetail("moderator");

    expect(print(full()[0].query)).not.toMatch(/^\s*elo\b/m);
  });
});

describe("the tournament page for everyone else", () => {
  it.each([
    ["a moderator", "moderator"],
    ["a tournament organizer", "tournament_organizer"],
    ["an administrator", "administrator"],
  ])(
    "reads the whole tournament on one subscription for %s",
    async (_, role) => {
      await mountDetail(role);

      expect(shared()).toHaveLength(0);
      expect(personal()).toHaveLength(0);
      expect(full().map((l) => l.client)).toEqual(["default"]);
    },
  );
});
