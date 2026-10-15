import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MatchesPage from "~/pages/matches/index.vue";

const STORAGE_KEY = "matches-filters";
const DECIDED_RESULTS = {
  _or: [
    { status: { _eq: "Finished" } },
    {
      status: { _in: ["Forfeit", "Surrendered"] },
      winning_lineup_id: { _is_null: false },
    },
  ],
};

let wheres: any[] = [];
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

async function mountWithSaved(statuses: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ statuses }));
  wrapper = await mountSuspended(MatchesPage, {
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return wrapper;
}

const lastWhere = () => wheres[wheres.length - 1];

beforeEach(() => {
  wheres = [];
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => {
    if (options.variables?.where_clause) {
      wheres.push(options.variables.where_clause);
    }
    return {
      subscribe: () => ({ unsubscribe() {}, closed: false }),
    } as any;
  });
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  localStorage.removeItem(STORAGE_KEY);
  vi.restoreAllMocks();
});

describe("matches list status filter", () => {
  it("reads a filter saved as just Finished as the finished preset", async () => {
    const page = await mountWithSaved(["Finished"]);

    expect([...(page.vm as any).form.statuses].sort()).toEqual([
      "Finished",
      "Forfeit",
      "Surrendered",
    ]);
  });

  it("asks the finished preset for forfeits and surrenders only with a winner", async () => {
    await mountWithSaved(["Finished"]);

    expect(lastWhere().status).toBeUndefined();
    expect(lastWhere()._and).toContainEqual(DECIDED_RESULTS);
  });

  it("filters hand-picked statuses as picked", async () => {
    await mountWithSaved(["Forfeit"]);

    expect(lastWhere().status).toEqual({ _in: ["Forfeit"] });
    expect(lastWhere()._and ?? []).not.toContainEqual(DECIDED_RESULTS);
  });
});
