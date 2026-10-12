import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TeamMember from "~/components/teams/TeamMember.vue";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

async function mountMember(options: {
  isOwner: boolean;
  isCaptain: boolean;
  role: string;
}) {
  const wrapper = await mountSuspended(TeamMember, {
    props: {
      team: { id: "team-1" },
      member: {
        role: options.role,
        coach: false,
        status: "Starter",
        team_id: "team-1",
        roster_image_url: null,
        player: {
          steam_id: "76561198000000002",
          name: "kairo",
          avatar_url: null,
        },
      },
      roles: [],
      isInvite: false,
      isOwner: options.isOwner,
      isCaptain: options.isCaptain,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

const labels = (wrapper: Awaited<ReturnType<typeof mountMember>>) =>
  wrapper
    .findAll("span.uppercase")
    .map((span) => span.text())
    .filter(Boolean);

describe("TeamMember role label", () => {
  it("names the owner Owner instead of their roster role", async () => {
    const wrapper = await mountMember({
      isOwner: true,
      isCaptain: false,
      role: "Admin",
    });

    expect(labels(wrapper)).toContain("Owner");
    expect(labels(wrapper)).not.toContain("Admin");
  });

  it("keeps the Captain badge beside Owner", async () => {
    const wrapper = await mountMember({
      isOwner: true,
      isCaptain: true,
      role: "Admin",
    });

    expect(labels(wrapper)).toEqual(["Owner", "Captain"]);
  });

  it("still shows another admin as Admin", async () => {
    const wrapper = await mountMember({
      isOwner: false,
      isCaptain: false,
      role: "Admin",
    });

    expect(labels(wrapper)).toContain("Admin");
    expect(labels(wrapper)).not.toContain("Owner");
  });
});
