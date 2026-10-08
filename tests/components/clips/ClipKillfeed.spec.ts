import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ClipKillfeed from "~/components/clips/ClipKillfeed.vue";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({ query }),
}));

const props = { matchMapId: "mm-1", round: 9, steamId: "76561198000000001" };

beforeEach(() => {
  query.mockReset();
});

describe("ClipKillfeed", () => {
  it("lists the round's kills on one line: weapon, headshot, victim, callout", async () => {
    query.mockResolvedValue({
      data: {
        player_kills: [
          {
            time: "2026-10-01T10:00:01Z",
            with: "ak47",
            headshot: true,
            attacked_steam_id: "2",
            attacked_location: "Top Mid",
            attacked_player: { name: "rawr" },
          },
          {
            time: "2026-10-01T10:00:04Z",
            with: "weapon_deagle",
            headshot: false,
            attacked_steam_id: "3",
            attacked_location: "",
            attacked_player: { name: "UncleSam" },
          },
        ],
      },
    });
    const wrapper = await mountSuspended(ClipKillfeed, { props });
    await flushPromises();

    const chips = wrapper.findAll("li");
    expect(
      chips.map((chip) =>
        chip
          .findAll("span")
          .map((span) => span.text())
          .join(" "),
      ),
    ).toEqual(["HS rawr Top Mid", "UncleSam"]);
    expect(chips[0].find("img").attributes("src")).toBe(
      "/img/equipment/ak47.svg",
    );
    expect(chips[1].find("img").attributes("src")).toBe(
      "/img/equipment/deagle.svg",
    );
    expect(query.mock.calls[0][0].variables).toEqual(props);
  });

  it("shows nothing when the kills cannot be read", async () => {
    query.mockRejectedValue(new Error("permission denied"));
    const wrapper = await mountSuspended(ClipKillfeed, { props });
    await flushPromises();

    expect(wrapper.find("ol").exists()).toBe(false);
  });

  it("does not ask without a round to look in", async () => {
    await mountSuspended(ClipKillfeed, { props: { ...props, round: null } });
    await flushPromises();

    expect(query).not.toHaveBeenCalled();
  });
});
