import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";
import type { RouteLocationNormalized } from "vue-router";
import { e_player_roles_enum } from "~/generated/zeus";
import tournamentCreate from "~/middleware/tournament-create";

const { navigateToMock } = vi.hoisted(() => ({
  navigateToMock: vi.fn((to: unknown) => to),
}));

mockNuxtImport("navigateTo", () => navigateToMock);

const ROLE_ORDER = [
  e_player_roles_enum.user,
  e_player_roles_enum.verified_user,
  e_player_roles_enum.streamer,
  e_player_roles_enum.moderator,
  e_player_roles_enum.match_organizer,
  e_player_roles_enum.tournament_organizer,
  e_player_roles_enum.administrator,
];

const auth = reactive({
  me: undefined as { role: e_player_roles_enum } | undefined,
  hasCheckedSession: true,
  getMe: vi.fn(async () => true),
  isRoleAbove(role: e_player_roles_enum) {
    const roleIndex = ROLE_ORDER.indexOf(role);
    if (!auth.me || roleIndex === -1) {
      return false;
    }
    return ROLE_ORDER.indexOf(auth.me.role) >= roleIndex;
  },
});

const settings = reactive({
  settingsLoaded: false,
  tournamentCreateRole: e_player_roles_enum.user as e_player_roles_enum,
});

vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));
vi.mock("~/stores/ApplicationSettings", () => ({
  useApplicationSettingsStore: () => settings,
}));

const to = { path: "/tournaments/create" } as RouteLocationNormalized;

function run() {
  return tournamentCreate(to, to);
}

beforeEach(() => {
  navigateToMock.mockClear();
  auth.getMe.mockReset();
  auth.getMe.mockResolvedValue(true);
  auth.me = { role: e_player_roles_enum.user };
  auth.hasCheckedSession = true;
  settings.settingsLoaded = true;
  settings.tournamentCreateRole = e_player_roles_enum.user;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("tournament-create middleware", () => {
  it("lets a player through when the role gate allows it", async () => {
    settings.tournamentCreateRole = e_player_roles_enum.tournament_organizer;
    auth.me = { role: e_player_roles_enum.tournament_organizer };

    await expect(run()).resolves.toBeUndefined();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it("sends a player below the configured role back to tournaments", async () => {
    settings.tournamentCreateRole = e_player_roles_enum.tournament_organizer;
    auth.me = { role: e_player_roles_enum.match_organizer };

    await run();

    expect(navigateToMock).toHaveBeenCalledWith("/tournaments");
  });

  it("waits for settings before judging the role", async () => {
    settings.settingsLoaded = false;
    settings.tournamentCreateRole = e_player_roles_enum.user;

    let settled = false;
    const result = run().then((value) => {
      settled = true;
      return value;
    });

    await flushPromises();
    expect(settled).toBe(false);
    expect(navigateToMock).not.toHaveBeenCalled();

    settings.tournamentCreateRole = e_player_roles_enum.administrator;
    settings.settingsLoaded = true;
    await result;

    expect(navigateToMock).toHaveBeenCalledWith("/tournaments");
  });

  it("fails closed when settings never arrive", async () => {
    vi.useFakeTimers();
    settings.settingsLoaded = false;

    const result = run();
    await vi.advanceTimersByTimeAsync(10000);
    await result;

    expect(navigateToMock).toHaveBeenCalledWith("/tournaments");
  });

  it("checks the session before deciding", async () => {
    auth.hasCheckedSession = false;
    auth.me = undefined;
    auth.getMe.mockImplementation(async () => {
      auth.me = { role: e_player_roles_enum.administrator };
      return true;
    });

    await run();

    expect(auth.getMe).toHaveBeenCalledOnce();
    expect(navigateToMock).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to login and back", async () => {
    auth.me = undefined;

    await run();

    expect(navigateToMock).toHaveBeenCalledWith(
      "/login?redirect=/tournaments/create",
    );
  });
});
