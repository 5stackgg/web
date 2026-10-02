import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import GameModesPage from "~/pages/settings/application/game-modes.vue";
import { useAuthStore } from "~/stores/AuthStore";

const mode = (overrides: Record<string, unknown>) => ({
  id: "mode",
  slug: "mode",
  name: "Mode",
  description: "A mode.",
  enabled: true,
  archived_at: null,
  competitive_safe: false,
  supported_runtimes: ["swiftlys2"],
  runtime_conflicts: [],
  cfg: null,
  extra_game_params: null,
  valve_mode: null,
  system: false,
  match_options: [],
  plugins: [],
  ...overrides,
});

const modes = [
  mode({
    id: "chaos",
    slug: "chaos",
    name: "Chaos",
    valve_mode: "competitive",
    competitive_safe: true,
    plugins: [
      { plugin_slug: "csroll", load_order: 0, plugin: { name: "CSRoll" } },
    ],
  }),
  mode({
    id: "utility",
    slug: "utility-practice",
    name: "Utility Practice",
    system: true,
  }),
  mode({
    id: "deathmatch",
    slug: "deathmatch",
    name: "Deathmatch",
    valve_mode: "deathmatch",
    plugins: [
      {
        plugin_slug: "deathmatch",
        load_order: 0,
        plugin: { name: "Deathmatch" },
      },
    ],
  }),
];

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

async function mountPage() {
  useAuthStore().me = { steam_id: "1", role: "administrator" } as any;

  const client = (useNuxtApp() as any).$apollo.defaultClient;
  const mutate = vi
    .spyOn(client, "mutate")
    .mockResolvedValue({ data: {} } as never);

  const wrapper = await mountSuspended(GameModesPage, {
    attachTo: document.body,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
    },
  });
  unmount = () => wrapper.unmount();

  const vm = wrapper.vm as any;
  vm.$apollo?.queries?.gameModes?.stop();
  vm.gameModes = modes;
  await flushPromises();

  return { wrapper, mutate };
}

const card = (wrapper: any, slug: string) =>
  wrapper.find(`[data-game-mode="${slug}"]`);

describe("game modes page", () => {
  it("shows each mode as a card with what it runs on and its plugins", async () => {
    const { wrapper } = await mountPage();

    const chaos = card(wrapper, "chaos");
    expect(chaos.text()).toContain("Runs on");
    expect(chaos.text()).toContain("Competitive");
    expect(chaos.text()).toContain("CSRoll");
    expect(card(wrapper, "deathmatch").text()).toContain("Deathmatch");
    expect(wrapper.text()).not.toContain("Hidden from drafts");
  });

  it("leads with the official mode, always on and with no switches", async () => {
    const { wrapper } = await mountPage();

    const cards = wrapper.findAll("[data-game-mode]");
    expect(cards[0].attributes("data-game-mode")).toBe("utility-practice");

    const official = card(wrapper, "utility-practice");
    expect(official.text()).toContain("Official 5Stack");
    expect(official.text()).toContain("Always on");
    expect(official.find('[role="switch"]').exists()).toBe(false);
  });

  it("saves a draft lobby switch on the spot", async () => {
    const { wrapper, mutate } = await mountPage();

    await card(wrapper, "deathmatch")
      .find('[data-testid="mode-drafts"]')
      .trigger("click");
    await flushPromises();

    const saved = mutate.mock.calls.map(([options]: any) =>
      print(options.mutation),
    );
    expect(saved).toHaveLength(1);
    expect(saved[0]).toContain('id: "deathmatch"');
    expect(saved[0]).toContain("competitive_safe: true");
  });

  it("opens a mode's editor from anywhere on its card", async () => {
    const { wrapper } = await mountPage();

    await card(wrapper, "chaos").find("h3 button").trigger("click");
    await flushPromises();

    expect(document.body.textContent).toContain("Edit Game Mode");
  });

  it("starts a new mode from the dashed tile", async () => {
    const { wrapper } = await mountPage();

    await wrapper.find('[data-testid="new-mode"]').trigger("click");
    await flushPromises();

    expect(document.body.textContent).toContain("New Game Mode");
  });
});
