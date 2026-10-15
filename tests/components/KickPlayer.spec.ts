import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import KickPlayer from "~/components/KickPlayer.vue";
import { useAuthStore } from "~/stores/AuthStore";

const OUTRANKED = "Only someone with a role above this player's can do this.";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
});

async function mountKick(viewer: string, target: string | null) {
  useAuthStore().me = { steam_id: "76561198000000099", role: viewer } as any;
  const wrapper = await mountSuspended(KickPlayer, {
    props: {
      player: { steam_id: "76561198000000001", name: "Player", role: target },
      serverId: "server-1",
    },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper.get('button[aria-label="Kick"]');
}

describe("KickPlayer by role", () => {
  it("offers a moderator the kick on a player below them", async () => {
    const kick = await mountKick("moderator", "streamer");

    expect(kick.attributes("disabled")).toBeUndefined();

    await kick.trigger("click");
    await flushPromises();

    expect(document.body.textContent).toContain("Kick Player");
  });

  it.each([
    ["moderator", "moderator"],
    ["administrator", "tournament_organizer"],
  ])(
    "disables the kick on a %s for a %s, and says why",
    async (target, viewer) => {
      const kick = await mountKick(viewer, target);

      expect(kick.attributes("disabled")).toBeDefined();

      kick.element.closest<HTMLElement>("span[tabindex]")?.focus();
      await flushPromises();

      expect(
        document.body.querySelector('[role="tooltip"]')?.textContent,
      ).toContain(OUTRANKED);
    },
  );
});
