import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const ME = "76561198000000001";
const SOMEONE = "76561198000000002";
const LOCKED_REASON =
  "You can only join with teams where you're the owner, captain or an admin.";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
});

const team = (
  id: string,
  name: string,
  role: string,
  options: { owner?: boolean; captain?: boolean } = {},
) => ({
  id,
  name,
  short_name: id.toUpperCase(),
  avatar_url: null,
  role,
  owner_steam_id: options.owner ? ME : SOMEONE,
  captain_steam_id: options.captain ? ME : SOMEONE,
});

async function openPicker() {
  useAuthStore().me = {
    steam_id: ME,
    name: "Player",
    role: e_player_roles_enum.user,
    teams: [
      team("iw", "Iron Wolves", "Admin", { owner: true }),
      team("no", "Night Owls", "Admin"),
      team("rk", "Rookies", "Member"),
      team("cp", "Captains", "Admin", { captain: true }),
      team("pi", "Pending", "Invite"),
    ],
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(TeamSearch, {
    props: {
      label: "Select a team",
      myTeams: true,
      isAdmin: true,
      tournamentJoinSelector: true,
    },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await wrapper.find("button[aria-expanded]").trigger("click");
  await flushPromises();

  return Array.from(
    document.body.querySelectorAll<HTMLElement>(".divide-y > div"),
  );
}

function row(rows: HTMLElement[], name: string) {
  const found = rows.find((candidate) => candidate.textContent?.includes(name));
  expect(found, name).toBeDefined();
  return found!;
}

const selectable = (element: HTMLElement) =>
  element.className.includes("cursor-pointer");

describe("TeamSearch tournament join picker", () => {
  it("lets a team Admin pick the team, labelled Admin", async () => {
    const rows = await openPicker();
    const owls = row(rows, "Night Owls");

    expect(selectable(owls)).toBe(true);
    expect(owls.textContent).toContain("Admin");
    expect(owls.textContent).not.toContain("Locked");
  });

  it("labels Owner before Captain before Admin", async () => {
    const rows = await openPicker();

    expect(row(rows, "Iron Wolves").textContent).toContain("Owner");
    expect(row(rows, "Iron Wolves").textContent).not.toContain("Admin");
    expect(row(rows, "Captains").textContent).toContain("Captain");
    expect(row(rows, "Captains").textContent).not.toContain("Admin");
  });

  it("keeps members and pending invites locked, naming every role that may join", async () => {
    const rows = await openPicker();

    for (const name of ["Rookies", "Pending"]) {
      const locked = row(rows, name);
      expect(selectable(locked)).toBe(false);
      expect(locked.textContent).toContain("Locked");
      expect(locked.textContent).toContain(LOCKED_REASON);
    }
  });
});
