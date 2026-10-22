import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import DraftRoom from "~/components/draft-games/DraftRoom.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { demoDraftMatch, demoDraftRoom } from "~/utilities/demoDraft";

const viewer = {
  steam_id: "76561198000000042",
  name: "You",
  avatar_url: null,
  custom_avatar_url: null,
  country: "US",
};

let mounted: { unmount: () => void } | undefined;

afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  useAuthStore().me = undefined;
  useApplicationSettingsStore().availableRegions = [];
});

// The FAQ's demo lobby runs the real draft room, so its check-in step shows
// the same amber box players see.
async function mountDemoCheckIn(signedIn: boolean) {
  const startedAt = Date.now();
  const seat = signedIn ? viewer : null;
  if (seat) {
    useAuthStore().me = { steam_id: seat.steam_id } as any;
  }
  useApplicationSettingsStore().availableRegions = [{ value: "us" }] as any;
  const wrapper = await mountSuspended(DraftRoom, {
    props: {
      room: demoDraftRoom(seat as any, startedAt),
      match: demoDraftMatch({
        step: "check_in",
        everyoneIn: false,
        bans: 0,
        turnAt: startedAt,
        startedAt,
        viewer: seat as any,
      }),
    },
    shallow: true,
    global: {
      stubs: {
        DraftRoomHeader: false,
        DraftCheckInBox: false,
        Fold: false,
        transition: false,
      },
    },
  });
  mounted = wrapper;
  return wrapper.find(".checkin-box");
}

describe("the FAQ demo lobby at check-in", () => {
  it("shows a signed-in viewer the amber box, checked in, waiting on the last player", async () => {
    const box = await mountDemoCheckIn(true);

    expect(box.exists()).toBe(true);
    expect(box.text()).toContain("Checked In");
    expect(box.findAll(".checkin-box-seats i")).toHaveLength(10);
    expect(box.findAll(".checkin-box-seats i.is-in")).toHaveLength(9);
  });

  it("shows someone signed out the same box, watching", async () => {
    const box = await mountDemoCheckIn(false);

    expect(box.exists()).toBe(true);
    expect(box.text()).toContain("Checking in");
  });
});

describe("the FAQ demo lobby while the captains pick", () => {
  async function mountDemoPicks(picked: number) {
    const startedAt = Date.now();
    useAuthStore().me = { steam_id: viewer.steam_id } as any;
    useApplicationSettingsStore().availableRegions = [{ value: "us" }] as any;
    const wrapper = await mountSuspended(DraftRoom, {
      props: {
        room: demoDraftRoom(viewer as any, startedAt, {
          picked,
          turnAt: startedAt,
          matchMade: false,
        }),
      },
      shallow: true,
    });
    mounted = wrapper;
    return wrapper.vm as any;
  }

  const team1 = (vm: any) =>
    vm.headerSides[0].seats.map((seat: any) => ({
      name: seat.player?.name ?? null,
      no: seat.no,
      current: seat.current,
      mine: seat.mine,
    }));

  it("runs the real draft room, the captains set and every pick to come", async () => {
    const vm = await mountDemoPicks(0);

    expect(vm.header.phase).toBe("draft");
    expect(team1(vm).map((seat: any) => seat.name)).toEqual([
      "vexa",
      null,
      null,
      null,
      null,
    ]);
    expect(team1(vm)[1]).toMatchObject({ no: 1, current: true });
  });

  it("puts you in Team 1's stack when your pick lands", async () => {
    const vm = await mountDemoPicks(5);

    expect(team1(vm).map((seat: any) => [seat.no, seat.mine])).toEqual([
      [null, false],
      [1, false],
      [4, false],
      [5, true],
      [8, false],
    ]);
  });

  it("makes the match once the last pick is in", async () => {
    const vm = await mountDemoPicks(8);

    expect(vm.header.phase).toBe("between");
  });
});
