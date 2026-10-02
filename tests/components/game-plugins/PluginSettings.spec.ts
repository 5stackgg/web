import { describe, expect, it } from "vitest";
import { defineComponent, reactive, ref } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PluginCvarForm from "~/components/game-plugins/PluginCvarForm.vue";
import SchemaField from "~/components/game-plugins/SchemaField.vue";
import PluginConfigFile from "~/components/game-plugins/PluginConfigFile.vue";
import type { JsonSchema } from "~/utilities/pluginConfig";

const cvars = [
  {
    name: "dm_replenish_health",
    kind: "int" as const,
    defaultValue: "10",
    description: "Amount of health replenished on kill.",
  },
  {
    name: "invsim_ws_enabled",
    kind: "bool" as const,
    defaultValue: "false",
    description: "Live inventory refresh.",
  },
];

describe("PluginCvarForm", () => {
  it("shows the plugin's description and default for each cvar", async () => {
    const wrapper = await mountSuspended(PluginCvarForm, {
      props: { cvars, modelValue: "" },
    });

    expect(wrapper.text()).toContain("Amount of health replenished on kill.");
    expect(wrapper.find('input[placeholder="10"]').exists()).toBe(true);
  });

  it("writes a typed value into the cvar block and keeps the rest", async () => {
    const wrapper = await mountSuspended(PluginCvarForm, {
      props: { cvars, modelValue: "// mine\nmp_freezetime 3\n" },
    });

    await wrapper.find('input[placeholder="10"]').setValue("25");

    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([
      "// mine\nmp_freezetime 3\ndm_replenish_health 25\n",
    ]);
  });

  it("puts a cvar back to its default by removing its line", async () => {
    const wrapper = await mountSuspended(PluginCvarForm, {
      props: { cvars, modelValue: "dm_replenish_health 25\nx 1" },
    });

    await wrapper.find('button[aria-label="Use the default"]').trigger("click");

    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["x 1"]);
  });

  it("asks a server to report before there is anything to describe", async () => {
    const wrapper = await mountSuspended(PluginCvarForm, {
      props: {
        cvars: [
          {
            name: "dm_pro_ratio",
            kind: null,
            defaultValue: null,
            description: null,
          },
        ],
        modelValue: "",
      },
    });

    expect(wrapper.text()).toContain("once a server running this plugin");
  });
});

const modes: JsonSchema = {
  type: "array",
  items: {
    type: "object",
    title: "Mode",
    required: ["name", "duration"],
    properties: {
      name: { type: "string", title: "Name" },
      duration: { type: "integer", title: "Duration", minimum: 1 },
      weapons: {
        type: "array",
        title: "Allowed weapons",
        items: { type: "string", enum: ["ak47", "awp"] },
      },
    },
  },
};

// Through a parent holding the value, the way the config panel uses it: the
// field is recursive, so what matters is what reaches the top.
const host = (schema: JsonSchema, initial: unknown) =>
  defineComponent({
    components: { SchemaField },
    setup() {
      const value = ref(initial);

      return { schema, value };
    },
    template: `<SchemaField :schema="schema" v-model="value" />`,
  });

describe("SchemaField", () => {
  it("adds an entry from the schema's required fields", async () => {
    const wrapper = await mountSuspended(host(modes, []));

    const add = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Mode"));
    await add!.trigger("click");

    expect(wrapper.vm.value).toEqual([{ name: "", duration: 1 }]);
  });

  it("toggles a weapon in an entry's allowed list", async () => {
    const wrapper = await mountSuspended(
      host(modes.items as JsonSchema, {
        name: "Rifles",
        duration: 60,
        weapons: ["ak47"],
      }),
    );

    const awp = wrapper
      .findAll("button")
      .find((button) => button.text() === "awp");
    await awp!.trigger("click");

    expect(wrapper.vm.value).toEqual({
      name: "Rifles",
      duration: 60,
      weapons: ["ak47", "awp"],
    });
  });

  it("keeps an entry's number a number", async () => {
    const wrapper = await mountSuspended(
      host(modes.items as JsonSchema, { name: "Rifles", duration: 60 }),
    );

    await wrapper.find('input[type="number"]').setValue("120");

    expect(wrapper.vm.value).toEqual({ name: "Rifles", duration: 120 });
  });
});

describe("SchemaField lists of plain values", () => {
  it("keeps a list of numbers as numbers", async () => {
    const wrapper = await mountSuspended(
      host({ type: "array", title: "Rounds", items: { type: "integer" } }, [1]),
    );

    await wrapper.find("textarea").setValue("1\n5");

    expect(wrapper.vm.value).toEqual([1, 5]);
  });
});

describe("PluginConfigFile", () => {
  const panel = (initial: unknown) =>
    defineComponent({
      components: { PluginConfigFile },
      setup() {
        const value = ref(initial);
        const shipped = [{ name: "Pistols", duration: 300 }];

        return { value, shipped, modes };
      },
      template: `<PluginConfigFile
        v-model="value"
        :schema="modes"
        :default-config="shipped"
        path="addons/swiftlys2/configs/plugins/Deathmatch/modes.json"
        repo-url="https://github.com/ianlucas/cs2-ss2-deathmatch/blob/v1.1.2/resources/configs/default.json"
        :can-open-shipped="false"
      />`,
    });

  it("starts a customized copy from the file the plugin ships", async () => {
    const wrapper = await mountSuspended(panel(null));

    expect(wrapper.text()).toContain("the file the plugin ships with");
    expect(wrapper.find('a[href*="blob/v1.1.2"]').exists()).toBe(true);

    const customize = wrapper
      .findAll("button")
      .find((button) => button.text() === "Customize");
    await customize!.trigger("click");

    expect(wrapper.vm.value).toEqual([{ name: "Pistols", duration: 300 }]);
  });

  // Reflowing the text into the pretty-printed copy on every keystroke threw
  // the caret to the end and broke the next character typed.
  it("leaves raw JSON as it is typed", async () => {
    const wrapper = await mountSuspended(
      panel([{ name: "Rifles", duration: 60 }]),
    );

    const json = wrapper
      .findAll("button")
      .find((button) => button.text() === "JSON");
    await json!.trigger("click");

    const typed = '[{"name":"Rifles","duration":90}]';
    await wrapper.find("textarea").setValue(typed);

    expect(wrapper.vm.value).toEqual([{ name: "Rifles", duration: 90 }]);
    expect(
      (wrapper.find("textarea").element as HTMLTextAreaElement).value,
    ).toEqual(typed);
  });

  // The page keeps the catalog row in reactive state, so the default arrives
  // as a proxy, which structuredClone refuses: Customize did nothing at all.
  it("customizes from a default the page holds reactively", async () => {
    const wrapper = await mountSuspended(
      defineComponent({
        components: { PluginConfigFile },
        setup() {
          const value = ref<unknown>(null);
          const settings = reactive({
            config_default: [{ name: "Pistols", duration: 300 }],
          });

          return { value, settings, modes };
        },
        template: `<PluginConfigFile
          v-model="value"
          :schema="modes"
          :default-config="settings.config_default"
          path="modes.json"
          :repo-url="null"
          :can-open-shipped="false"
        />`,
      }),
    );

    const customize = wrapper
      .findAll("button")
      .find((button) => button.text() === "Customize");
    await customize!.trigger("click");

    expect(wrapper.vm.value).toEqual([{ name: "Pistols", duration: 300 }]);
  });

  it("goes back to the plugin's own file", async () => {
    const wrapper = await mountSuspended(
      panel([{ name: "Rifles", duration: 60 }]),
    );

    const back = wrapper
      .findAll("button")
      .find((button) => button.text() === "Use the Plugin's File");
    await back!.trigger("click");

    expect(wrapper.vm.value).toBeNull();
  });
});

describe("PluginCvarForm over an inherited layer", () => {
  // Editing one server's cvars: what the plugin page sets shows through until
  // this server sets its own.
  it("shows the plugin page's value where this layer sets nothing", async () => {
    const wrapper = await mountSuspended(PluginCvarForm, {
      props: {
        cvars,
        modelValue: "",
        inherited: "dm_replenish_health 40\ninvsim_ws_enabled 1\n",
      },
    });

    expect(wrapper.text()).toContain("All servers: 40");
    expect(wrapper.find('input[placeholder="40"]').exists()).toBe(true);
    expect(wrapper.find('[role="switch"]').attributes("data-state")).toBe(
      "checked",
    );
  });
});
