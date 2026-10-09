import { afterEach, describe, expect, it } from "vitest";
import { h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ClipShareMenu from "~/components/clips/ClipShareMenu.vue";

const mounted: Array<{ unmount: () => void }> = [];

async function mount(...args: Parameters<typeof mountSuspended>) {
  const wrapper = await mountSuspended(...args);
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

const items = () =>
  Array.from(document.querySelectorAll("[role=menuitem]")).map((item) =>
    item.textContent!.replace(/\s+/g, " ").trim(),
  );

describe("ClipShareMenu", () => {
  it("offers the link and the download with its size", async () => {
    await mount(ClipShareMenu, {
      props: {
        open: true,
        copied: false,
        downloadHref: "https://cf.test/clips/c-1.mp4?dl=1&name=ace.mp4",
        downloadName: "ace.mp4",
        sizeLabel: "22.9 MB",
      },
      attachTo: document.body,
    });
    await flushPromises();

    expect(items()).toEqual(["Copy link", "Download 22.9 MB"]);
    const download = document.querySelector("a[role=menuitem]")!;
    expect(download.getAttribute("href")).toBe(
      "https://cf.test/clips/c-1.mp4?dl=1&name=ace.mp4",
    );
  });

  it("copies without closing, so the copied state shows in place", async () => {
    const wrapper = await mount(ClipShareMenu, {
      props: { open: true, copied: false },
      attachTo: document.body,
    });
    await flushPromises();

    (document.querySelector("[role=menuitem]") as HTMLElement).click();
    await flushPromises();

    expect(wrapper.emitted("copy")).toHaveLength(1);
    expect(wrapper.emitted("update:open")).toBeUndefined();

    await wrapper.setProps({ copied: true });
    expect(items()[0]).toBe("Link copied!");
  });

  it("names the lineup's actions, and holds what a surface adds below", async () => {
    await mount(ClipShareMenu, {
      props: {
        open: true,
        copied: false,
        copyLabel: "Copy lineup link",
        downloadHref: "https://cf.test/clips/utility/l-1/r.mp4?dl=1",
        downloadLabel: "Download clip",
      },
      slots: { default: () => h("div", { role: "menuitem" }, "Delete clip") },
      attachTo: document.body,
    });
    await flushPromises();

    expect(items()).toEqual([
      "Copy lineup link",
      "Download clip",
      "Delete clip",
    ]);
  });
});
