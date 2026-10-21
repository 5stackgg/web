import { describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ScrimBoard from "~/components/scrims/ScrimBoard.vue";
import ScrimRequestForm from "~/components/scrims/ScrimRequestForm.vue";

const mutate = vi.fn().mockResolvedValue({ data: {} });
vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  useApolloClient: () => ({
    client: {
      mutate,
      query: vi.fn().mockResolvedValue({ data: { maps: [] } }),
      subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
    },
  }),
}));

// Wed Oct 21 2026, 7:40 PM local.
const now = new Date(2026, 9, 21, 19, 40);
const at = (day: number, h: number, m = 0) => new Date(2026, 9, 21 + day, h, m).getTime();
const weekly = (dow: number, from: number, to: number) => ({
  starts_at: new Date(1970, 0, 4 + dow, 0, from).toISOString(),
  ends_at: new Date(1970, 0, 4 + dow, 0, to).toISOString(),
  recurring_weekly: true,
});
const team = (id: string, name: string, elo: number | null, windows: any[]) => ({
  id,
  name,
  avatar_url: null,
  ranks: { avg_elo: elo, roster_size: 5 },
  reputation: { scrims_completed: 10, no_shows: 0, late_cancels: 0, reliability_pct: 100 },
  scrim_availability: windows,
});
const posting = (id: string, settings: any, teamRow: any) => ({
  id: `s-${id}`,
  team_id: id,
  regions: ["US East"],
  map_ids: [],
  notes: "",
  elo_min: null,
  elo_max: null,
  allow_outside_availability: false,
  ...settings,
  team: teamRow,
});

const owls = posting("owls", {}, team("owls", "Night Owls", 5410, [weekly(3, 21 * 60, 24 * 60 + 30)]));
const hollow = posting("hollow", { elo_min: 6500 }, team("hollow", "Hollow Point", 7480, [weekly(3, 20 * 60, 23 * 60)]));
const flock = posting(
  "flock",
  {},
  team("flock", "FlockMunchers", 5890, [
    {
      starts_at: new Date(at(0, 19, 30)).toISOString(),
      ends_at: new Date(at(0, 21, 30)).toISOString(),
      recurring_weekly: false,
    },
  ]),
);
const storm = posting("storm", {}, team("storm", "Storm Surge", 5620, [weekly(4, 20 * 60, 23 * 60)]));

const myTeam = {
  ...team("bb", "Buttah Boyz", 5240, [weekly(3, 20 * 60, 23 * 60 + 30), weekly(4, 20 * 60, 23 * 60 + 30)]),
  scrim_settings: { enabled: true, regions: ["US East"], map_ids: [], elo_min: 4000, elo_max: 6500 },
};
const requests = [
  {
    id: "r1",
    status: "Pending",
    from_team_id: "storm",
    to_team_id: "bb",
    awaiting_team_id: "bb",
    proposed_scheduled_at: new Date(at(1, 20)).toISOString(),
  },
];

async function mountBoard(props: Record<string, unknown> = {}) {
  return mountSuspended(ScrimBoard, {
    props: {
      postings: [owls, hollow, flock, storm],
      myTeam,
      requests,
      mapsById: {},
      now,
      ...props,
    },
  });
}

const rowText = (wrapper: any, name: string) =>
  wrapper
    .findAll("section")
    .flatMap((section: any) => section.findAll("div.relative.grid"))
    .filter((row: any) => row.text().includes(name))
    .map((row: any) => row.text());

describe("ScrimBoard", () => {
  it("puts teams that are open right now first, then each day", async () => {
    const wrapper = await mountBoard();
    const heads = wrapper.findAll("section h2").map((h) => h.text());
    expect(heads[0]).toBe("Open now");
    expect(heads[1]).toBe("Today");
    expect(heads[2]).toBe("Tomorrow");
    expect(rowText(wrapper, "FlockMunchers")[0]).toContain("Now");
  });

  it("tags each row with how it fits your team", async () => {
    const wrapper = await mountBoard();
    expect(rowText(wrapper, "Night Owls")[0]).toContain("Both free");
    expect(rowText(wrapper, "Hollow Point")[0]).toContain("Outside their range");
    expect(rowText(wrapper, "Storm Surge")[0]).toContain("Needs you");
  });

  it("hides teams outside either range with Fits", async () => {
    const wrapper = await mountBoard();
    const fits = wrapper.findAll("button").find((b) => b.text().includes("Fits Buttah Boyz"))!;
    await fits.trigger("click");
    expect(rowText(wrapper, "Hollow Point")).toEqual([]);
    expect(rowText(wrapper, "Night Owls").length).toBeGreaterThan(0);
  });

  it("filters by name", async () => {
    const wrapper = await mountBoard();
    await wrapper.find("input[type=text]").setValue("owls");
    expect(rowText(wrapper, "Hollow Point")).toEqual([]);
    expect(rowText(wrapper, "Night Owls").length).toBeGreaterThan(0);
  });

  it("opens a row at its first start", async () => {
    const wrapper = await mountBoard();
    const row = wrapper
      .findAll("section div.relative.grid")
      .find((r) => r.text().includes("Night Owls"))!;
    await row.find("button").trigger("click");
    const [[openedPosting, openedAt]] = wrapper.emitted("open") as any;
    expect(openedPosting.id).toBe("s-owls");
    expect(openedAt).toBe(at(0, 21));
  });

  it("shows teams without a fit column when you run no team", async () => {
    const wrapper = await mountBoard({ myTeam: null, requests: [] });
    expect(wrapper.text()).not.toContain("Both free");
    expect(wrapper.text()).not.toContain("Fits");
  });
});

describe("ScrimRequestForm", () => {
  async function mountForm(initialAt: number | null = at(0, 21)) {
    return mountSuspended(ScrimRequestForm, {
      props: { posting: owls, team: myTeam, now, initialAt },
    });
  }

  it("starts on the time picked from the board", async () => {
    const wrapper = await mountForm();
    const pressed = wrapper.findAll("button[aria-pressed=true]").map((b) => b.text());
    expect(pressed).toContain("9:00 PM");
    expect(wrapper.text()).toContain("Both free");
  });

  it("only offers series that fit inside their hours", async () => {
    const wrapper = await mountForm();
    const series = wrapper.findAll("button").filter((b) => b.text().startsWith("Best of"));
    expect(series.map((b) => b.attributes("disabled") !== undefined)).toEqual([false, false, true]);
  });

  it("sends the request for the picked time", async () => {
    mutate.mockClear();
    const wrapper = await mountForm();
    await wrapper.find("form").trigger("submit");
    expect(mutate).toHaveBeenCalledTimes(1);
    const sent = JSON.stringify(mutate.mock.calls[0][0].mutation);
    expect(sent).toContain("sendScrimRequest");
    expect(sent).toContain(new Date(at(0, 21)).toISOString());
  });
});
