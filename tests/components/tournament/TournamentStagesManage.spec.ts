import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import TournamentStagesManage from "~/components/tournament/TournamentStagesManage.vue";
import TournamentStageForm from "~/components/tournament/TournamentStageForm.vue";

const LOCKED =
  "Stages can't change once the bracket is drawn. Reset the tournament to Setup to edit them.";

type Bracket = {
  team_1?: { id: string } | null;
  team_2?: { id: string } | null;
  match?: { id: string } | null;
};

const emptySlot = (): Bracket => ({ team_1: null, team_2: null, match: null });

const stage = (order: number, brackets: Bracket[]) => ({
  id: `stage-${order}`,
  order,
  type: "SingleElimination",
  e_tournament_stage_type: { description: "Single Elimination" },
  min_teams: 8,
  max_teams: 8,
  groups: 1,
  default_best_of: 1,
  brackets,
});

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

async function mountStages(status: string, brackets: Bracket[] = []) {
  const wrapper = await mountSuspended(TournamentStagesManage, {
    props: {
      tournament: {
        id: "tournament-1",
        status,
        options: { best_of: 1 },
        stages: [stage(1, brackets), stage(2, [emptySlot()])],
      },
    },
    global: { stubs: { TournamentStageForm: true } },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountStages>>;

const buttons = (wrapper: Wrapper, text: string) =>
  wrapper.findAll("button").filter((b) => b.text().includes(text));

const deletes = (wrapper: Wrapper) =>
  wrapper.findAll("button[aria-label='Delete Stage']");

const disabled = (el: { attributes: (name: string) => string | undefined }) =>
  el.attributes("disabled") !== undefined;

const unavailable = (el: {
  attributes: (name: string) => string | undefined;
}) => disabled(el) || el.attributes("aria-disabled") === "true";

function expectStructureOpen(wrapper: Wrapper) {
  expect(buttons(wrapper, "Add Another Stage")).toHaveLength(1);
  expect(disabled(buttons(wrapper, "Add Another Stage")[0])).toBe(false);
  expect(deletes(wrapper)).toHaveLength(2);
  expect(deletes(wrapper).some(unavailable)).toBe(false);
  expect(wrapper.find(`[aria-label="${LOCKED}"]`).exists()).toBe(false);
}

function expectStructureLocked(wrapper: Wrapper) {
  expect(buttons(wrapper, "Add Another Stage")).toHaveLength(1);
  expect(disabled(buttons(wrapper, "Add Another Stage")[0])).toBe(true);
  expect(deletes(wrapper)).toHaveLength(2);
  expect(deletes(wrapper).every(unavailable)).toBe(true);
  expect(wrapper.find(`[aria-label="${LOCKED}"]`).exists()).toBe(true);
}

async function openEdit(wrapper: Wrapper) {
  await buttons(wrapper, "Edit")[0].trigger("click");
  await flushPromises();
  return wrapper.findComponent(TournamentStageForm);
}

describe("TournamentStagesManage", () => {
  it("leaves every control open in Setup, even with a bracket from an earlier draw", async () => {
    const wrapper = await mountStages("Setup", [
      { team_1: { id: "team-a" }, team_2: null, match: null },
    ]);

    expectStructureOpen(wrapper);
    expect((await openEdit(wrapper)).props("structureLocked")).toBe(false);
  });

  it("leaves every control open while registration is open and nothing is drawn", async () => {
    const wrapper = await mountStages("RegistrationOpen", [
      emptySlot(),
      emptySlot(),
    ]);

    expectStructureOpen(wrapper);
  });

  it("locks adding, deleting and the structure once a team is drawn into a bracket", async () => {
    const wrapper = await mountStages("RegistrationOpen", [
      emptySlot(),
      { team_1: null, team_2: { id: "team-b" }, match: null },
    ]);

    expectStructureLocked(wrapper);
    expect((await openEdit(wrapper)).props("structureLocked")).toBe(true);
  });

  it("locks the structure during check-in review once a match exists", async () => {
    const wrapper = await mountStages("CheckInReview", [
      { team_1: null, team_2: null, match: { id: "match-1" } },
    ]);

    expectStructureLocked(wrapper);
  });

  it("locks adding and deleting while the tournament is paused", async () => {
    const wrapper = await mountStages("Paused");

    expectStructureLocked(wrapper);
    expect(buttons(wrapper, "Edit")).toHaveLength(2);
    expect((await openEdit(wrapper)).props("structureLocked")).toBe(true);
  });

  it("keeps Edit open for the best-of while the tournament is live", async () => {
    const wrapper = await mountStages("Live");

    expectStructureLocked(wrapper);
    expect(buttons(wrapper, "Edit")).toHaveLength(2);
    expect((await openEdit(wrapper)).props("structureLocked")).toBe(true);
  });

  it("keeps a locked delete reachable by keyboard, with its reason, and inert", async () => {
    const wrapper = await mountStages("Paused");
    const trash = deletes(wrapper)[0];

    expect(disabled(trash)).toBe(false);
    expect(trash.attributes("aria-disabled")).toBe("true");

    (trash.element as HTMLElement).focus();
    await flushPromises();
    expect(
      document.body.querySelector('[role="tooltip"]')?.textContent,
    ).toContain(LOCKED);

    await trash.trigger("click");
    await flushPromises();
    expect(document.body.textContent).not.toContain(
      "Are you sure you want to delete this stage?",
    );
  });

  it("locks every stage control once the tournament is finished", async () => {
    const wrapper = await mountStages("Finished");

    expect(buttons(wrapper, "Edit")).toHaveLength(0);
    expect(buttons(wrapper, "Add Another Stage")).toHaveLength(0);
    expect(deletes(wrapper)).toHaveLength(0);
  });
});
