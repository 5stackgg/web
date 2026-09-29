import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TeamMember from "~/components/teams/TeamMember.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const ME = "76561198000000001";
const OWNER = "76561198000000002";
const MEMBER = "76561198000000003";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
});

async function openMemberMenu(steamId: string, isOwner: boolean) {
  useAuthStore().me = {
    steam_id: ME,
    name: "Roster Admin",
    role: e_player_roles_enum.user,
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(TeamMember, {
    props: {
      team: {
        id: "team-1",
        can_change_role: true,
        can_remove: true,
      },
      member: {
        role: "Admin",
        coach: false,
        status: "Starter",
        team_id: "team-1",
        roster_image_url: null,
        player: {
          steam_id: steamId,
          name: "Player",
          avatar_url: null,
        },
      },
      roles: [{ value: "Member", description: "Can play" }],
      isInvite: false,
      isOwner,
    },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();

  await wrapper
    .find("button[aria-haspopup='menu']")
    .trigger("keydown", { key: "Enter" });
  await flushPromises();

  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).map((item) => item.textContent?.trim() ?? "");
}

describe("TeamMember owner row", () => {
  it("offers role changes and removal on a regular member", async () => {
    const items = await openMemberMenu(MEMBER, false);

    expect(items.some((item) => item.startsWith("Role"))).toBe(true);
    expect(items).toContain("Remove Member");
  });

  it("hides role changes and removal on the owner's row", async () => {
    const items = await openMemberMenu(OWNER, true);

    expect(items.some((item) => item.startsWith("Role"))).toBe(false);
    expect(items).not.toContain("Remove Member");
    expect(items.some((item) => item.startsWith("Status"))).toBe(true);
  });
});
