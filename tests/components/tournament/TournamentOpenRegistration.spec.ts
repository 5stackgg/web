import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config, flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentDetail from "~/components/tournament/TournamentDetail.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const OWNER = "76561198000000001";
const CO_ORGANIZER = "76561198000000002";
const START_PASSED =
  "The start time has passed. Move it forward to reopen registration.";
const NO_STAGES = "Add a stage first.";
const FULL = "The bracket is full.";

const HOUR = 60 * 60 * 1000;

const stage = (order: number, maxTeams: number) => ({
  id: `stage-${order}`,
  order,
  type: "SingleElimination",
  min_teams: 2,
  max_teams: maxTeams,
  brackets: [],
  results: [],
});

const team = (id: string, eligible: boolean) => ({
  id,
  name: id,
  roster: [],
  eligible_at: eligible ? "2026-10-01T10:00:00Z" : null,
});

let mounted: { unmount: () => void } | null = null;

beforeEach(() => {
  config.global.renderStubDefaultSlot = true;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  config.global.renderStubDefaultSlot = false;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

async function mountMenu(
  overrides: Record<string, unknown>,
  viewer: { steamId?: string; role?: e_player_roles_enum } = {},
) {
  useAuthStore().me = {
    steam_id: viewer.steamId ?? OWNER,
    name: "Organizer",
    role: viewer.role ?? e_player_roles_enum.user,
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(TournamentDetail, {
    route: "/tournaments/t-1",
    shallow: true,
    global: { stubs: { FiveStackToolTip: false } },
  });
  mounted = wrapper;
  (wrapper.vm as any).tournamentLive = {
    id: "t-1",
    name: "Autumn Cup",
    status: "Setup",
    e_tournament_status: { description: "Setup" },
    is_organizer: true,
    can_open_registration: false,
    start: new Date(Date.now() + 24 * HOUR).toISOString(),
    admin: { steam_id: OWNER, name: "Organizer" },
    options: { type: "Competitive", mr: 12, best_of: 1 },
    organizers: [],
    teams: [],
    stages: [stage(1, 8)],
    ...overrides,
  };
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountMenu>>;

const isDisabled = (item: { attributes: (name: string) => string | undefined }) =>
  ![undefined, "false"].includes(item.attributes("disabled"));

const openRegistration = (wrapper: Wrapper) =>
  wrapper
    .findAll("dropdown-menu-item-stub")
    .find((item) => item.text().includes("Open Registration"));

function blockedReasons(wrapper: Wrapper) {
  const item = openRegistration(wrapper);
  expect(item, "Open Registration").toBeDefined();
  expect(isDisabled(item!)).toBe(true);
  const triangle = item!.element.parentElement!.querySelector(
    "[role='img'][aria-label]",
  );
  expect(triangle, "triangle").not.toBeNull();
  return triangle!.getAttribute("aria-label");
}

describe("tournament status menu Open Registration", () => {
  it("is offered when the api allows it", async () => {
    const wrapper = await mountMenu({ can_open_registration: true });
    const item = openRegistration(wrapper);

    expect(item).toBeDefined();
    expect(isDisabled(item!)).toBe(false);
  });

  it("says the start time has passed", async () => {
    const wrapper = await mountMenu({
      start: new Date(Date.now() - HOUR).toISOString(),
    });

    expect(blockedReasons(wrapper)).toBe(START_PASSED);
  });

  it("says to add a stage first", async () => {
    const wrapper = await mountMenu({ stages: [] });

    expect(blockedReasons(wrapper)).toBe(NO_STAGES);
  });

  it("says the bracket is full once the first stage's slots are taken by eligible teams", async () => {
    const wrapper = await mountMenu({
      status: "RegistrationClosed",
      stages: [stage(1, 2), stage(2, 2)],
      teams: [team("a", true), team("b", true), team("c", false)],
    });

    expect(blockedReasons(wrapper)).toBe(FULL);
  });

  it("names every reason that applies", async () => {
    const wrapper = await mountMenu({
      start: new Date(Date.now() - HOUR).toISOString(),
      stages: [],
    });

    expect(blockedReasons(wrapper)).toBe(`${START_PASSED} ${NO_STAGES}`);
  });

  it("does not call a full bracket a reason during check-in review", async () => {
    const wrapper = await mountMenu({
      status: "CheckInReview",
      start: new Date(Date.now() - HOUR).toISOString(),
      stages: [stage(1, 2)],
      teams: [team("a", true), team("b", true)],
    });

    expect(blockedReasons(wrapper)).toBe(START_PASSED);
  });

  it("reads the clock again each time the menu opens", async () => {
    const wrapper = await mountMenu({
      start: new Date(Date.now() + HOUR).toISOString(),
    });

    expect(openRegistration(wrapper)).toBeUndefined();

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * HOUR);
    const statusMenu = wrapper
      .findAllComponents({ name: "DropdownMenu" })
      .find((menu) => menu.text().includes("Tournament status"));
    statusMenu!.vm.$emit("update:open", true);
    await flushPromises();

    expect(blockedReasons(wrapper)).toBe(START_PASSED);
  });

  it("stays hidden when the status can't open registration", async () => {
    const wrapper = await mountMenu({
      status: "Live",
      start: new Date(Date.now() - HOUR).toISOString(),
    });

    expect(openRegistration(wrapper)).toBeUndefined();
  });

  it("stays hidden from a co-organizer the api would refuse anyway", async () => {
    const wrapper = await mountMenu(
      { start: new Date(Date.now() - HOUR).toISOString() },
      { steamId: CO_ORGANIZER },
    );

    expect(openRegistration(wrapper)).toBeUndefined();
  });

  it("explains itself to a tournament organizer who does not own the tournament", async () => {
    const wrapper = await mountMenu(
      { start: new Date(Date.now() - HOUR).toISOString() },
      {
        steamId: CO_ORGANIZER,
        role: e_player_roles_enum.tournament_organizer,
      },
    );

    expect(blockedReasons(wrapper)).toBe(START_PASSED);
  });
});
