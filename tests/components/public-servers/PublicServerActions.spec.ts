import { describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PublicServerActions from "~/components/public-servers/PublicServerActions.vue";

const server = (extra: Record<string, unknown> = {}) => ({
  id: "server-1",
  label: "Casual #1",
  type: "Casual",
  game: "cs2",
  region: "us-east",
  players: 4,
  max_players: 10,
  hibernating: false,
  map: "de_mirage",
  isFull: false,
  tier: "good",
  connection_link: "steam://run/730//+connect 10.0.0.1:27015",
  connection_string: "connect 10.0.0.1:27015",
  tv_connection_link: null,
  tv_connection_string: null,
  ...extra,
});

const mount = (extra: Record<string, unknown> = {}) =>
  mountSuspended(PublicServerActions, { props: { server: server(extra) } });

describe("PublicServerActions GOTV", () => {
  it("links straight into GOTV when the server has one", async () => {
    const wrapper = await mount({
      tv_connection_link: "steam://run/730//+connect 10.0.0.1:27020",
      tv_connection_string: "connect 10.0.0.1:27020",
    });

    expect(wrapper.find('[data-testid="watch-gotv"]').attributes("href")).toBe(
      "steam://run/730//+connect 10.0.0.1:27020",
    );
    expect(wrapper.find('[data-testid="copy-gotv"]').exists()).toBe(false);
  });

  it("copies the command when GOTV asks for a password", async () => {
    const wrapper = await mount({
      connection_link: null,
      tv_connection_string: "connect 10.0.0.1:27020; password hunter2",
    });

    expect(wrapper.find('[data-testid="watch-gotv"]').exists()).toBe(false);
    expect(
      wrapper
        .find('[data-testid="copy-gotv"] [data-clipboard-text]')
        .attributes("data-clipboard-text"),
    ).toBe("connect 10.0.0.1:27020; password hunter2");
  });

  it("offers GOTV on a full server, where joining is not an option", async () => {
    const wrapper = await mount({
      isFull: true,
      tv_connection_link: "steam://run/730//+connect 10.0.0.1:27020",
    });

    expect(wrapper.find('[data-testid="watch-gotv"]').exists()).toBe(true);
  });

  it("has nothing to watch while the server hibernates", async () => {
    const wrapper = await mount({
      hibernating: true,
      tv_connection_link: "steam://run/730//+connect 10.0.0.1:27020",
      tv_connection_string: "connect 10.0.0.1:27020",
    });

    expect(wrapper.find('[data-testid="watch-gotv"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="copy-gotv"]').exists()).toBe(false);
  });

  it("shows no GOTV when the server runs none", async () => {
    const wrapper = await mount();

    expect(wrapper.find('[data-testid="watch-gotv"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="copy-gotv"]').exists()).toBe(false);
  });
});
