import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useRouter } from "#app";
import {
  openedHere,
  stepOutOf,
  useBackDismiss,
} from "~/composables/useBackDismiss";

const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 30));
  await flushPromises();
};

const position = () => Number(window.history.state?.position);

async function mountLayer(enabled = true) {
  const open = ref(false);
  const close = vi.fn(() => {
    open.value = false;
  });
  const wrapper = await mountSuspended(
    defineComponent({
      setup() {
        useBackDismiss(() => open.value, close, { enabled: () => enabled });
        return () => h("div");
      },
    }),
  );
  await settle();
  return { open, close, wrapper };
}

describe("useBackDismiss", () => {
  it("gives an opened layer its own entry, and Back closes it", async () => {
    const { open, close, wrapper } = await mountLayer();
    const router = useRouter();
    const before = position();
    const address = router.currentRoute.value.fullPath;

    open.value = true;
    await settle();
    expect(position()).toBe(before + 1);
    expect(router.currentRoute.value.fullPath).toBe(address);
    expect(window.history.state.backLayer).toBe(true);

    router.back();
    await settle();
    expect(close).toHaveBeenCalledTimes(1);
    expect(open.value).toBe(false);
    expect(position()).toBe(before);
    wrapper.unmount();
  });

  it("takes its entry back out when the layer is closed by hand", async () => {
    const { open, close, wrapper } = await mountLayer();
    const before = position();

    open.value = true;
    await settle();
    expect(position()).toBe(before + 1);

    open.value = false;
    await settle();
    expect(position()).toBe(before);
    expect(close).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("carries the page's own history notes onto the layer's entry", async () => {
    const { open, wrapper } = await mountLayer();
    const router = useRouter();
    await router.replace({
      path: router.currentRoute.value.path,
      query: router.currentRoute.value.query,
      state: { lineupOpenedAt: 7 },
      force: true,
    });
    await settle();

    open.value = true;
    await settle();
    expect(window.history.state.lineupOpenedAt).toBe(7);

    open.value = false;
    await settle();
    wrapper.unmount();
  });

  it("pushes nothing where it is switched off", async () => {
    const { open, wrapper } = await mountLayer(false);
    const before = position();

    open.value = true;
    await settle();

    expect(position()).toBe(before);
    wrapper.unmount();
  });

  it("keeps its place when one layer closes as another opens", async () => {
    const first = await mountLayer();
    const second = await mountLayer();
    const router = useRouter();
    const before = position();

    first.open.value = true;
    await settle();
    expect(position()).toBe(before + 1);

    first.open.value = false;
    second.open.value = true;
    await settle();
    await settle();
    expect(position()).toBe(before + 1);

    router.back();
    await settle();
    expect(second.close).toHaveBeenCalledTimes(1);
    expect(first.close).not.toHaveBeenCalled();
    expect(position()).toBe(before);
    first.wrapper.unmount();
    second.wrapper.unmount();
  });

  it("closes only the layer on top, one Back at a time", async () => {
    const under = await mountLayer();
    const over = await mountLayer();
    const router = useRouter();
    const before = position();

    under.open.value = true;
    await settle();
    over.open.value = true;
    await settle();
    expect(position()).toBe(before + 2);

    router.back();
    await settle();
    expect(over.close).toHaveBeenCalledTimes(1);
    expect(under.close).not.toHaveBeenCalled();

    router.back();
    await settle();
    expect(under.close).toHaveBeenCalledTimes(1);
    expect(position()).toBe(before);
    under.wrapper.unmount();
    over.wrapper.unmount();
  });

  it("keeps what the page wrote to the address under a layer closed by hand", async () => {
    const { open, wrapper } = await mountLayer();
    const router = useRouter();
    const before = position();

    open.value = true;
    await settle();
    await router.replace({
      path: router.currentRoute.value.path,
      query: { ...router.currentRoute.value.query, types: "smoke" },
    });
    await settle();

    open.value = false;
    await settle();
    expect(position()).toBe(before);
    expect(router.currentRoute.value.query.types).toBe("smoke");
    expect(window.location.search).toContain("types=smoke");

    await router.replace({ path: router.currentRoute.value.path, query: {} });
    await settle();
    wrapper.unmount();
  });

  it("keeps it when Back closes the layer, too", async () => {
    const { open, close, wrapper } = await mountLayer();
    const router = useRouter();
    const before = position();

    open.value = true;
    await settle();
    await router.replace({
      path: router.currentRoute.value.path,
      query: { ...router.currentRoute.value.query, types: "flash" },
    });
    await settle();

    router.back();
    await settle();
    expect(close).toHaveBeenCalledTimes(1);
    expect(position()).toBe(before);
    expect(router.currentRoute.value.query.types).toBe("flash");
    expect(window.location.search).toContain("types=flash");

    await router.replace({ path: router.currentRoute.value.path, query: {} });
    await settle();
    wrapper.unmount();
  });

  it("lets Back be Back off an entry that is not a layer's", async () => {
    const { wrapper } = await mountLayer();
    const router = useRouter();
    const path = router.currentRoute.value.path;
    const before = position();

    await router.push({ path, query: { types: "smoke" } });
    await settle();
    router.back();
    await settle();

    expect(position()).toBe(before);
    expect(router.currentRoute.value.query.types).toBeUndefined();
    wrapper.unmount();
  });

  it("lets a navigation the same click started go first", async () => {
    const { open, close, wrapper } = await mountLayer();
    const router = useRouter();
    const path = router.currentRoute.value.path;
    const before = position();

    void router.push({ path, query: { lineup: "a" } });
    open.value = true;
    await settle();
    expect(router.currentRoute.value.query.lineup).toBe("a");
    expect(position()).toBe(before + 2);

    router.back();
    await settle();
    expect(close).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.query.lineup).toBe("a");
    expect(position()).toBe(before + 1);

    router.back();
    await settle();
    expect(position()).toBe(before);
    wrapper.unmount();
  });

  it("does not step back over what was opened as it closed", async () => {
    const { open, wrapper } = await mountLayer();
    const router = useRouter();
    const path = router.currentRoute.value.path;
    const before = position();

    open.value = true;
    await settle();
    expect(position()).toBe(before + 1);

    open.value = false;
    void router.push({ path, query: { lineup: "b" } });
    await settle();
    expect(router.currentRoute.value.query.lineup).toBe("b");
    expect(position()).toBe(before + 2);

    router.go(-2);
    await settle();
    expect(position()).toBe(before);
    wrapper.unmount();
  });

  it("takes an entry a layer left behind instead of making another", async () => {
    const { open, close, wrapper } = await mountLayer();
    const router = useRouter();
    const before = position();

    open.value = true;
    await settle();
    router.back();
    await settle();
    expect(open.value).toBe(false);

    router.forward();
    await settle();
    expect(position()).toBe(before + 1);

    open.value = true;
    await settle();
    expect(position()).toBe(before + 1);

    router.back();
    await settle();
    expect(close).toHaveBeenCalledTimes(2);
    expect(position()).toBe(before);
    wrapper.unmount();
  });
});

describe("what lives in the address", () => {
  it("is stepped back out of when it was opened here", async () => {
    const router = useRouter();
    const path = router.currentRoute.value.path;
    const before = position();
    const otherwise = vi.fn();

    await router.push({
      path,
      query: { lineup: "a" },
      state: openedHere("lineup"),
    });
    await settle();
    expect(position()).toBe(before + 1);

    stepOutOf(router, "lineup", otherwise);
    await settle();
    expect(otherwise).not.toHaveBeenCalled();
    expect(position()).toBe(before);
    expect(router.currentRoute.value.query.lineup).toBeUndefined();
  });

  it("is taken out of the address when it was arrived at by link", async () => {
    const router = useRouter();
    const path = router.currentRoute.value.path;
    const otherwise = vi.fn();

    await router.push({ path, query: { lineup: "linked" } });
    await settle();
    const at = position();

    stepOutOf(router, "lineup", otherwise);
    await settle();
    expect(otherwise).toHaveBeenCalledTimes(1);
    expect(position()).toBe(at);

    router.back();
    await settle();
  });

  it("takes the layer over it along when it steps back", async () => {
    const { open, close, wrapper } = await mountLayer();
    const router = useRouter();
    const path = router.currentRoute.value.path;
    const before = position();

    await router.push({
      path,
      query: { lineup: "a" },
      state: openedHere("lineup"),
    });
    await settle();
    open.value = true;
    await settle();
    expect(position()).toBe(before + 2);
    expect(window.history.state.lineupOpenedAt).toBe(before + 1);

    stepOutOf(router, "lineup", vi.fn());
    await settle();
    expect(position()).toBe(before);
    expect(close).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.query.lineup).toBeUndefined();
    wrapper.unmount();
  });

  it("stays where the page put it when a layer over it is closed", async () => {
    const { open, wrapper } = await mountLayer();
    const router = useRouter();
    const path = router.currentRoute.value.path;
    const before = position();

    await router.push({
      path,
      query: { lineup: "a" },
      state: openedHere("lineup"),
    });
    await settle();
    open.value = true;
    await settle();
    await router.replace({ path, query: { lineup: "b" } });
    await settle();

    open.value = false;
    await settle();
    expect(position()).toBe(before + 1);
    expect(router.currentRoute.value.query.lineup).toBe("b");
    expect(window.history.state.lineupOpenedAt).toBe(before + 1);

    stepOutOf(router, "lineup", vi.fn());
    await settle();
    expect(position()).toBe(before);
    wrapper.unmount();
  });
});
