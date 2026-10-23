import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import BracketFollowSelect from "~/components/tournament/BracketFollowSelect.vue";
import { Select } from "~/components/ui/select";
import { useBracketView } from "~/composables/useBracketView";
import { SELECT_NONE } from "~/utilities/selectNone";

const teams = [
  { id: "northside", name: "Northside" },
  { id: "academy", name: "Academy" },
  { id: "lantern", name: "Lantern" },
];

let mounted: { unmount: () => void } | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  const { followTeamId, followDefaultTeamId, followPicked } = useBracketView();
  followTeamId.value = null;
  followDefaultTeamId.value = null;
  followPicked.value = false;
});

async function mountFollow() {
  const wrapper = await mountSuspended(BracketFollowSelect, {
    props: { teams },
  });
  mounted = wrapper;
  await flushPromises();
  return wrapper;
}

describe("BracketFollowSelect default team", () => {
  it("follows the page's default team when the bracket opens", async () => {
    useBracketView().followDefaultTeamId.value = "academy";

    await mountFollow();

    expect(useBracketView().followTeamId.value).toBe("academy");
  });

  it("follows the new default while the bracket is open", async () => {
    useBracketView().followDefaultTeamId.value = "academy";
    await mountFollow();

    useBracketView().followDefaultTeamId.value = "northside";
    await flushPromises();

    expect(useBracketView().followTeamId.value).toBe("northside");
  });

  it("follows nothing without a default", async () => {
    await mountFollow();

    expect(useBracketView().followTeamId.value).toBeNull();
  });

  it("keeps the viewer's own None when the bracket reopens", async () => {
    useBracketView().followDefaultTeamId.value = "academy";
    const wrapper = await mountFollow();

    wrapper.findComponent(Select).vm.$emit("update:modelValue", SELECT_NONE);
    await flushPromises();
    wrapper.unmount();
    mounted = null;
    await mountFollow();

    expect(useBracketView().followTeamId.value).toBeNull();
  });

  it("does not swap the viewer's own pick for the default on reopen", async () => {
    useBracketView().followDefaultTeamId.value = "academy";
    const wrapper = await mountFollow();

    wrapper.findComponent(Select).vm.$emit("update:modelValue", "lantern");
    await flushPromises();
    wrapper.unmount();
    mounted = null;
    await mountFollow();

    expect(useBracketView().followTeamId.value).toBeNull();
    expect(useBracketView().followPicked.value).toBe(true);
  });

  it("keeps the default when the toolbar swaps one select for another", async () => {
    useBracketView().followDefaultTeamId.value = "academy";
    const Toolbar = defineComponent({
      props: { tabs: { type: Boolean, default: true } },
      setup(props) {
        return () =>
          props.tabs
            ? h("div", [h(BracketFollowSelect, { key: "tabs", teams })])
            : h("section", [h(BracketFollowSelect, { key: "plain", teams })]);
      },
    });
    const wrapper = await mountSuspended(Toolbar);
    mounted = wrapper;
    await flushPromises();

    await wrapper.setProps({ tabs: false });
    await flushPromises();

    expect(useBracketView().followTeamId.value).toBe("academy");
  });
});
