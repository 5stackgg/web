import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ControlRoomPreview from "~/components/stream-deck/ControlRoomPreview.vue";

const match = {
  id: "11111111-2222-4333-8444-555555555555",
  status: "Live",
  server_id: "s1",
  is_server_online: true,
  match_maps: [],
  lineup_1: { name: "Team 1" },
  lineup_2: { name: "Team 2" },
};

describe("ControlRoomPreview", () => {
  it("opens the on-air match, since there is nothing to take there", async () => {
    const wrapper = await mountSuspended(ControlRoomPreview, {
      props: { match, selected: false, onAir: "live" },
    });

    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.get("a").attributes("href")).toBe(`/matches/${match.id}`);
    expect(wrapper.text()).toContain("Open match");
  });

  it("picks any other match for the take", async () => {
    const wrapper = await mountSuspended(ControlRoomPreview, {
      props: { match, selected: false, onAir: null },
    });

    await wrapper.get("button").trigger("click");

    expect(wrapper.find("a").exists()).toBe(false);
    expect(wrapper.emitted("select")).toHaveLength(1);
  });
});
