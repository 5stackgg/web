import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useForm } from "vee-validate";
import MatchOptions from "~/components/MatchOptions.vue";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { e_player_roles_enum } from "~/generated/zeus";
import { answerMatchOptionsQueries } from "../helpers/matchOptionsQueries";

const Host = defineComponent({
  props: {
    initialValues: { type: Object, default: undefined },
  },
  data() {
    return {
      form: useForm({
        validationSchema: toTypedSchema(matchOptionsValidator(this, {}, [])),
        initialValues: this.initialValues,
      }),
    };
  },
  render() {
    return h(MatchOptions, { form: this.form });
  },
});

const region = (value: string, is_lan = false) => ({
  value,
  description: value,
  is_lan,
  status: "Online",
  has_node: true,
});

const signIn = (role: e_player_roles_enum) => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Player",
    role,
  } as ReturnType<typeof useAuthStore>["me"];
};

const probe = (value: string, isLan: boolean) =>
  useMatchmakingStore().latencies.set(value, { isLan, latency: 1 } as never);

let unmount: (() => void) | null = null;

beforeEach(() => {
  useApplicationSettingsStore().availableRegions = [
    region("eu"),
    region("Lan", true),
    region("Lan2", true),
  ];
  answerMatchOptionsQueries();
});

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  useApplicationSettingsStore().availableRegions = [];
  useMatchmakingStore().latencies.clear();
  vi.restoreAllMocks();
});

async function mountOptions(initialValues?: Record<string, unknown>) {
  const wrapper = await mountSuspended(Host, {
    props: { initialValues },
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountOptions>>;

const options = (wrapper: Wrapper) =>
  wrapper.findComponent(MatchOptions).vm as any;

const hasLanToggle = (wrapper: Wrapper) => wrapper.text().includes("LAN Match");

describe("MatchOptions LAN match", () => {
  it("offers a player the LAN probe placed on the LAN that LAN", async () => {
    signIn(e_player_roles_enum.user);
    probe("Lan", true);
    probe("Lan2", false);

    const wrapper = await mountOptions();
    expect(hasLanToggle(wrapper)).toBe(true);

    options(wrapper).form.setFieldValue("lan", true);
    await flushPromises();

    expect(
      options(wrapper).regions.map((lan: { value: string }) => lan.value),
    ).toEqual(["Lan"]);
    expect(options(wrapper).form.values.regions).toEqual(["Lan"]);
  });

  it("offers a player off the LAN no LAN match", async () => {
    signIn(e_player_roles_enum.user);
    probe("Lan", false);

    const wrapper = await mountOptions();
    expect(hasLanToggle(wrapper)).toBe(false);
  });

  it.each([
    e_player_roles_enum.match_organizer,
    e_player_roles_enum.tournament_organizer,
  ])("offers a %s off the LAN every LAN", async (role) => {
    signIn(role);

    const wrapper = await mountOptions();
    expect(hasLanToggle(wrapper)).toBe(true);

    options(wrapper).form.setFieldValue("lan", true);
    await flushPromises();

    expect(
      options(wrapper).regions.map((lan: { value: string }) => lan.value),
    ).toEqual(["Lan", "Lan2"]);
  });

  // Seeded the way CreateDraftGame seeds a quick-hosted LAN room.
  const lanLobby = { regions: ["Lan"], region_veto: false };

  it("keeps a LAN lobby on its LAN while the probe has not answered", async () => {
    signIn(e_player_roles_enum.user);

    const wrapper = await mountOptions(lanLobby);

    expect(options(wrapper).form.values.lan).toBe(true);
    expect(options(wrapper).form.values.regions).toEqual(["Lan"]);
  });

  it("keeps a LAN lobby on its LAN when the probe placed the host on another", async () => {
    signIn(e_player_roles_enum.user);
    probe("Lan2", true);

    const wrapper = await mountOptions(lanLobby);

    expect(options(wrapper).form.values.regions).toEqual(["Lan"]);
    expect(
      options(wrapper).regions.map((lan: { value: string }) => lan.value),
    ).toEqual(["Lan", "Lan2"]);
  });
});
