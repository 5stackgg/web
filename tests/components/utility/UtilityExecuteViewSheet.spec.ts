import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityExecuteView from "~/components/utility/UtilityExecuteView.vue";
import type { UtilityExecuteBeat } from "~/components/utility/UtilityExecuteView.vue";
import type { PlaybackClock } from "~/composables/usePlaybackClock";
import type { UtilityLineup, UtilityPlaybook } from "~/types/utility";

vi.mock("~/stores/AuthStore", () => ({
  useAuthStore: () => ({ me: { steam_id: "9" }, isRoleAbove: () => false }),
}));

vi.mock("~/components/ui/sidebar/utils", async (original) => {
  return {
    ...(await original<Record<string, unknown>>()),
    useSidebar: () => ({ isMobile: ref(false) }),
  };
});

const playbook = {
  id: "p-1",
  name: "Default A",
  description: null,
  map_name: "de_mirage",
  side: "TERRORIST",
  team_id: null,
  owner_steam_id: "7",
  visibility: "Public",
  can_view: true,
  can_edit: false,
  owner: { steam_id: "7", name: "rawr", avatar_url: null },
} as UtilityPlaybook;

function lineup(id: string, name: string) {
  return {
    id,
    name,
    map_name: "de_mirage",
    utility_type: "Smoke",
    side: "TERRORIST",
    technique: "Jump",
    throw_strength: "Full",
  } as unknown as UtilityLineup;
}

function beat(index: number, seconds: number, who: string | null): UtilityExecuteBeat {
  return {
    key: `s-${index}`,
    index,
    step: {
      id: `s-${index}`,
      playbook_id: "p-1",
      utility_lineup_id: `l-${index}`,
      step_order: index,
      offset_ms: seconds * 1000,
      assigned_steam_id: who ? `id-${who}` : null,
      note: null,
    },
    lineup: lineup(`l-${index}`, `Smoke ${index + 1}`),
    seconds,
    color: "#38bdf8",
    showTime: true,
    repeatOf: null,
    who,
    player: who ? { steam_id: `id-${who}`, name: who, avatar_url: null } : null,
    mine: false,
  };
}

const run = {
  position: ref(null),
  tenths: computed(() => null),
  running: ref(false),
  length: computed(() => 6),
  play() {},
  pause() {},
  seek() {},
  stop() {},
} as unknown as PlaybackClock;

describe("UtilityExecuteView run sheet", () => {
  it("says whose execute it is under its name, with their face", async () => {
    const wrapper = await mountSuspended(UtilityExecuteView, {
      props: {
        playbook,
        beats: [beat(0, 1, "nyx")],
        ownerPlayer: playbook.owner,
        run,
      },
    });
    await flushPromises();

    expect(wrapper.find("[data-execute-by]").text()).toContain("rawr");
  });

  it("puts who throws each step on a line of its own, Anyone when nobody is named", async () => {
    const wrapper = await mountSuspended(UtilityExecuteView, {
      props: {
        playbook,
        beats: [beat(0, 1, "nyx"), beat(1, 6, null)],
        run,
      },
    });
    await flushPromises();

    const throwers = wrapper
      .findAll("[data-run-sheet] [data-thrower]")
      .map((line) => line.text());
    expect(throwers).toHaveLength(2);
    expect(throwers[0]).toContain("nyx");
    expect(throwers[1]).toBe("Anyone");
  });

  it("marks each step with its grenade's icon in the grenade's colour", async () => {
    const wrapper = await mountSuspended(UtilityExecuteView, {
      props: { playbook, beats: [beat(0, 1, "nyx")], run },
    });
    await flushPromises();

    const icon = wrapper.find("[data-run-sheet] [data-type-icon]");
    expect(icon.attributes("style")).toContain("smokegrenade.svg");
    expect(icon.attributes("style")).toContain("background-color");
  });
});
