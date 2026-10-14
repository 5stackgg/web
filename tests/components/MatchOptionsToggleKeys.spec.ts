import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useForm } from "vee-validate";
import MatchOptions from "~/components/MatchOptions.vue";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { e_player_roles_enum } from "~/generated/zeus";
import { answerMatchOptionsQueries } from "../helpers/matchOptionsQueries";

const Host = defineComponent({
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(matchOptionsValidator(this, {}, [])),
      }),
    };
  },
  render() {
    return h(MatchOptions, { form: this.form });
  },
});

let unmount: (() => void) | null = null;

beforeEach(() => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Organizer",
    role: e_player_roles_enum.administrator,
  } as ReturnType<typeof useAuthStore>["me"];
  answerMatchOptionsQueries();
});

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

async function mapVetoSwitch() {
  const wrapper = await mountSuspended(Host, {
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();

  const row = wrapper
    .findAll("div.space-y-2")
    .find((div) => div.text().startsWith("Map Veto"));
  expect(row, "Map Veto row").toBeDefined();
  const toggle = row!.get("button[role='switch']").element as HTMLElement;
  return { row: row!.element as HTMLElement, toggle };
}

const checked = (toggle: HTMLElement) => toggle.getAttribute("aria-checked");

// A browser runs microtasks between one listener and the next, so by the time
// the switch's click bubbles to its row, Vue has re-rendered the row's handler
// with the new value. happy-dom runs every listener in one go, so the bubble
// is replayed after the re-render, unless the switch stopped it.
async function activate(toggle: HTMLElement) {
  const click = new MouseEvent("click", { bubbles: false, cancelable: true });
  toggle.dispatchEvent(click);
  await nextTick();
  if (!click.cancelBubble) {
    toggle.parentElement!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
  }
  await flushPromises();
}

describe("MatchOptions toggle rows", () => {
  it("flips once when the focused switch is pressed with Space", async () => {
    const { toggle } = await mapVetoSwitch();
    const before = checked(toggle);

    toggle.focus();
    toggle.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
    await activate(toggle);

    expect(checked(toggle)).not.toBe(before);
  });

  it("flips once when the focused switch is pressed with Enter", async () => {
    const { toggle } = await mapVetoSwitch();
    const before = checked(toggle);

    toggle.focus();
    toggle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();

    expect(checked(toggle)).not.toBe(before);
  });

  it("flips once when the row is clicked", async () => {
    const { row, toggle } = await mapVetoSwitch();
    const before = checked(toggle);

    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    expect(checked(toggle)).not.toBe(before);
  });
});
