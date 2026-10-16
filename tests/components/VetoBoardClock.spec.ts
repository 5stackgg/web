import { afterEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import VetoBoard from "~/components/match/VetoBoard.vue";
import socket from "~/web-sockets/Socket";
import { mapVetoOrder } from "~/utilities/vetoOrder";
import type { VetoBoardLineup } from "~/utilities/vetoOrder";

const MAPS = [
  "ancient",
  "anubis",
  "dust2",
  "inferno",
  "mirage",
  "nuke",
  "train",
];

const items = MAPS.map((id) => ({ id, label: id, poster: null, patch: null }));
const lineups: [VetoBoardLineup, VetoBoardLineup] = [
  { name: "Buttah Boyz", crest: null, monogram: "BB" },
  { name: "Night Owls", crest: null, monogram: "NO" },
];
const steps = mapVetoOrder(3, MAPS.length).map((step) => ({
  ...step,
  record: null,
}));

function mount(deadline: number, options: Record<string, unknown> = {}) {
  return mountSuspended(VetoBoard, {
    props: {
      kind: "map",
      items,
      lineups,
      steps,
      bestOf: 3,
      pickingLineup: 1,
      isPicking: false,
      deadline: new Date(deadline).toISOString(),
      total: 30,
    },
    ...options,
  });
}

function setApiClockBehindBy(ms: number) {
  const now = Date.now();
  socket.emit("online");
  socket.emit("pong", { serverNow: now - ms, sentAt: now });
}

describe("VetoBoard clock", () => {
  afterEach(() => {
    vi.useRealTimers();
    setApiClockBehindBy(0);
  });

  it("counts the turn on the api's clock when the device clock runs ahead", async () => {
    setApiClockBehindBy(120_000);

    const wrapper = await mount(Date.now() - 120_000 + 20_000);

    expect(wrapper.find(".vb-clock").text()).toMatch(/^(19|20)s$/);
    wrapper.unmount();
  });

  it("redraws once a second while the clock runs, not every frame", async () => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "Date"],
    });
    let renders = 0;
    const wrapper = await mount(Date.now() + 25_500, {
      global: {
        mixins: [
          {
            updated() {
              renders++;
            },
          },
        ],
      },
    });
    renders = 0;

    await vi.advanceTimersByTimeAsync(1000);

    expect(renders).toBeLessThanOrEqual(2);
    expect(wrapper.find(".vb-clock").text()).toBe("25s");
    wrapper.unmount();
  });
});
