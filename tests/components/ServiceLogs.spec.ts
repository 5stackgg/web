import { afterEach, describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ServiceLogs from "~/components/ServiceLogs.vue";

const socket = vi.hoisted(() => ({
  listeners: new Map<string, (raw: string) => void>(),
  requests: [] as Array<{ service: string; tailLines?: number }>,
}));

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    listen: (event: string, callback: (raw: string) => void) => {
      socket.listeners.set(event, callback);
      return { stop: () => socket.listeners.delete(event) };
    },
    event: (event: string, data: { service: string; tailLines?: number }) => {
      if (event === "logs") {
        socket.requests.push(data);
      }
    },
  },
}));

vi.mock("~/components/PodLogs.vue", () => ({
  default: { name: "PodLogs", render: () => null },
}));

const SERVICE = "map-assets:25966348";
const send = (payload: Record<string, unknown>) =>
  socket.listeners.get(`logs:${SERVICE}`)!(JSON.stringify(payload));
const line = (pod: string, log: string, second: number) =>
  send({
    pod,
    container: "map-assets",
    timestamp: `2026-10-16T14:40:${String(second).padStart(2, "0")}.000Z`,
    log,
  });

describe("ServiceLogs", () => {
  afterEach(() => {
    vi.useRealTimers();
    socket.listeners.clear();
    socket.requests.length = 0;
  });

  it("asks again for a re-run's log while the run is live, though its old pod says finished", async () => {
    const wrapper = await mountSuspended(ServiceLogs, {
      props: { service: SERVICE, compact: true, running: false },
    });
    expect(socket.requests).toHaveLength(1);

    line("map-assets-25966348-old", " [28/28] rush_001", 1);
    send({ end: true, job_finshed: true });
    vi.useFakeTimers();
    vi.advanceTimersByTime(10_000);
    expect(socket.requests).toHaveLength(1);

    await wrapper.setProps({ running: true });
    expect(socket.requests).toHaveLength(2);

    // The old job is still there until the new one replaces it.
    line("map-assets-25966348-old", " [28/28] rush_001", 1);
    send({ end: true, job_finshed: true });
    vi.advanceTimersByTime(5_000);
    expect(socket.requests).toHaveLength(3);

    line("map-assets-25966348-new", " [4/8] de_assembly", 30);
    expect(wrapper.emitted("line")).toEqual([
      [" [28/28] rush_001"],
      [" [4/8] de_assembly"],
    ]);
    expect((wrapper.vm as any).activePod).toBe("map-assets-25966348-new");
  });

  it("stays quiet after a finished job when no run is live", async () => {
    await mountSuspended(ServiceLogs, {
      props: { service: SERVICE, compact: true },
    });
    line("map-assets-25966348-old", " built 20/27 map(s)", 1);
    vi.useFakeTimers();
    send({ end: true, job_finshed: true });
    vi.advanceTimersByTime(30_000);
    expect(socket.requests).toHaveLength(1);
  });
});
