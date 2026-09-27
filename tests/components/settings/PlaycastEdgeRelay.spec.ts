import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import PlaycastEdgeRelay from "~/components/settings/PlaycastEdgeRelay.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({ mutate }),
}));

function useSettings(settings: Record<string, string>) {
  useApplicationSettingsStore().settings = Object.entries(settings).map(
    ([name, value]) => ({ name, value }),
  ) as any;
}

const sent = () =>
  mutate.mock.calls.map(([options]) => ({
    query: print(options.mutation),
    variables: options.variables,
  }));

const button = (wrapper: any, text: string) =>
  wrapper.findAll("button").find((b: any) => b.text().includes(text));

describe("PlaycastEdgeRelay", () => {
  beforeEach(() => {
    mutate.mockReset();
    mutate.mockResolvedValue({ data: {} });
    useSettings({ relay_domain: "https://relay.example.com" });
  });

  it("says viewers are on this server until a worker is set", async () => {
    const wrapper = await mountSuspended(PlaycastEdgeRelay);

    expect(wrapper.text()).toContain("Viewers are served by this server");
    expect(button(wrapper, "Serve from this server")).toBeUndefined();
  });

  it("shows the worker viewers are using and can switch back", async () => {
    useSettings({
      relay_domain: "https://relay.example.com",
      playcast_relay_url: "https://playcast.acme.gg",
    });
    const wrapper = await mountSuspended(PlaycastEdgeRelay);

    expect(wrapper.text()).toContain(
      "Viewers are served by https://playcast.acme.gg",
    );

    await button(wrapper, "Serve from this server").trigger("click");
    await flushPromises();

    const [call] = sent();
    expect(call.query).toContain("setPlaycastRelay");
    expect(call.variables).toEqual({ url: null });
  });

  it("deploys to the hostname with the account and token, then forgets the token", async () => {
    const wrapper = await mountSuspended(PlaycastEdgeRelay);
    const deploy = button(wrapper, "Deploy to Cloudflare");

    expect(deploy.attributes("disabled")).toBeDefined();

    await wrapper
      .find("#playcast-relay-account")
      .setValue("0123456789abcdef0123456789abcdef");
    await wrapper.find("#playcast-relay-token").setValue("cf-token");
    expect(deploy.attributes("disabled")).toBeDefined();
    await wrapper
      .find("#playcast-relay-hostname")
      .setValue("playcast.acme.gg");
    await deploy.trigger("click");
    await flushPromises();

    const [call] = sent();
    expect(call.query).toContain("deployPlaycastRelay");
    expect(call.variables).toEqual({
      accountId: "0123456789abcdef0123456789abcdef",
      apiToken: "cf-token",
      hostname: "playcast.acme.gg",
    });
    expect(
      (wrapper.find("#playcast-relay-token").element as HTMLInputElement).value,
    ).toBe("");
  });

  it("hands over the address when Cloudflare is still issuing the certificate", async () => {
    mutate.mockResolvedValueOnce({
      data: {
        deployPlaycastRelay: { url: "https://playcast.acme.gg", ready: false },
      },
    });
    const wrapper = await mountSuspended(PlaycastEdgeRelay);

    await wrapper
      .find("#playcast-relay-account")
      .setValue("0123456789abcdef0123456789abcdef");
    await wrapper.find("#playcast-relay-token").setValue("cf-token");
    await wrapper.find("#playcast-relay-hostname").setValue("playcast.acme.gg");
    await button(wrapper, "Deploy to Cloudflare").trigger("click");
    await flushPromises();

    expect(wrapper.find("details").attributes("open")).toBeDefined();
    expect(
      (wrapper.find("details input").element as HTMLInputElement).value,
    ).toBe("https://playcast.acme.gg");
  });

  it("keeps Enter from submitting the settings form around it", async () => {
    const wrapper = await mountSuspended(PlaycastEdgeRelay);
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });

    wrapper.find("#playcast-relay-hostname").element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("gives the manual deploy command for this panel's relay", async () => {
    const wrapper = await mountSuspended(PlaycastEdgeRelay);

    expect(wrapper.find("pre").text()).toContain(
      "--var ORIGIN:https://relay.example.com",
    );
  });
});
