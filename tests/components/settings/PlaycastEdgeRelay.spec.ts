import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlaycastEdgeRelay from "~/components/settings/PlaycastEdgeRelay.vue";

const health = vi.fn();
const realFetch = globalThis.fetch;

const status = (wrapper: any) =>
  wrapper.find('[data-test="relay-status"]').text();

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

  it("shows the edge relay as active once the worker answers on the relay domain", async () => {
    health.mockResolvedValue(
      Response.json({ ok: true, worker: "5stack-playcast-relay", version: "2" }),
    );

    const wrapper = await mountRelay();

    expect(status(wrapper)).toContain("Active");
    expect(status(wrapper)).toContain("tv.acme.gg");
    expect(wrapper.find("pre").exists()).toBe(false);
  });

  it("shows how to set it up while the relay domain answers without the worker", async () => {
    health.mockResolvedValue(new Response(null, { status: 404 }));

    const wrapper = await mountRelay();

    expect(status(wrapper)).toContain("Not active");
    expect(wrapper.find("pre").text()).toBe("./playcast-relay.sh");
  });

  it("treats an unreachable relay domain as not active", async () => {
    health.mockRejectedValue(new TypeError("Failed to fetch"));

    const wrapper = await mountRelay();

    expect(status(wrapper)).toContain("Not active");
  });

  it("checks again on demand", async () => {
    health.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const wrapper = await mountRelay();
    expect(status(wrapper)).toContain("Not active");

    health.mockResolvedValueOnce(
      Response.json({ ok: true, worker: "5stack-playcast-relay", version: "2" }),
    );
    await wrapper
      .findAll("button")
      .find((button: any) => button.text().includes("Check again"))!
      .trigger("click");
    await flushPromises();

    expect(status(wrapper)).toContain("Active");
  });
});
