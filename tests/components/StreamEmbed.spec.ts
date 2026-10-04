import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import StreamEmbed from "~/components/StreamEmbed.vue";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import {
  embedStreamKey,
  useStoppedStreams,
} from "~/composables/useStoppedStreams";

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
    },
  }),
}));

const youtube = {
  id: "s1",
  link: "https://www.youtube.com/watch?v=abc123",
  title: "Main feed",
  preview: true as const,
};

let unmount: (() => void) | undefined;

// The embed mounts its iframe a frame after the stream is picked.
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  await flushPromises();
}

async function mountEmbed(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(StreamEmbed, {
    props: { streams: [youtube], ...props },
  });
  unmount = () => wrapper.unmount();
  await settle();
  return wrapper;
}

const buttonNamed = (wrapper: any, name: string) =>
  wrapper.findAll("button").find((b: any) => b.text() === name);

describe("StreamEmbed stop", () => {
  beforeEach(() => {
    useStoppedStreams().resume(embedStreamKey("s1"));
    useApplicationSettingsStore().setGlobalStream();
  });

  afterEach(() => {
    unmount?.();
    unmount = undefined;
  });

  it("removes the embed and shows the stopped bar", async () => {
    const wrapper = await mountEmbed();
    expect(wrapper.find("iframe").exists()).toBe(true);

    await buttonNamed(wrapper, "Stop stream").trigger("click");

    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(wrapper.text()).toContain("Stream stopped");
    expect(wrapper.text()).toContain("Main feed");
  });

  it("brings the embed back from Watch", async () => {
    const wrapper = await mountEmbed();
    await buttonNamed(wrapper, "Stop stream").trigger("click");

    await buttonNamed(wrapper, "Watch").trigger("click");
    await settle();

    expect(wrapper.find("iframe").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("Stream stopped");
  });

  it("starts stopped when the stream was stopped earlier", async () => {
    useStoppedStreams().stop(embedStreamKey("s1"));

    const wrapper = await mountEmbed();

    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(wrapper.text()).toContain("Stream stopped");
  });

  it("has no Stop in the floating player", async () => {
    const wrapper = await mountEmbed({ global: true });

    expect(buttonNamed(wrapper, "Stop stream")).toBeUndefined();
  });
});
