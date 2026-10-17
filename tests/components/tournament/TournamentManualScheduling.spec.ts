import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import TournamentMatch from "~/components/tournament/TournamentMatch.vue";
import BracketScheduleDialog from "~/components/tournament/BracketScheduleDialog.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { setApiClockBehindBy } from "../../helpers/serverClock";

const ETA = "2099-10-03T20:00:00.000Z";

function bracket(overrides: Record<string, any> = {}) {
  return {
    id: "bracket-1",
    round: 1,
    match_number: 1,
    bye: false,
    finished: false,
    scheduled_at: null,
    scheduled_eta: ETA,
    team_1: { id: "tt-1", name: "Iron Wolves", team: { name: "Iron Wolves" } },
    team_2: { id: "tt-2", name: "Night Owls", team: { name: "Night Owls" } },
    match: null,
    scheduling_proposals: [],
    ...overrides,
  };
}

let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;

beforeEach(() => {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  mutate = vi.fn().mockResolvedValue({ data: {} });
  vi.spyOn(client, "query").mockResolvedValue({ data: {} });
  vi.spyOn(client, "mutate").mockImplementation(mutate);
  useAuthStore().me = { steam_id: "76561198000000001", role: "user" } as any;
});

afterEach(() => {
  setApiClockBehindBy(0);
  unmount?.();
  unmount = undefined;
  vi.restoreAllMocks();
  useAuthStore().me = undefined as any;
  delete (useNuxtApp() as any).$apollo.mutate;
});

describe("TournamentMatch on a manually scheduled stage", () => {
  async function mountCard(
    tournament: Record<string, unknown>,
    stageOptions: Record<string, unknown> | null = null,
    card: Record<string, any> = {},
  ) {
    const wrapper = await mountSuspended(TournamentMatch, {
      props: {
        round: 1,
        brackets: [bracket(card)],
        stage: { type: "RoundRobin", options: stageOptions },
        tournament: {
          is_organizer: true,
          status: "Live",
          scheduling_mode: "auto",
          options: { match_mode: "auto" },
          ...tournament,
        },
      },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  }

  it("says the match is awaiting a schedule instead of showing an ETA it will never meet", async () => {
    const wrapper = await mountCard(
      { auto_start: true },
      { match_mode: "admin" },
    );

    expect(wrapper.text()).toContain("Awaiting schedule");
    expect(wrapper.findComponent(TimeAgo).exists()).toBe(false);
  });

  it("says so when auto start is off", async () => {
    const wrapper = await mountCard({ auto_start: false });

    expect(wrapper.text()).toContain("Awaiting schedule");
  });

  it("shows the time an organizer gave it", async () => {
    const wrapper = await mountCard(
      { auto_start: true },
      { match_mode: "admin" },
      { scheduled_at: ETA },
    );

    expect(wrapper.text()).not.toContain("Awaiting schedule");
    expect(wrapper.findComponent(TimeAgo).exists()).toBe(true);
  });

  it("keeps the ETA on an automatically scheduled stage", async () => {
    const wrapper = await mountCard({ auto_start: true });

    expect(wrapper.text()).not.toContain("Awaiting schedule");
    expect(wrapper.findComponent(TimeAgo).exists()).toBe(true);
  });

  it("waits until both teams are in the bracket", async () => {
    const wrapper = await mountCard({ auto_start: false }, null, {
      team_2: null,
    });

    expect(wrapper.text()).not.toContain("Awaiting schedule");
  });

  it("says nothing while registration is still open", async () => {
    const wrapper = await mountCard({
      auto_start: false,
      status: "RegistrationOpen",
    });

    expect(wrapper.text()).not.toContain("Awaiting schedule");
  });

  it("keeps the ETA of a bracket whose own options are Auto on an Admin stage", async () => {
    const wrapper = await mountCard(
      { auto_start: true },
      { match_mode: "admin" },
      { options: { match_mode: "auto" } },
    );

    expect(wrapper.text()).not.toContain("Awaiting schedule");
    expect(wrapper.findComponent(TimeAgo).exists()).toBe(true);
  });
});

describe("BracketScheduleDialog", () => {
  async function mountDialog(card: Record<string, any> = {}) {
    (useNuxtApp() as any).$apollo.mutate = mutate;
    const wrapper = await mountSuspended(BracketScheduleDialog, {
      props: { open: true, bracket: bracket(card) },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  }

  it("offers ASAP without picking a date or time", async () => {
    await mountDialog();

    const asap = [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "ASAP",
    );
    expect(asap, "ASAP button").toBeDefined();
    expect(asap!.disabled).toBe(false);
  });

  it("schedules the bracket for now and closes", async () => {
    const wrapper = await mountDialog();
    const before = Date.now();

    await (wrapper.vm as any).scheduleAsap();
    await flushPromises();

    expect(mutate).toHaveBeenCalledTimes(1);
    const [{ mutation }] = mutate.mock.calls[0];
    const sent = print(mutation);
    expect(sent).toContain("update_tournament_brackets_by_pk");
    const scheduledAt = Date.parse(
      sent.match(/scheduled_at: "([^"]+)"/)?.[1] ?? "",
    );
    expect(scheduledAt).toBeGreaterThanOrEqual(before - 1000);
    expect(scheduledAt).toBeLessThanOrEqual(Date.now() + 1000);
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("schedules on the api's clock, not this device's", async () => {
    setApiClockBehindBy(10 * 60_000);
    const wrapper = await mountDialog();

    await (wrapper.vm as any).scheduleAsap();
    await flushPromises();

    const sent = print(mutate.mock.calls[0][0].mutation);
    const scheduledAt = Date.parse(
      sent.match(/scheduled_at: "([^"]+)"/)?.[1] ?? "",
    );
    expect(Math.abs(scheduledAt - (Date.now() - 10 * 60_000))).toBeLessThan(
      2000,
    );
  });

  it("can't schedule ASAP once the bracket has a match", async () => {
    const wrapper = await mountDialog({ match: { id: "match-1" } });

    const asap = [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "ASAP",
    );
    expect(asap!.disabled).toBe(true);

    await (wrapper.vm as any).scheduleAsap();
    await flushPromises();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("keeps a picked date and time when the bracket's data refreshes", async () => {
    const wrapper = await mountDialog();
    (wrapper.vm as any).startTime = "21:30";
    await flushPromises();

    await wrapper.setProps({ bracket: bracket() });
    await flushPromises();

    expect((wrapper.vm as any).startTime).toBe("21:30");
  });

  it("saves with the app's tactical button and shows no green", async () => {
    await mountDialog({ scheduled_at: ETA });

    const save = [...document.body.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Save Schedule",
    );
    expect(save!.className).toContain("tac-amber");
    expect(save!.className).not.toContain("bg-primary");
    expect(document.body.innerHTML).not.toContain("text-green");
  });
});
