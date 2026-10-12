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
  canChangeRole?: boolean;
}) {
  const wrapper = await mountSuspended(TeamMember, {
    attachTo: document.body,
    props: {
      team: { id: "team-1", can_change_role: options.canChangeRole ?? false },
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
      roles: [
        { value: "Member", description: "Basic Membership" },
        { value: "Invite", description: "Ability Invite / Add Players" },
      ],
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

describe("TeamMember role label in the viewer's language", () => {
  const i18n = () => (useNuxtApp() as any).$i18n;

  afterEach(async () => {
    await i18n().setLocale("en");
  });

  it.each([
    ["de", "Member", "Mitglied"],
    ["de", "Invite", "Einladen"],
    ["ja", "Admin", "管理者"],
    ["en", "Member", "Member"],
  ])("names a %s roster's %s role %s", async (locale, role, label) => {
    await i18n().setLocale(locale);
    const wrapper = await mountMember({
      isOwner: false,
      isCaptain: false,
      role,
    });

    expect(labels(wrapper)).toEqual([label]);
  });

  it("names the roles in the change-role menu", async () => {
    await i18n().setLocale("de");
    const wrapper = await mountMember({
      isOwner: false,
      isCaptain: false,
      role: "Member",
      canChangeRole: true,
    });

    await wrapper
      .find("button[aria-haspopup='menu']")
      .trigger("keydown", { key: "Enter" });
    await flushPromises();
    const roleItem = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ).find((item) => item.textContent?.includes("Rolle"));
    expect(roleItem?.textContent).toContain("Mitglied");
    expect(roleItem?.textContent).not.toContain("Member");

    roleItem!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await flushPromises();
    const names = Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menuitem"] > div'),
    ).map((row) => row.firstElementChild?.textContent?.trim());
    expect(names).toEqual(["Mitglied", "Einladen"]);
  });
});
