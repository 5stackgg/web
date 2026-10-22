import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerPeekSheet from "~/components/player/PlayerPeekSheet.vue";
import PlayerRoleForm from "~/components/PlayerRoleForm.vue";
import { e_player_roles_enum } from "~/generated/zeus";

const TARGET = "76561198000000002";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  document.body.innerHTML = "";
});

async function mountSheet(viewerRole: e_player_roles_enum) {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Viewer",
    role: viewerRole,
  } as unknown as ReturnType<typeof useAuthStore>["me"];

  const wrapper = await mountSuspended(PlayerPeekSheet, {
    props: {
      open: true,
      kd: "1.04",
      player: {
        steam_id: TARGET,
        name: "zalrus",
        role: e_player_roles_enum.verified_user,
        wins: 22,
        losses: 19,
        elo_competitive: 4977,
        last_sign_in_at: new Date(
          Date.now() - 3 * 60 * 60 * 1000,
        ).toISOString(),
      },
    },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

const sheet = () =>
  document.querySelector("[data-vaul-drawer]") as HTMLElement;

describe("PlayerPeekSheet", () => {
  it("heads with the player and when they signed in, then the numbers", async () => {
    await mountSheet(e_player_roles_enum.administrator);

    const text = sheet().textContent?.replace(/\s+/g, " ");
    expect(text).toContain("zalrus");
    expect(text).toContain("Signed in 3 hours ago");
    expect(text).toContain("22–19");
    expect(text).toContain("1.04");
  });

  it("lists the privileges with the player's own checked", async () => {
    await mountSheet(e_player_roles_enum.administrator);

    const roles = Array.from(
      sheet().querySelectorAll<HTMLElement>('[role="radio"]'),
    );
    expect(roles.map((role) => role.textContent?.trim())).toEqual([
      "User",
      "Verified User",
      "Streamer",
      "Moderator",
      "Match Organizer",
      "Tournament Organizer",
      "Administrator",
    ]);
    expect(
      roles
        .filter((role) => role.getAttribute("aria-checked") === "true")
        .map((role) => role.textContent?.trim()),
    ).toEqual(["Verified User"]);
  });

  it("passes a saved privilege up", async () => {
    const wrapper = await mountSheet(e_player_roles_enum.administrator);

    wrapper
      .findComponent(PlayerRoleForm)
      .vm.$emit("updated", e_player_roles_enum.moderator);

    expect(wrapper.emitted("role-updated")).toEqual([
      [e_player_roles_enum.moderator],
    ]);
  });

  it("ends on the way to the profile", async () => {
    await mountSheet(e_player_roles_enum.administrator);

    const link = Array.from(sheet().querySelectorAll("a[href]")).find(
      (a) => a.textContent?.trim() === "Open profile",
    );
    expect(link?.getAttribute("href")).toBe(`/players/${TARGET}`);
  });
});
