import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import GameModeForm from "~/components/game-modes/GameModeForm.vue";

const mode = (overrides: Record<string, unknown> = {}) => ({
  id: "mode-1",
  slug: "deathmatch",
  name: "Deathmatch",
  description: null,
  enabled: true,
  archived_at: null,
  competitive_safe: false,
  supported_runtimes: ["swiftlys2"],
  runtime_conflicts: [],
  cfg: null,
  extra_game_params: null,
  valve_mode: "deathmatch",
  match_options: [],
  plugins: [],
  ...overrides,
});

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  vi.restoreAllMocks();
});

async function mount(gameMode: Record<string, unknown>) {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  const mutate = vi
    .spyOn(client, "mutate")
    .mockResolvedValue({ data: {} } as never);

  const wrapper = await mountSuspended(GameModeForm, {
    props: { gameMode },
    attachTo: document.body,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();

  const savedSet = () =>
    mutate.mock.calls
      .map(([options]: any) => print(options.mutation))
      .find((document: string) => document.includes("update_game_modes_by_pk"));

  return { wrapper, savedSet };
}

const valveModeTrigger = () =>
  Array.from(
    document.body.querySelectorAll<HTMLButtonElement>('button[role="combobox"]'),
  ).map((button) => button.textContent?.trim());

describe("GameModeForm Valve game mode", () => {
  it("shows the Valve mode a saved mode runs on", async () => {
    await mount(mode());

    expect(valveModeTrigger()).toContain("Deathmatch");
  });

  it("shows Custom for a mode that names no Valve mode", async () => {
    await mount(mode({ valve_mode: null }));

    expect(valveModeTrigger()).toContain("Custom");
  });

  it("saves the picked Valve mode", async () => {
    const { wrapper, savedSet } = await mount(mode({ valve_mode: null }));

    (wrapper.vm as any).form.setFieldValue("valve_mode", "deathmatch");
    await (wrapper.vm as any).save();

    expect(savedSet()).toContain('valve_mode: "deathmatch"');
  });

  it("saves Custom as no Valve mode", async () => {
    const { wrapper, savedSet } = await mount(mode());

    (wrapper.vm as any).form.setFieldValue("valve_mode", "");
    await (wrapper.vm as any).save();

    expect(savedSet()).toContain("valve_mode: null");
  });

  // The utility system books every practice match on this mode, and the
  // database refuses to delete, retire, disable or rename it.
  it("labels an official 5Stack mode and leaves out what it cannot do", async () => {
    await mount(mode({ slug: "utility-practice", system: true }));

    expect(
      document.body.querySelector('[data-testid="official-mode"]'),
    ).not.toBeNull();
    expect(document.body.textContent).not.toContain("Delete Mode");
    expect(
      document.body.querySelector<HTMLInputElement>('input[placeholder="retakes"]')
        ?.disabled,
    ).toBe(true);
    expect(
      document.body.querySelector('[role="switch"]')?.hasAttribute("disabled"),
    ).toBe(true);
  });

  it("keeps delete on a mode an operator made", async () => {
    await mount(mode({ system: false }));

    expect(
      document.body.querySelector('[data-testid="official-mode"]'),
    ).toBeNull();
    expect(document.body.textContent).toContain("Delete");
  });
});

