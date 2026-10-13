import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useForm } from "vee-validate";
import MatchOptions from "~/components/MatchOptions.vue";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { e_player_roles_enum } from "~/generated/zeus";
import {
  answerMatchOptionsQueries,
  competitiveMaps,
} from "../helpers/matchOptionsQueries";

const customPool = competitiveMaps.slice(0, 5).map(({ id }) => id);

const Host = defineComponent({
  props: { lockMapPool: { type: Boolean, default: false } },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(matchOptionsValidator(this, {}, [])),
        initialValues: {
          custom_map_pool: true,
          map_pool_id: "custom-pool",
          map_pool: customPool,
        },
      }),
    };
  },
  render() {
    return h(MatchOptions, {
      form: this.form,
      lockMapPool: this.lockMapPool,
    });
  },
});

const region = (value: string, description: string) => ({
  value,
  description,
  is_lan: false,
  status: "Online",
  has_node: true,
});

let unmount: (() => void) | null = null;

beforeEach(() => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Organizer",
    role: e_player_roles_enum.administrator,
  } as ReturnType<typeof useAuthStore>["me"];
  useApplicationSettingsStore().availableRegions = [
    region("eu", "Europe"),
    region("na", "North America"),
  ];
  answerMatchOptionsQueries();
});

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  useApplicationSettingsStore().availableRegions = [];
  vi.restoreAllMocks();
});

async function mountOptions(lockMapPool: boolean) {
  const wrapper = await mountSuspended(Host, {
    props: { lockMapPool },
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountOptions>>;
type Control = ReturnType<Wrapper["find"]>;

const values = (wrapper: Wrapper) => (wrapper.vm as any).form.values;

const isDisabled = (control: Control) =>
  control.attributes("disabled") !== undefined;

const controls = (wrapper: Wrapper) => wrapper.findAll("button, input");

const typeButtons = (wrapper: Wrapper) =>
  wrapper
    .findAll("button")
    .filter((button) => ["Competitive", "Wingman"].includes(button.text()));

const customPoolSwitch = (wrapper: Wrapper) =>
  wrapper.get("div.justify-end button[role='switch']");

const mapFilter = (wrapper: Wrapper) =>
  wrapper.get("input[placeholder='Filter Maps']");

function mapTile(wrapper: Wrapper, label: string) {
  const tile = wrapper
    .findAll("div.rounded-lg.overflow-hidden")
    .find((div) => div.text().includes(label));
  expect(tile, `${label} tile`).toBeDefined();
  return tile!;
}

function fieldOf(wrapper: Wrapper, label: string) {
  const item = wrapper
    .findAll("div.space-y-2")
    .find((div) => div.text().startsWith(label));
  expect(item, `${label} field`).toBeDefined();
  return item!;
}

describe("MatchOptions with the match type and map pool locked", () => {
  it("disables the match type selector", async () => {
    const wrapper = await mountOptions(true);

    expect(typeButtons(wrapper)).toHaveLength(2);
    expect(typeButtons(wrapper).every(isDisabled)).toBe(true);

    await typeButtons(wrapper)[1].trigger("click");
    await flushPromises();

    expect(values(wrapper).type).toBe("Competitive");
  });

  it("disables the custom map pool switch and the map filter", async () => {
    const wrapper = await mountOptions(true);

    expect(isDisabled(customPoolSwitch(wrapper))).toBe(true);
    expect(isDisabled(mapFilter(wrapper))).toBe(true);

    await customPoolSwitch(wrapper).trigger("click");
    await flushPromises();

    expect(values(wrapper).custom_map_pool).toBe(true);
    expect(values(wrapper).map_pool).toEqual(customPool);
  });

  it("leaves the selection alone when a map is clicked, and offers no pointer or hover", async () => {
    const wrapper = await mountOptions(true);

    for (const label of ["mirage", "nuke"]) {
      await mapTile(wrapper, label).trigger("click");
      await flushPromises();
    }

    expect(values(wrapper).map_pool).toEqual(customPool);

    for (const label of ["mirage", "nuke"]) {
      expect(mapTile(wrapper, label).classes()).not.toContain("cursor-pointer");
      expect(mapTile(wrapper, label).classes()).not.toContain(
        "hover:scale-105",
      );
    }
  });

  it("locks nothing but the type, the custom pool switch and the map filter", async () => {
    const wrapper = await mountOptions(false);
    const openBefore = controls(wrapper).map((control) => !isDisabled(control));

    await wrapper.setProps({ lockMapPool: true });
    await flushPromises();

    const after = controls(wrapper);
    expect(after).toHaveLength(openBefore.length);

    const locked = after.filter(
      (control, index) => openBefore[index] && isDisabled(control),
    );
    expect(
      locked.map(
        (control) =>
          control.text() ||
          control.attributes("placeholder") ||
          control.attributes("role"),
      ),
    ).toEqual(["Competitive", "Wingman", "switch", "Filter Maps"]);
    expect(isDisabled(customPoolSwitch(wrapper))).toBe(true);

    const stillOpen = [
      fieldOf(wrapper, "TV Delay").get("input"),
      fieldOf(wrapper, "Veto Pick Timer").get("button[role='switch']"),
      fieldOf(wrapper, "Tactical Timeout Settings").get("button"),
      fieldOf(wrapper, "Preferred Regions").get("button"),
    ];
    expect(stillOpen.some(isDisabled)).toBe(false);
  });
});

describe("MatchOptions with the match type and map pool open", () => {
  it("lets the type, the custom pool switch and the maps change", async () => {
    const wrapper = await mountOptions(false);

    expect(typeButtons(wrapper).some(isDisabled)).toBe(false);
    expect(isDisabled(customPoolSwitch(wrapper))).toBe(false);
    expect(customPoolSwitch(wrapper).attributes("aria-checked")).toBe("true");
    expect(isDisabled(mapFilter(wrapper))).toBe(false);
    expect(mapTile(wrapper, "mirage").classes()).toContain("cursor-pointer");

    await mapTile(wrapper, "mirage").trigger("click");
    await flushPromises();

    expect(values(wrapper).map_pool).toEqual(customPool.slice(0, 4));

    await typeButtons(wrapper)[1].trigger("click");
    await flushPromises();

    expect(values(wrapper).type).toBe("Wingman");
  });
});
