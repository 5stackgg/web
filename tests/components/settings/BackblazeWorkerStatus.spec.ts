import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import BackblazeWorkerStatus from "~/components/settings/BackblazeWorkerStatus.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const HEALTH_URL = "https://cf.acme.gg/demo/_health";

const health = vi.fn();
const preflight = vi.fn();
const realFetch = globalThis.fetch;

const state = (wrapper: any) =>
  wrapper.find('[data-test="edge-status"]').attributes("data-state");
const summary = (wrapper: any) =>
  wrapper.find('[data-test="edge-status-summary"]').text();

async function mountStatus(workerUrl: string | null) {
  useApplicationSettingsStore().settings = workerUrl
    ? [{ name: "cloudflare_worker_url", value: workerUrl }]
    : [];
  const wrapper = await mountSuspended(BackblazeWorkerStatus);
  await flushPromises();
  return wrapper;
}

const answer = (bucket: string, code: string) =>
  Response.json({
    ok: bucket === "ok",
    worker: "5stack-backblaze-proxy",
    version: "1",
    bucket,
    code,
  });

describe("BackblazeWorkerStatus", () => {
  beforeEach(() => {
    health.mockReset();
    preflight.mockReset();
    globalThis.fetch = vi.fn(async (input: any, init?: RequestInit) => {
      if (String(input) !== HEALTH_URL) {
        return new Response(null, { status: 404 });
      }
      return init?.method === "OPTIONS" ? preflight() : health();
    }) as any;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("shows files served straight from the bucket when no worker is set up", async () => {
    const wrapper = await mountStatus(null);

    expect(state(wrapper)).toBe("idle");
    expect(summary(wrapper)).toContain("straight from your bucket");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("is online when the worker answers and Backblaze accepts its keys", async () => {
    health.mockImplementation(async () => answer("ok", "AccessDenied"));

    const wrapper = await mountStatus("https://cf.acme.gg/");

    expect(state(wrapper)).toBe("online");
    expect(wrapper.find('[data-test="edge-status-endpoint"]').text()).toBe(
      "cf.acme.gg",
    );
    expect(wrapper.text()).toContain("Keys accepted by Backblaze");
  });

  it("is offline when Backblaze rejects the worker's keys", async () => {
    health.mockImplementation(async () =>
      answer("rejected", "InvalidAccessKeyId"),
    );

    const wrapper = await mountStatus("https://cf.acme.gg");

    expect(state(wrapper)).toBe("offline");
    expect(summary(wrapper)).toContain("rejects the worker's keys");
    expect(wrapper.text()).toContain("Keys rejected (InvalidAccessKeyId)");
  });

  it("asks for an update when an older worker only answers the preflight", async () => {
    health.mockRejectedValue(new TypeError("Failed to fetch"));
    preflight.mockImplementation(
      async () => new Response(null, { status: 204 }),
    );

    const wrapper = await mountStatus("https://cf.acme.gg");

    expect(state(wrapper)).toBe("attention");
    expect(summary(wrapper)).toContain("Run the setup again");
  });

  it("is offline when nothing answers", async () => {
    health.mockRejectedValue(new TypeError("Failed to fetch"));
    preflight.mockRejectedValue(new TypeError("Failed to fetch"));

    const wrapper = await mountStatus("https://cf.acme.gg");

    expect(state(wrapper)).toBe("offline");
    expect(summary(wrapper)).toContain("isn't answering");
  });
});
