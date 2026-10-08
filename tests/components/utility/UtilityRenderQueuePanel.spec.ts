import { afterEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useNuxtApp } from "#app";
import UtilityRenderQueuePanel from "~/components/utility/UtilityRenderQueuePanel.vue";

const CDN = "https://cf.5stack.gg/clips/utility";

function row(id: string, lineup: string, status: string, preview?: string) {
  return {
    id,
    utility_lineup_id: lineup,
    map_name: "de_mirage",
    status,
    progress: status === "done" ? 1 : 0,
    error_message: status === "error" ? "pod went quiet" : null,
    skip_reason: null,
    duration_ms: 20000,
    k8s_job_name: null,
    game_server_node_id: null,
    paused: false,
    sort_index: 0,
    status_history: [],
    last_status_at: "2026-10-08T10:00:00Z",
    created_at: "2026-10-08T09:59:00Z",
    lineup: {
      id: lineup,
      name: `Lineup ${lineup}`,
      map_name: "de_mirage",
      preview_url: preview ?? null,
      preview_thumbnail_url: null,
    },
  };
}

const rows = {
  inFlight: [row("r-9", "l-2", "rendering")],
  finished: [
    row("r-1", "l-1", "done", `${CDN}/l-1/r-1.mp4`),
    row("r-0", "l-1", "error", `${CDN}/l-1/r-1.mp4`),
    row("r-2", "l-2", "done", `${CDN}/l-2/r-2.mp4`),
  ],
};

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    subscribe: ({ variables }: any) => ({
      subscribe: ({ next }: any) => {
        const finished = variables?.statuses?.includes("done");
        setTimeout(() =>
          next({
            data: {
              utility_lineup_renders: finished ? rows.finished : rows.inFlight,
            },
          }),
        );
        return { unsubscribe() {} };
      },
    }),
  }),
}));

const auth = reactive({ me: { steam_id: "9" }, isAdmin: true });
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

const mounted: Array<{ unmount: () => void }> = [];

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

async function mountPanel() {
  const wrapper = await mountSuspended(UtilityRenderQueuePanel, {
    attachTo: document.body,
  });
  mounted.push(wrapper);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await flushPromises();
  return wrapper;
}

const finishedRow = (wrapper: any, name: string) =>
  wrapper
    .findAll("li")
    .find((item: any) => item.find("a").exists() && item.find("a").text() === name);

describe("UtilityRenderQueuePanel", () => {
  it("marks the render that is the lineup's preview as live", async () => {
    const wrapper = await mountPanel();

    const live = wrapper
      .findAll("li")
      .filter((item) => item.text().includes("Live"));
    expect(live).toHaveLength(2);
    expect(live[0].find("a").text()).toBe("Lineup l-1");
    expect(
      wrapper.findAll("li").filter((item) => item.text().includes("Failed"))[0]
        .text(),
    ).not.toContain("Live");
  });

  it("holds the re-render while that lineup has one in flight", async () => {
    const wrapper = await mountPanel();

    const busy = finishedRow(wrapper, "Lineup l-2");
    const button = busy.find("button[aria-label='Re-render preview']");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.element.parentElement!.getAttribute("title")).toBe(
      "A render for this lineup is already running",
    );

    const free = finishedRow(wrapper, "Lineup l-1");
    expect(
      free.find("button[aria-label='Re-render preview']").attributes("disabled"),
    ).toBeUndefined();
  });

  it("asks before deleting the live render, and not before an old one", async () => {
    const wrapper = await mountPanel();
    const mutate = vi
      .spyOn(useNuxtApp().$apollo.defaultClient, "mutate")
      .mockResolvedValue({ data: {} } as any);

    const failed = wrapper
      .findAll("li")
      .find((item) => item.text().includes("Failed"))!;
    await failed.find("button[aria-label='Delete render']").trigger("click");
    await flushPromises();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].variables).toEqual({ render_id: "r-0" });
    expect(document.body.textContent).not.toContain("Delete this render?");

    await finishedRow(wrapper, "Lineup l-1")
      .find("button[aria-label='Delete render']")
      .trigger("click");
    await flushPromises();
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Delete this render?");
  });
});
