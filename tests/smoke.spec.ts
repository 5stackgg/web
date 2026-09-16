import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { NuxtLink } from "#components";
import { cn } from "~/lib/utils";

describe("vitest nuxt environment", () => {
  it("resolves app aliases and nuxt auto-imports", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(useRuntimeConfig().public).toHaveProperty("apiDomain");
  });

  it("renders components inside the nuxt app with i18n and the real router", async () => {
    const wrapper = await mountSuspended(
      defineComponent({
        render: () =>
          h(NuxtLink, { to: "/teams/abc" }, () =>
            useNuxtApp().$i18n.t("event.teams.title"),
          ),
      }),
    );

    expect(wrapper.html()).toBe('<a href="/teams/abc">Teams</a>');
  });
});
