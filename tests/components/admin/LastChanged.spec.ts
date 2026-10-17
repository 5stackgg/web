import { beforeAll, describe, expect, it } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import LastChanged from "~/components/admin/LastChanged.vue";

const ADMIN = { name: "Granting Admin", steam_id: "76561198000000042" };

beforeAll(() => {
  // Ahead of the locale merge, so this reads the same before and after it.
  const i18n = useNuxtApp().$i18n as any;
  i18n.mergeLocaleMessage(i18n.locale.value, {
    admin: { last_changed: { updated_by: "Updated {time} by {name}" } },
  });
});

describe("LastChanged", () => {
  it("renders nothing without a time", async () => {
    const wrapper = await mountSuspended(LastChanged, {
      props: { at: null, by: ADMIN },
    });

    expect(wrapper.find("[data-last-changed]").exists()).toBe(false);
    expect(wrapper.text()).toBe("");
  });

  it("says when, with no name for an unknown editor", async () => {
    const wrapper = await mountSuspended(LastChanged, {
      props: { at: new Date(Date.now() - 3 * 3600_000).toISOString() },
    });

    expect(wrapper.find("[data-last-changed]").exists()).toBe(true);
    expect(wrapper.text()).toContain("3 hours ago");
    expect(wrapper.find("a").exists()).toBe(false);
  });

  it("names the editor, linked to their profile", async () => {
    const wrapper = await mountSuspended(LastChanged, {
      props: {
        at: new Date(Date.now() - 3 * 3600_000).toISOString(),
        by: ADMIN,
      },
    });

    const link = wrapper.get("a");
    expect(link.text()).toBe("Granting Admin");
    expect(link.attributes("href")).toBe(`/players/${ADMIN.steam_id}`);
    expect(wrapper.text()).toContain("3 hours ago");
  });

  it("leads with a dot at the end of a meta line", async () => {
    const wrapper = await mountSuspended(LastChanged, {
      props: { at: new Date().toISOString(), dot: true },
    });

    expect(wrapper.get('[aria-hidden="true"]').text()).toBe("·");
  });
});
