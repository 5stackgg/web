import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchTabs from "~/components/match/MatchTabs.vue";
import MatchChatLog from "~/components/match/MatchChatLog.vue";
import {
  e_match_status_enum,
  e_match_types_enum,
  e_player_roles_enum,
} from "~/generated/zeus";

const MATCH = "11111111-1111-4111-8111-111111111111";
const LINEUP_1 = "22222222-2222-4222-8222-222222222222";
const LINEUP_2 = "33333333-3333-4333-8333-333333333333";

const at = (hour: number, minute: number) =>
  new Date(2026, 9, 2, hour, minute).toISOString();

const line = (
  id: string,
  name: string,
  message: string,
  hour: number,
  minute: number,
  source: "web" | "game" = "game",
) => ({
  id,
  message,
  source,
  timestamp: at(hour, minute),
  from: { steam_id: `7656119800000000${id.length}`, name },
});

const matchMaps = [
  {
    id: "map-1",
    order: 1,
    status: "Finished",
    map: { name: "de_nuke", label: "Nuke" },
    started_at: at(21, 0),
    ended_at: at(21, 30),
  },
  {
    id: "map-2",
    order: 2,
    status: "Finished",
    map: { name: "de_anubis", label: "Anubis" },
    started_at: at(21, 35),
    ended_at: at(22, 10),
  },
  {
    id: "map-3",
    order: 3,
    status: "Canceled",
    map: { name: "de_inferno", label: "Inferno" },
    started_at: null,
    ended_at: null,
  },
];

const match = (overrides: Record<string, unknown> = {}) => ({
  id: MATCH,
  status: e_match_status_enum.Finished,
  is_organizer: true,
  options: { type: e_match_types_enum.Competitive },
  lineup_1_id: null,
  lineup_2_id: null,
  lineup_1: { id: LINEUP_1, name: "Iron Wolves", lineup_players: [] },
  lineup_2: { id: LINEUP_2, name: "Night Owls", lineup_players: [] },
  match_maps: matchMaps,
  min_players_per_lineup: 5,
  max_players_per_lineup: 5,
  ...overrides,
});

const log = {
  match: [
    line("a1", "Pyre", "gl hf", 20, 58, "web"),
    line("a2", "tarn", "nice clutch", 21, 4),
    line("a3", "dusk", "between maps", 21, 32),
    line("a4", "dusk", "gg wp", 21, 40),
  ],
  teams: [
    {
      lineup_id: LINEUP_1,
      messages: [line("t1", "kairo", "default, I lurk B", 21, 6)],
    },
    {
      lineup_id: LINEUP_2,
      messages: [line("t2", "Quill", "timeout please", 21, 50, "web")],
    },
  ],
  team_chat_withheld: false,
  expires_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
};

const signIn = (role: e_player_roles_enum) => {
  useAuthStore().me = {
    steam_id: "76561198000000009",
    role,
  } as unknown as ReturnType<typeof useAuthStore>["me"];
};

let unmount: (() => void) | null = null;
let fetched: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetched = vi.fn().mockResolvedValue(log);
  vi.stubGlobal("$fetch", fetched);
  signIn(e_player_roles_enum.match_organizer);
});

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the Chat Log tab", () => {
  const STUBS = [
    "LineupOverview",
    "LineupUtility",
    "LineupTradeStats",
    "LineupAimStats",
    "LineupOpeningDuels",
    "LineupBuyTypes",
    "LineupClutches",
    "LineupRadarComparison",
    "MatchTeamStats",
    "MatchMapAnalysis",
    "MatchEconomyTimeline",
    "HeadToHead",
    "MatchRoles",
    "MatchUtilityUtility",
    "MatchOptionsDisplay",
    "MatchForm",
    "MatchLiveStreams",
    "ServiceLogs",
    "RconCommander",
    "MatchServerRebootControl",
    "MatchChatLog",
  ];

  const tabs = async (overrides: Record<string, unknown>) => {
    const wrapper = await mountSuspended(MatchTabs, {
      props: { match: match(overrides) },
      global: {
        stubs: Object.fromEntries(STUBS.map((name) => [name, true])),
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper
      .findAll('[role="tab"]')
      .map((tab) => tab.text().trim());
  };

  it.each([
    e_match_status_enum.Finished,
    e_match_status_enum.Tie,
    e_match_status_enum.Canceled,
    e_match_status_enum.Forfeit,
    e_match_status_enum.Surrendered,
  ])("is shown to a match organizer once the match is %s", async (status) => {
    expect(await tabs({ status })).toContain("Chat Log");
  });

  it.each([
    e_player_roles_enum.tournament_organizer,
    e_player_roles_enum.administrator,
  ])("is shown to a %s organizing nothing", async (role) => {
    signIn(role);

    expect(await tabs({ is_organizer: false })).toContain("Chat Log");
  });

  it.each([
    e_player_roles_enum.user,
    e_player_roles_enum.streamer,
    e_player_roles_enum.moderator,
  ])("is hidden from a %s, even one organizing the match", async (role) => {
    signIn(role);

    expect(await tabs({ is_organizer: true })).not.toContain("Chat Log");
  });

  it.each([
    e_match_status_enum.Live,
    e_match_status_enum.Veto,
    e_match_status_enum.WaitingForServer,
    e_match_status_enum.PickingPlayers,
  ])("is hidden while the match is %s", async (status) => {
    expect(await tabs({ status })).not.toContain("Chat Log");
  });


  it("stays on the Chat Log when a map is picked for the page", async () => {
    const wrapper = await mountSuspended(MatchTabs, {
      props: { match: match() },
      global: {
        stubs: Object.fromEntries(STUBS.map((name) => [name, true])),
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();

    (wrapper.vm as any).fetchMapStats = vi.fn();
    (wrapper.vm as any).activeTab = "chat-log";
    await flushPromises();
    await wrapper.setProps({ activeMap: matchMaps[1] });
    await flushPromises();

    expect((wrapper.vm as any).activeTab).toBe("chat-log");
    expect(
      wrapper.findComponent(MatchChatLog).props("activeMapId"),
    ).toBe("map-2");
  });
});

describe("MatchChatLog", () => {
  const mount = async (props: Record<string, unknown> = {}) => {
    const wrapper = await mountSuspended(MatchChatLog, {
      props: { match: match(), ...props },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  };

  const column = (wrapper: any, label: string) =>
    wrapper
      .findAll("[data-chat-log-column]")
      .find((node: any) => node.text().includes(label));

  const lines = (wrapper: any, label: string) =>
    column(wrapper, label)
      .findAll("[data-chat-log-line]")
      .map((node: any) => node.find("p").text());

  const settle = async () => {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await flushPromises();
  };

  const choose = async (wrapper: any, label: string) => {
    const button = wrapper
      .findAll("button")
      .find((node: any) => node.text().trim() === label);
    await button.trigger("click");
    await settle();
  };

  it("asks the api for this match's log with the session cookie", async () => {
    await mount();

    expect(fetched).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/chat/matches/${MATCH}/log$`)),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("shows all chat and each team's chat side by side", async () => {
    const wrapper = await mount();

    expect(lines(wrapper, "All Chat")).toEqual([
      "gl hf",
      "nice clutch",
      "between maps",
      "gg wp",
    ]);
    expect(lines(wrapper, "Iron Wolves")).toEqual(["default, I lurk B"]);
    expect(lines(wrapper, "Night Owls")).toEqual(["timeout please"]);
  });

  it("shows only the team the api returned", async () => {
    fetched.mockResolvedValue({ ...log, teams: [log.teams[0]] });

    const wrapper = await mount();

    expect(column(wrapper, "Iron Wolves")).toBeDefined();
    expect(column(wrapper, "Night Owls")).toBeUndefined();
  });

  it("offers a filter for each map that was played", async () => {
    const wrapper = await mount();

    const labels = wrapper.findAll("button").map((node) => node.text().trim());

    expect(labels).toEqual(
      expect.arrayContaining(["Full Match", "Map 1 · Nuke", "Map 2 · Anubis"]),
    );
    expect(labels.some((label) => label.includes("Inferno"))).toBe(false);
  });

  it("gives each map everything up to its end, back to back", async () => {
    const wrapper = await mount();

    await choose(wrapper, "Map 1 · Nuke");

    expect(lines(wrapper, "All Chat")).toEqual(["gl hf", "nice clutch"]);
    expect(lines(wrapper, "Iron Wolves")).toEqual(["default, I lurk B"]);
    expect(lines(wrapper, "Night Owls")).toEqual([]);

    await choose(wrapper, "Map 2 · Anubis");

    expect(lines(wrapper, "All Chat")).toEqual(["between maps", "gg wp"]);
    expect(lines(wrapper, "Night Owls")).toEqual(["timeout please"]);

    await choose(wrapper, "Full Match");

    expect(lines(wrapper, "All Chat")).toHaveLength(4);
  });

  it("keeps a map's chat when overtime restarted its clock", async () => {
    // The api stamps started_at again on every move into Knife, Live or
    // Overtime, so a map that went to overtime starts late.
    const overtime = matchMaps.map((map) =>
      map.id === "map-1" ? { ...map, started_at: at(21, 25) } : map,
    );

    const wrapper = await mount({ match: match({ match_maps: overtime }) });

    await choose(wrapper, "Map 1 · Nuke");

    expect(lines(wrapper, "All Chat")).toEqual(["gl hf", "nice clutch"]);
    expect(lines(wrapper, "Iron Wolves")).toEqual(["default, I lurk B"]);
  });

  it("opens on the map picked for the page", async () => {
    const wrapper = await mount({ activeMapId: "map-2" });

    expect(lines(wrapper, "All Chat")).toEqual(["between maps", "gg wp"]);
  });

  it.each([
    [6 * 24 * 60 + 120, "Deleted in 6 days"],
    [24 * 60 + 30, "Deleted in 1 day"],
    [5 * 60 + 20, "Deleted in 5 hours"],
    [20, "Deleted within the hour"],
  ])(
    "says when the log is deleted, %i minutes out",
    async (minutes, expected) => {
      fetched.mockResolvedValue({
        ...log,
        expires_at: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
      });

      const wrapper = await mount();

      expect(wrapper.text()).toContain(expected);
      expect(wrapper.text()).not.toMatch(/\d+:\d{2}:\d{2}/);
    },
  );

  it.each([
    ["de", 6 * 24 * 60 + 120, "in 6 Tagen"],
    ["pl", 60 + 20, "za 1 godzinę"],
    ["uk", 60 + 20, "через 1 годину"],
  ])(
    "inflects the time left in %s",
    async (locale, minutes, expected) => {
      const i18n = (useNuxtApp() as any).$i18n;
      await i18n.setLocale(locale);

      try {
        fetched.mockResolvedValue({
          ...log,
          expires_at: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
        });

        const wrapper = await mount();

        expect(wrapper.text()).toContain(expected);
      } finally {
        await i18n.setLocale("en");
      }
    },
  );

  it("says why team chat is missing for someone who played", async () => {
    fetched.mockResolvedValue({ ...log, teams: [], team_chat_withheld: true });

    const wrapper = await mount();

    expect(wrapper.findAll("[data-chat-log-column]")).toHaveLength(1);
    expect(wrapper.text()).toContain(
      "You took part in this match, so team chat is hidden.",
    );
  });

  it("does not say so to someone shown every room", async () => {
    const wrapper = await mount();

    expect(wrapper.text()).not.toContain("team chat is hidden");
  });

  it("marks lines that were deleted or edited", async () => {
    fetched.mockResolvedValue({
      ...log,
      match: [
        {
          ...line("d1", "Pyre", "something nasty", 21, 1, "web"),
          deleted_at: at(21, 2),
        },
        {
          ...line("e1", "tarn", "fixed it", 21, 3, "web"),
          edited_at: at(21, 4),
        },
        line("p1", "dusk", "plain", 21, 5),
      ],
    });

    const wrapper = await mount();
    const [deleted, edited, plain] = column(wrapper, "All Chat").findAll(
      "[data-chat-log-line]",
    );

    expect(deleted.find("[data-chat-log-deleted]").text()).toBe("deleted");
    expect(deleted.text()).toContain("something nasty");
    expect(edited.find("[data-chat-log-edited]").text()).toBe("edited");
    expect(plain.find("[data-chat-log-deleted]").exists()).toBe(false);
    expect(plain.find("[data-chat-log-edited]").exists()).toBe(false);
  });

  it("names who deleted a line", async () => {
    fetched.mockResolvedValue({
      ...log,
      match: [
        {
          ...line("d1", "Pyre", "something nasty", 21, 1, "web"),
          deleted_at: at(21, 2),
          deleted_by: { steam_id: "76561198000000077", name: "Warden" },
        },
      ],
    });

    const wrapper = await mount();
    const [deleted] = column(wrapper, "All Chat").findAll(
      "[data-chat-log-line]",
    );

    expect(deleted.find("[data-chat-log-deleted]").text()).toBe(
      "deleted by Warden",
    );
  });

  it("opens an edited line's earlier text from its marker", async () => {
    fetched.mockResolvedValue({
      ...log,
      match: [
        {
          ...line("e1", "tarn", "fixed it", 21, 3, "web"),
          edited_at: at(21, 5),
          edits: [
            { message: "fixd it", written_at: at(21, 3) },
            { message: "fixed it?", written_at: at(21, 4) },
          ],
        },
      ],
    });

    const wrapper = await mount();
    const [edited] = column(wrapper, "All Chat").findAll(
      "[data-chat-log-line]",
    );

    expect(edited.text()).not.toContain("fixd it");

    await edited.get("[data-chat-log-edited]").trigger("click");
    await settle();

    const earlier = edited
      .findAll("[data-chat-log-earlier]")
      .map((node: any) => node.text());

    expect(earlier).toEqual([
      expect.stringMatching(/Original · 21:03\s+fixd it/),
      expect.stringMatching(/Edited · 21:04\s+fixed it\?/),
    ]);
  });

  it("says all chat is empty, not that nobody spoke, when team chat is hidden", async () => {
    fetched.mockResolvedValue({
      ...log,
      match: [],
      teams: [],
      team_chat_withheld: true,
    });

    const wrapper = await mount();

    expect(wrapper.text()).not.toContain("Nobody wrote anything");
    expect(wrapper.text()).toContain(
      "Nobody wrote in all chat, and team chat is hidden because you took part in this match.",
    );
  });

  const truncationWarning = (wrapper: any) =>
    wrapper.find(
      '[aria-label="This match\'s chat was too long to keep in full."]',
    );

  it("puts a cut-short archive behind an amber warning", async () => {
    fetched.mockResolvedValue({ ...log, archive_truncated: true });

    const wrapper = await mount();

    expect(truncationWarning(wrapper).exists()).toBe(true);
    expect(truncationWarning(wrapper).find("svg").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("too long to keep");
  });

  it("shows no warning when it was all kept", async () => {
    const wrapper = await mount();

    expect(truncationWarning(wrapper).exists()).toBe(false);
  });

  it("keeps chat after the only played map when the page picks that map", async () => {
    const onlyFirst = matchMaps.map((map) =>
      map.id === "map-1"
        ? map
        : { ...map, status: "Scheduled", started_at: null, ended_at: null },
    );

    const wrapper = await mount({
      match: match({ match_maps: onlyFirst }),
      activeMapId: "map-1",
    });

    expect(lines(wrapper, "All Chat")).toEqual([
      "gl hf",
      "nice clutch",
      "between maps",
      "gg wp",
    ]);
  });

  it("gives the last played map everything said after it ended", async () => {
    fetched.mockResolvedValue({
      ...log,
      match: [...log.match, line("a5", "dusk", "afterwards", 22, 30)],
    });
    const later = await mount({ activeMapId: "map-2" });

    expect(lines(later, "All Chat")).toEqual([
      "between maps",
      "gg wp",
      "afterwards",
    ]);
  });

  it("tags lines typed on the website and stamps each with its clock time", async () => {
    const wrapper = await mount();

    const [web, game] = column(wrapper, "All Chat").findAll(
      "[data-chat-log-line]",
    );

    expect(web.text()).toContain("Web");
    expect(game.text()).not.toContain("Web");
    expect(web.text()).toContain("20:58");
    expect(game.text()).toContain("21:04");
  });

  it("says the log was refused rather than showing it empty", async () => {
    fetched.mockRejectedValue(Object.assign(new Error("Forbidden"), {
      statusCode: 403,
    }));

    const wrapper = await mount();

    expect(wrapper.findAll("[data-chat-log-column]")).toHaveLength(0);
    expect(wrapper.text()).toContain("chat log could not be loaded");
  });
});
