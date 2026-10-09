import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useUtilityRendersInFlight } from "~/composables/useUtilityRendersInFlight";

const { subscribe, auth } = vi.hoisted(() => ({
  subscribe: vi.fn(),
  auth: { moderator: false },
}));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({ subscribe }),
}));
vi.mock("~/stores/AuthStore", () => ({
  useAuthStore: () => ({ isRoleAbove: () => auth.moderator }),
}));

async function mountAsker() {
  let state!: ReturnType<typeof useUtilityRendersInFlight>;
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        state = useUtilityRendersInFlight();
        return () => h("div");
      },
    }),
  );
  await flushPromises();
  return { state, wrapper };
}

beforeEach(() => {
  subscribe.mockReset();
  subscribe.mockReturnValue({
    subscribe: ({ next }: any) => {
      next({
        data: {
          utility_lineup_renders: [
            { id: "r-1", utility_lineup_id: "l-1", status: "queued" },
            {
              id: "r-2",
              utility_lineup_id: "l-2",
              status: "rendering",
              progress: "0.420",
            },
          ],
        },
      });
      return { unsubscribe: vi.fn() };
    },
  });
});

describe("useUtilityRendersInFlight", () => {
  it("never asks for someone who cannot read the render queue", async () => {
    auth.moderator = false;
    const { state, wrapper } = await mountAsker();

    expect(subscribe).not.toHaveBeenCalled();
    expect(state.isRendering("l-1")).toBe(false);
    wrapper.unmount();
  });

  it("tells a moderator which lineups are rendering and how far along", async () => {
    auth.moderator = true;
    const { state, wrapper } = await mountAsker();

    expect(state.isRendering("l-1")).toBe(true);
    expect(state.percent("l-1")).toBeNull();
    expect(state.isRendering("l-2")).toBe(true);
    expect(state.percent("l-2")).toBe(42);
    expect(state.isRendering("l-3")).toBe(false);
    expect(state.count.value).toBe(2);
    wrapper.unmount();
  });

  it("shares one subscription between everything that asks", async () => {
    auth.moderator = true;
    const first = await mountAsker();
    const second = await mountAsker();

    expect(subscribe).toHaveBeenCalledTimes(1);
    first.wrapper.unmount();
    second.wrapper.unmount();
  });
});
