import { afterEach, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import GpuSessionState from "~/components/gpu-nodes/GpuSessionState.vue";
import { buildSessions, type GpuSession } from "~/components/gpu-nodes/gpuSessions";

let mounted: { unmount: () => void } | null = null;
afterEach(() => { mounted?.unmount(); mounted = null; });
const at = "2026-10-07T12:00:00.000Z";
function session(kind: "live" | "demo" | "highlights", element?: string, vendor = "amd") {
  const row = { id: "session-1", game_server_node_id: "node-1", status: kind === "demo" ? "playing" : kind === "live" ? "live" : "rendering", is_live: true, status_history: [{ status: "live", at, ...(element ? { progress_stage: `encoder:${element}` } : {}) }] };
  return buildSessions({ nodes: [{ id: "node-1", enabled: true, status: "Online", gpu_vendor: vendor }], streams: kind === "live" ? [row] : [], demos: kind === "demo" ? [row] : [], renders: kind === "highlights" ? [row] : [], accounts: [] })[0];
}
async function mountState(value: GpuSession) {
  const wrapper = await mountSuspended(GpuSessionState, { props: { session: value }, global: { stubs: { StatusDot: true } } });
  mounted = wrapper; return wrapper;
}
describe("GPU session encoder in the running table and node inspector", () => {
  it("shows the actual reported VA encoder on a live stream", async () => {
    const wrapper = await mountState(session("live", "vah264enc"));
    const tag = wrapper.find(".gpu-session-encoder");
    expect(tag.text()).toBe("vah264enc");
    expect(tag.attributes("title")).toBe("Video encoder: vah264enc");
    expect(tag.classes()).not.toContain("text-destructive");
  });
  it.each(["amd", "nvidia"])("warns about CPU encoding for %s", async vendor => {
    const wrapper = await mountState(session("demo", "x264enc", vendor));
    const tag = wrapper.find(".gpu-session-encoder");
    expect(tag.text()).toBe("x264enc");
    expect(tag.classes()).toContain("text-destructive");
  });
  it("does not guess an encoder when the history has no marker", async () => {
    const wrapper = await mountState(session("live", undefined, "nvidia"));
    expect(wrapper.find(".gpu-session-encoder").exists()).toBe(false);
    expect(wrapper.text()).toContain("Live");
  });
  it("does not label highlight capture as final MP4 encoding", async () => {
    const wrapper = await mountState(session("highlights", "vah264enc"));
    expect(wrapper.find(".gpu-session-encoder").exists()).toBe(false);
  });
  it("updates the tag when a new encoder marker arrives", async () => {
    const wrapper = await mountState(session("demo", "vah264enc"));
    await wrapper.setProps({ session: session("demo", "x264enc") });
    expect(wrapper.find(".gpu-session-encoder").text()).toBe("x264enc");
    expect(wrapper.find(".gpu-session-encoder").classes()).toContain("text-destructive");
  });
});
