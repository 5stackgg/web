import { afterEach, describe, expect, it } from "vitest";
import { computed, defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { SidebarProvider } from "@/components/ui/sidebar";
import LeftNavBanner from "~/layouts/components/LeftNavBanner.vue";

const branding = ref<{
  name: string | null;
  logo: string | null;
  banner: string | null;
}>({
  name: null,
  logo: null,
  banner: null,
});

mockNuxtImport("useBranding", () => () => ({
  brandName: computed(() => branding.value.name),
  logoUrl: computed(() => branding.value.logo),
  bannerUrl: computed(() => branding.value.banner),
}));

let unmount: (() => void) | undefined;

async function mount() {
  const wrapper = await mountSuspended(
    defineComponent({
      render: () =>
        h(SidebarProvider, null, () => h(LeftNavBanner, { to: "/watch" })),
    }),
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

afterEach(() => {
  unmount?.();
  unmount = undefined;
  branding.value = { name: null, logo: null, banner: null };
});

describe("LeftNavBanner", () => {
  it("links home with the 5Stack badge and name when nothing is uploaded", async () => {
    const wrapper = await mount();
    const link = wrapper.get('a[href="/watch"]');

    expect(link.find("img").attributes("src")).toBe("/favicon/192.png");
    expect(link.text().toLowerCase()).toContain("5stack");
  });

  it("uses a community's own logo and name", async () => {
    branding.value = {
      name: "Northside CS",
      logo: "https://api.test/branding/logo",
      banner: null,
    };
    const wrapper = await mount();

    expect(wrapper.find("img").attributes("src")).toBe(
      "https://api.test/branding/logo",
    );
    expect(wrapper.text()).toContain("Northside CS");
  });

  it("fills with the uploaded banner image instead", async () => {
    branding.value = {
      name: "Northside CS",
      logo: null,
      banner: "https://api.test/branding/banner?v=1",
    };
    const wrapper = await mount();

    expect(wrapper.findAll("img")).toHaveLength(1);
    expect(wrapper.get("img").attributes("src")).toBe(
      "https://api.test/branding/banner?v=1",
    );
    expect(wrapper.text()).not.toContain("Northside CS");
  });
});
