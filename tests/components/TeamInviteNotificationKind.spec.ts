import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TeamInviteNotification from "~/components/TeamInviteNotification.vue";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

const invite = (team: Record<string, unknown>) => ({
  id: "invite-1",
  created_at: "2026-10-21T08:00:00Z",
  invited_by: { steam_id: "76561198000000001", name: "sniddyus" },
  team: {
    id: "entry-1",
    tournament: { id: "tournament-1", name: "VulkanLAN 2026" },
    ...team,
  },
});

async function mountInvite(team: Record<string, unknown>) {
  const wrapper = await mountSuspended(TeamInviteNotification, {
    props: { invite: invite(team), type: "tournament" },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

describe("TeamInviteNotification for an invite onto a tournament entry", () => {
  it("says an invite onto a team-backed entry joins the team and its lineup", async () => {
    const wrapper = await mountInvite({
      name: null,
      team_id: "team-1",
      team: { name: "Ultima Ratio" },
    });

    expect(wrapper.find("h3").text()).toBe("Team Invite");
    expect(wrapper.text()).toContain("Join Ultima Ratio and its lineup for");
    expect(wrapper.find("a").attributes("href")).toBe(
      "/tournaments/tournament-1",
    );
  });

  it("says an invite onto a tournament-only team is for this tournament only", async () => {
    const wrapper = await mountInvite({
      name: "Friday Mix",
      team_id: null,
      team: null,
    });

    expect(wrapper.find("h3").text()).toBe("Tournament Invite");
    expect(wrapper.text()).toContain(
      "Join Friday Mix, a team for this tournament only, in",
    );
  });
});
