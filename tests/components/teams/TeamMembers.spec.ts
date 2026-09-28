import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import TeamMembers from "~/components/teams/TeamMembers.vue";
import TeamMember from "~/components/teams/TeamMember.vue";

const OWNER = "76561198000000002";
const MEMBER = "76561198000000003";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

function rosterRow(steamId: string, role: string) {
  return {
    role,
    coach: false,
    status: "Starter",
    team_id: "team-1",
    roster_image_url: null,
    player: { steam_id: steamId, name: steamId, avatar_url: null },
  };
}

describe("TeamMembers owner", () => {
  it("selects the team owner in the roster subscription", () => {
    const subscription = (TeamMembers as any).apollo.$subscribe.teams_by_pk;

    expect(print(subscription.query)).toMatch(/\bowner_steam_id\b/);
  });

  it("marks only the owner's row as the owner", async () => {
    const wrapper = await mountSuspended(TeamMembers, {
      props: { teamId: "team-1" },
      global: { stubs: { TeamMember: true, PlayerSearch: true } },
    });
    unmount = () => wrapper.unmount();

    (wrapper.vm as any).team = {
      id: "team-1",
      owner_steam_id: OWNER,
      captain_steam_id: OWNER,
      can_invite: false,
      can_remove: true,
      can_change_role: true,
      roster: [rosterRow(OWNER, "Admin"), rosterRow(MEMBER, "Admin")],
    };
    await flushPromises();

    const owners = Object.fromEntries(
      wrapper
        .findAllComponents(TeamMember)
        .map((member) => [
          member.props("member").player.steam_id,
          member.props("isOwner"),
        ]),
    );

    expect(owners).toEqual({ [OWNER]: true, [MEMBER]: false });
  });
});
