import { describe, expect, it } from "vitest";
import { computed, defineComponent, h, provide } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerRanks from "~/components/draft-games/PlayerRanks.vue";
import {
  RANK_SLOTS_KEY,
  rankSlotsFor,
} from "~/components/draft-games/playerRanks";

const ranked = {
  elo: { competitive: 5142 },
  premier_rank: 24882,
  faceit_skill_level: 8,
  faceit_elo: 1900,
};
const unranked = { elo: { competitive: 4977 } };

const inRoom = (player: any, players: Array<any>) =>
  defineComponent({
    setup() {
      provide(
        RANK_SLOTS_KEY,
        computed(() => rankSlotsFor(players)),
      );
      return () => h(PlayerRanks, { player });
    },
  });

describe("PlayerRanks", () => {
  it("shows a blank pill for each rank someone else in the room has", async () => {
    const wrapper = await mountSuspended(inRoom(unranked, [ranked, unranked]));

    expect(wrapper.text()).toContain("No Premier rank");
    expect(wrapper.text()).toContain("No FACEIT linked");
    wrapper.unmount();
  });

  it("leaves out ranks nobody in the room has", async () => {
    const wrapper = await mountSuspended(inRoom(unranked, [unranked]));

    expect(wrapper.text()).not.toContain("No Premier rank");
    expect(wrapper.text()).not.toContain("No FACEIT linked");
    wrapper.unmount();
  });

  it("shows only the real pills outside a room", async () => {
    const wrapper = await mountSuspended(PlayerRanks, {
      props: { player: unranked },
    });

    expect(wrapper.text()).not.toContain("No Premier rank");
    wrapper.unmount();
  });
});
