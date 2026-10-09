import { expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useRouter } from "#app";
import { useBackDismiss } from "~/composables/useBackDismiss";

const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 30));
  await flushPromises();
};

const position = () => Number(window.history.state?.position);

// A page reloaded with a sheet raised or a menu open comes back on the entry
// that layer made, with the layer gone. In a file of its own: the entry has
// to be there before anything on the page first looks at the history.
it("steps off a layer's entry it is loaded onto with no layer to show", async () => {
  const router = useRouter();
  const before = position();
  const route = router.currentRoute.value;
  await router.push({
    path: route.path,
    query: route.query,
    force: true,
    state: { backLayer: true },
  });
  await settle();
  expect(position()).toBe(before + 1);

  const page = await mountSuspended(
    defineComponent({
      setup() {
        useBackDismiss(
          () => false,
          () => {},
        );
        return () => h("div");
      },
    }),
  );
  await settle();
  await settle();

  expect(position()).toBe(before);
  page.unmount();
});
