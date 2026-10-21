import { describe, expect, it, vi } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import QuickMatchConnect from "~/components/match/QuickMatchConnect.vue";

vi.mock("~/stores/AuthStore", () => ({
  useAuthStore: () => ({
    me: { steam_id: "1", role: "user" },
    isRoleAbove: () => false,
  }),
}));

const match = (overrides: Record<string, unknown> = {}) => ({
  id: "match-1",
  status: "Live",
  server_id: "server-1",
  server_type: "OnDemand",
  is_server_online: false,
  is_in_lineup: true,
  connection_string: "connect 1.2.3.4",
  connection_link: null,
  tv_connection_string: "tv",
  options: { tv_delay: 0 },
  ...overrides,
});

describe("QuickMatchConnect", () => {
  it("boots in the card the join row takes over", async () => {
    const wrapper = await mountSuspended(QuickMatchConnect, {
      props: { match: match() },
    });

    expect(wrapper.find(".qmc-boot").text()).toContain(
      "Starting your match server",
    );
  });

  it("calls a player to the gold Join Server once the server is up", async () => {
    const wrapper = await mountSuspended(QuickMatchConnect, {
      props: {
        match: match({
          is_server_online: true,
          connection_link: "steam://connect/1.2.3.4",
        }),
      },
    });

    const join = wrapper.find(".qmc-join");
    expect(join.classes()).toContain("tac-amber-cta");
    expect(join.classes()).toContain("is-calling");
    expect(wrapper.find(".qmc-boot").exists()).toBe(false);
  });

  it("waits while the page shows the server starting elsewhere", async () => {
    const wrapper = await mountSuspended(QuickMatchConnect, {
      props: {
        match: match({
          is_server_online: true,
          connection_link: "steam://connect/1.2.3.4",
        }),
        hideBooting: true,
      },
    });

    expect(wrapper.find(".qmc-join").exists()).toBe(false);
  });
});

describe("QuickMatchConnect as the match header's bar", () => {
  // The bar's words flip by character, which renders spaces as non-breaking.
  const text = (wrapper: { text: () => string }) =>
    wrapper.text().replace(/\u00a0/g, " ");
  const ready = () =>
    match({
      is_server_online: true,
      connection_link: "steam://connect/1.2.3.4",
    });

  it("keeps the server's address out of the page until it is asked for", async () => {
    const wrapper = await mountSuspended(QuickMatchConnect, {
      props: { match: ready(), variant: "bar" },
    });

    expect(wrapper.html()).not.toContain("1.2.3.4");
    expect(wrapper.find(".mcb-redact").exists()).toBe(true);

    await wrapper.findAll(".mcb-icon-button")[0].trigger("click");
    expect(text(wrapper)).toContain("1.2.3.4");
  });

  it("copies the whole connect command, masked or not", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const wrapper = await mountSuspended(QuickMatchConnect, {
      props: { match: ready(), variant: "bar" },
    });

    await wrapper.findAll(".mcb-icon-button")[1].trigger("click");
    expect(writeText).toHaveBeenCalledWith("connect 1.2.3.4");
    vi.unstubAllGlobals();
  });

  it("joins from a click, so hovering never shows the address", async () => {
    const wrapper = await mountSuspended(QuickMatchConnect, {
      props: { match: ready(), variant: "bar" },
    });

    expect(wrapper.find('a[href*="1.2.3.4"]').exists()).toBe(false);
    expect(wrapper.find(".qmc-join").classes()).toContain("tac-amber-cta");
  });

  it("holds a player's Join Server in place, locked, while the server boots", async () => {
    const wrapper = await mountSuspended(QuickMatchConnect, {
      props: { match: match(), variant: "bar" },
    });

    const join = wrapper.find(".qmc-join");
    expect(join.classes()).toContain("is-locked");
    expect(join.attributes("disabled")).toBeDefined();
    expect(text(wrapper)).toContain("Starting your match server");
  });
});
