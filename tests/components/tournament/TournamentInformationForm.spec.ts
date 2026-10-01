import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import type { DocumentNode, OperationDefinitionNode } from "graphql";
import TournamentInformationForm from "~/components/tournament/TournamentInformationForm.vue";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

const tournament = {
  id: "tournament-1",
  name: "2v2 Wingman Tournament",
  start: "2026-11-14T22:00:00.000Z",
  description: "Winner takes all.",
  homepage: null,
  location: null,
  latitude: null,
  longitude: null,
  categories: [],
  min_players_per_lineup: 2,
};

const registrationSettings = {
  id: "tournament-1",
  start: tournament.start,
  registration_type: "both",
  min_role: null,
  min_elo: null,
  max_elo: null,
  invite_only: false,
  check_in_required: true,
  check_in_setting: "Captains",
  check_in_opens_before_minutes: 60,
  check_in_closes_before_minutes: 15,
  check_in_started: false,
};

let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  toast.mockReset();
  vi.restoreAllMocks();
});

function updateCall() {
  const call = mutate.mock.calls
    .map(([options]) => options)
    .find((options) =>
      options.mutation.loc?.source.body.includes("update_tournaments_by_pk"),
    );
  expect(call, "update_tournaments_by_pk mutation").toBeDefined();
  return call as { mutation: DocumentNode; variables: Record<string, any> };
}

function declaredVariables(document: DocumentNode) {
  const operation = document.definitions[0] as OperationDefinitionNode;
  return (operation.variableDefinitions ?? []).map(
    (definition) => definition.variable.name.value,
  );
}

async function saveEditedHomepage() {
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(
    (useNuxtApp() as any).$apollo.defaultClient,
    "mutate",
  ).mockImplementation(mutate);

  const wrapper = await mountSuspended(TournamentInformationForm, {
    props: { tournament },
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: {
        ImageUploadTile: true,
        DateTimePicker: true,
        CategorySelect: true,
        AddressSearch: true,
        TournamentRegistrationForm: true,
        SettingsSaveBar: true,
      },
    },
  });
  unmount = () => wrapper.unmount();

  const vm = wrapper.vm as any;
  vm.registrationSettings = registrationSettings;
  vm.populate();
  await flushPromises();

  vm.form.setFieldValue("homepage", "https://example.com/wingman");
  await flushPromises();

  await vm.save();
  await flushPromises();
}

describe("TournamentInformationForm save", () => {
  it("sends a value for every variable the update declares", async () => {
    await saveEditedHomepage();

    const { mutation, variables } = updateCall();
    const unsent = declaredVariables(mutation).filter(
      (name) => variables[name] === undefined,
    );

    expect(unsent).toEqual([]);
    expect(variables.homepage).toBe("https://example.com/wingman");
  });
});
