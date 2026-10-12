import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerSearchRow from "~/components/PlayerSearchRow.vue";

const player = { steam_id: "76561198000000001", name: "Player" };

describe("PlayerSearchRow", () => {
  it("shows a tag beside the player", async () => {
    const wrapper = await mountSuspended(PlayerSearchRow, {
      props: { player, tag: "Free agent" },
    });

    expect(wrapper.text()).toContain("Free agent");
    wrapper.unmount();
  });

  it("shows no tag when given none", async () => {
    const wrapper = await mountSuspended(PlayerSearchRow, {
      props: { player },
    });

    expect(wrapper.text()).not.toContain("Free agent");
    wrapper.unmount();
  });
});
