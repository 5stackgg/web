import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentTeamMemberRow from "~/components/tournament/TournamentTeamMemberRow.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const ME = "76561198000000001";
const CAPTAIN = "76561198000000002";
const MEMBER = "76561198000000003";
const LOCKED =
  "The bracket is seeded, so the roster can't drop below 5. Add a substitute first.";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
});

async function mountRow(options: {
  status: string;
  canManage?: boolean;
  isOrganizer?: boolean;
  platformRole?: e_player_roles_enum;
  memberSteamId?: string;
  rosterLockedAtMin?: boolean;
}) {
  useAuthStore().me = {
    steam_id: ME,
    name: "Viewer",
    role: options.platformRole ?? e_player_roles_enum.user,
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(TournamentTeamMemberRow, {
    props: {
      team: {
        id: "tournament-team-1",
        captain_steam_id: CAPTAIN,
        can_manage: options.canManage ?? false,
      },
      tournament: {
        id: "tournament-1",
        status: options.status,
        is_organizer: options.isOrganizer ?? false,
        min_players_per_lineup: 5,
      },
      member: {
        role: "Member",
        player: {
          steam_id: options.memberSteamId ?? MEMBER,
          name: "dusk",
          avatar_url: null,
        },
      },
      roles: [{ value: "Member", description: "Plays" }],
      canLeave: true,
      rosterLockedAtMin: options.rosterLockedAtMin ?? false,
    },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountRow>>;

async function menuItems(wrapper: Wrapper) {
  const trigger = wrapper.find("button[aria-haspopup='menu']");
  if (!trigger.exists()) {
    return [];
  }
  await trigger.trigger("keydown", { key: "Enter" });
  await flushPromises();
  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  );
}

async function removeItem(wrapper: Wrapper) {
  return (await menuItems(wrapper)).find((item) =>
    item.textContent?.includes("Remove Member"),
  );
}

const hasRoleEditor = (wrapper: Wrapper) =>
  wrapper
    .findAll("button")
    .some(
      (button) =>
        button.attributes("aria-haspopup") !== "menu" &&
        button.text().includes("Member"),
    );

describe("TournamentTeamMemberRow Remove Member", () => {
  it("is offered to a team manager before the tournament is live", async () => {
    const wrapper = await mountRow({
      status: "RegistrationOpen",
      canManage: true,
    });

    expect(await removeItem(wrapper)).toBeDefined();
  });

  it("is offered to a team manager while the tournament is paused", async () => {
    const wrapper = await mountRow({ status: "Paused", canManage: true });

    expect(await removeItem(wrapper)).toBeDefined();
  });

  it("leaves role changes to organizers", async () => {
    const wrapper = await mountRow({
      status: "RegistrationOpen",
      canManage: true,
    });

    expect(hasRoleEditor(wrapper)).toBe(false);
  });

  it("is not offered to a team manager once the tournament is live", async () => {
    const wrapper = await mountRow({ status: "Live", canManage: true });

    expect(await removeItem(wrapper)).toBeUndefined();
  });

  it("is offered while live to a tournament organizer session", async () => {
    const wrapper = await mountRow({
      status: "Live",
      isOrganizer: true,
      canManage: true,
      platformRole: e_player_roles_enum.tournament_organizer,
    });

    expect(await removeItem(wrapper)).toBeDefined();
  });

  it("is not offered while live to an organizer without the organizer role", async () => {
    const wrapper = await mountRow({ status: "Live", isOrganizer: true });

    expect(await removeItem(wrapper)).toBeUndefined();
  });

  for (const status of ["Finished", "Cancelled", "CancelledMinTeams"]) {
    it(`is not offered to an organizer once the tournament is ${status}`, async () => {
      const wrapper = await mountRow({
        status,
        isOrganizer: true,
        canManage: true,
        platformRole: e_player_roles_enum.administrator,
      });

      expect(await removeItem(wrapper)).toBeUndefined();
    });
  }

  it("is never offered on your own row, which offers Leave Team", async () => {
    const wrapper = await mountRow({
      status: "RegistrationOpen",
      canManage: true,
      memberSteamId: ME,
    });
    const items = await menuItems(wrapper);

    expect(items.some((item) => item.textContent?.includes("Leave Team"))).toBe(
      true,
    );
    expect(
      items.some((item) => item.textContent?.includes("Remove Member")),
    ).toBe(false);
  });

  it("is not offered to a player who cannot manage the team", async () => {
    const wrapper = await mountRow({ status: "RegistrationOpen" });

    expect(await removeItem(wrapper)).toBeUndefined();
  });

  for (const viewer of [
    { name: "an organizer", isOrganizer: true },
    { name: "a team manager", canManage: true },
  ]) {
    it(`explains the minimum-lineup lock to ${viewer.name} by hover or keyboard`, async () => {
      const wrapper = await mountRow({
        status: "RegistrationClosed",
        rosterLockedAtMin: true,
        ...viewer,
      });
      const item = await removeItem(wrapper);

      expect(item).toBeDefined();
      expect(item!.getAttribute("aria-disabled")).toBe("true");
      expect(item!.hasAttribute("title")).toBe(false);
      expect(
        document.body.querySelector(`[aria-label="${LOCKED}"]`),
      ).not.toBeNull();

      for (let step = 0; step < 3 && document.activeElement !== item; step++) {
        (document.activeElement as HTMLElement).dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
        await flushPromises();
      }
      expect(document.activeElement).toBe(item);
      expect(
        document.body.querySelector('[role="tooltip"]')?.textContent,
      ).toContain(LOCKED);

      item!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      await flushPromises();
      expect(document.body.textContent).not.toContain(
        "Are you sure you want to remove this member?",
      );
    });
  }
});

describe("TournamentTeamMemberRow role label in the viewer's language", () => {
  const i18n = () => (useNuxtApp() as any).$i18n;

  afterEach(async () => {
    await i18n().setLocale("en");
  });

  it.each([
    ["a viewer", { status: "Live" }],
    ["a team manager", { status: "RegistrationOpen", canManage: true }],
    [
      "an organizer",
      {
        status: "RegistrationOpen",
        isOrganizer: true,
        platformRole: e_player_roles_enum.tournament_organizer,
      },
    ],
  ])("names the role for %s", async (_, options) => {
    await i18n().setLocale("de");
    const wrapper = await mountRow(options);

    expect(wrapper.text()).toContain("Mitglied");
    expect(wrapper.text()).not.toContain("Member");
  });

  it("names the roles an organizer can pick", async () => {
    await i18n().setLocale("de");
    const wrapper = await mountRow({
      status: "RegistrationOpen",
      isOrganizer: true,
      platformRole: e_player_roles_enum.tournament_organizer,
    });

    const roleButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Mitglied"));
    await roleButton!.trigger("click");
    await flushPromises();

    const names = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="option"]'),
    ).map((option) => option.firstElementChild?.textContent?.trim());
    expect(names).toEqual(["Mitglied"]);
  });
});
