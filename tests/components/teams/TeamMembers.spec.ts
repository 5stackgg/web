import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import TeamMembers from "~/components/teams/TeamMembers.vue";
import TeamMember from "~/components/teams/TeamMember.vue";

const OWNER = "76561198000000002";
const MEMBER = "76561198000000003";
const SUBSTITUTE = "76561198000000004";
const BENCHED = "76561198000000005";
const COACH = "76561198000000006";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

function rosterRow(
  steamId: string,
  role: string,
  status = "Starter",
  coach = false,
) {
  return {
    role,
    coach,
    status,
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

  it.each([
    ["starter", "Starter", false],
    ["substitute", "Substitute", false],
    ["benched", "Benched", false],
    ["coach", "Starter", true],
  ])("flags only the owner when they are a %s", async (_, status, coach) => {
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
      roster: [
        rosterRow(OWNER, "Admin", status as string, coach as boolean),
        rosterRow(MEMBER, "Admin"),
        rosterRow(SUBSTITUTE, "Member", "Substitute"),
        rosterRow(BENCHED, "Member", "Benched"),
        rosterRow(COACH, "Member", "Starter", true),
      ],
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

    expect(owners).toEqual({
      [OWNER]: true,
      [MEMBER]: false,
      [SUBSTITUTE]: false,
      [BENCHED]: false,
      [COACH]: false,
    });
  });
});
