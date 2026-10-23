import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerVacBadge from "~/components/PlayerVacBadge.vue";

async function heroBadge(player: Record<string, any>) {
  const wrapper = await mountSuspended(PlayerVacBadge, {
    props: { player, variant: "button" },
  });
  return wrapper.find("button");
}

describe("PlayerVacBadge hero button", () => {
  it("shows a FACEIT cheating ban on its own", async () => {
    const button = await heroBadge({
      faceit_banned_at: "2026-10-01T00:00:00Z",
    });

    expect(button.attributes("aria-label")).toBe(
      "Banned on FACEIT for cheating",
    );
    expect(button.classes()).toContain("text-destructive");
    expect(button.find("svg.lucide-shield-ban-icon").exists()).toBe(true);
  });

  it("leads with the VAC ban when FACEIT has banned the player too", async () => {
    const button = await heroBadge({
      vac_banned: true,
      vac_ban_count: 1,
      faceit_banned_at: "2026-10-01T00:00:00Z",
    });

    expect(button.attributes("aria-label")).toBe("VAC banned on Steam");
  });

  it("keeps a game ban orange", async () => {
    const button = await heroBadge({ game_ban_count: 1 });

    expect(button.attributes("aria-label")).toBe("Game banned on Steam");
    expect(button.classes()).toContain("text-orange-400");
  });

  it("renders nothing for a player with no bans", async () => {
    expect((await heroBadge({ faceit_banned_at: null })).exists()).toBe(false);
  });
});
