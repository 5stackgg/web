import { afterEach, describe, expect, it } from "vitest";
import { h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { Drawer, DrawerContent, DrawerTitle } from "~/components/ui/drawer";

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;
let wrapper: Wrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

async function mountDrawer(content: Record<string, unknown> = {}) {
  wrapper = await mountSuspended(
    {
      render: () =>
        h(Drawer, { open: true }, () =>
          h(DrawerContent, content, () => [
            h(DrawerTitle, () => "Pick a player"),
            h("p", { class: "body" }, "Inside"),
          ]),
        ),
    },
    { attachTo: document.body },
  );
  await flushPromises();
  return wrapper;
}

const drawer = () =>
  document.querySelector("[data-vaul-drawer]") as HTMLElement;

describe("the shared DrawerContent", () => {
  // SanctionPlayer, PlayerSearch, InstallPWADrawer and the rest pass it a
  // class at most: this is what they have always been given.
  it("dims the page and draws its grab bar unless told otherwise", async () => {
    await mountDrawer({ class: "p-4" });

    expect(document.querySelector("[data-vaul-overlay]")).not.toBeNull();
    expect(drawer().querySelector(".rounded-full.bg-muted")).not.toBeNull();
    expect(drawer().classList.contains("p-4")).toBe(true);
    expect(drawer().classList.contains("z-50")).toBe(true);
    expect(drawer().getAttribute("role")).toBe("dialog");
    expect(drawer().querySelector(".body")?.textContent).toBe("Inside");
  });

  it("can be a drawer with no overlay and no grab bar of its own", async () => {
    await mountDrawer({ overlay: false, handle: false });

    expect(document.querySelector("[data-vaul-overlay]")).toBeNull();
    expect(drawer().querySelector(".rounded-full.bg-muted")).toBeNull();
    expect(drawer().querySelector(".body")).not.toBeNull();
  });

  it("puts what it is passed on the drawer, not on the portal around it", async () => {
    await mountDrawer({
      "data-sheet": "",
      role: "region",
      style: { height: "400px" },
      class: "z-30",
    });

    expect(drawer().hasAttribute("data-sheet")).toBe(true);
    expect(drawer().getAttribute("role")).toBe("region");
    expect(drawer().style.height).toBe("400px");
    // A class of the caller's wins over the wrapper's own for the same thing.
    expect(drawer().classList.contains("z-30")).toBe(true);
    expect(drawer().classList.contains("z-50")).toBe(false);
  });
});
