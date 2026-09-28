import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlaycastEdgeRelay from "~/components/settings/PlaycastEdgeRelay.vue";

const health = vi.fn();
const realFetch = globalThis.fetch;

const panel = (wrapper: any) => wrapper.find('[data-test="edge-status"]');
const summary = (wrapper: any) =>
  wrapper.find('[data-test="edge-status-summary"]').text();

async function mountRelay() {
  const wrapper = await mountSuspended(PlaycastEdgeRelay);
  await flushPromises();
  return wrapper;
}

describe("PlaycastEdgeRelay", () => {
  beforeEach(() => {
    useRuntimeConfig().public.relayDomain = "tv.acme.gg";
    health.mockReset();
    globalThis.fetch = vi.fn(async (input: any) =>
      String(input) === "https://tv.acme.gg/health"
        ? health()
        : new Response(null, { status: 404 }),
    ) as any;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("shows the edge relay as online once the worker answers on the relay domain", async () => {
    health.mockResolvedValue(
      Response.json({ ok: true, worker: "5stack-playcast-relay", version: "2" }),
    );

    const wrapper = await mountRelay();

    expect(panel(wrapper).attributes("data-state")).toBe("online");
    expect(wrapper.find('[data-test="edge-status-state"]').text()).toBe(
      "Online",
    );
    expect(wrapper.find('[data-test="edge-status-endpoint"]').text()).toBe(
      "tv.acme.gg",
    );
    expect(summary(wrapper)).toContain("Cloudflare's cache");
  });

  it("points at the setup guide while the relay domain answers without the worker", async () => {
    health.mockResolvedValue(new Response(null, { status: 404 }));

    const wrapper = await mountRelay();

    expect(panel(wrapper).attributes("data-state")).toBe("idle");
    expect(summary(wrapper)).toContain("served by this server");
    expect(
      wrapper.find('[data-test="edge-status-guide"]').attributes("href"),
    ).toBe("https://docs.5stack.gg/advanced/playcast-edge-relay");
    expect(wrapper.find("pre").exists()).toBe(false);
  });

  it("treats an unreachable relay domain as not set up", async () => {
    health.mockRejectedValue(new TypeError("Failed to fetch"));

    const wrapper = await mountRelay();

    expect(panel(wrapper).attributes("data-state")).toBe("idle");
  });

  it("checks again on demand", async () => {
    health.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const wrapper = await mountRelay();
    expect(panel(wrapper).attributes("data-state")).toBe("idle");

    health.mockResolvedValueOnce(
      Response.json({ ok: true, worker: "5stack-playcast-relay", version: "2" }),
    );
    await wrapper
      .findAll("button")
      .find((button: any) => button.text().includes("Check again"))!
      .trigger("click");
    await flushPromises();

    expect(panel(wrapper).attributes("data-state")).toBe("online");
  });
});
