import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import {
  mountSuspended,
  registerEndpoint,
} from "@nuxt/test-utils/runtime";
import { readBody } from "h3";
import AwardComposer from "~/components/award/AwardComposer.vue";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({ client: { query, mutate: vi.fn() } }),
}));

const me = {
  steam_id: "76561198000000042",
  name: "Granting Admin",
  avatar_url: null,
  country: null,
  role: "administrator",
  is_banned: false,
  is_muted: false,
  is_gagged: false,
  elo: null,
};

const award = {
  id: "award-1",
  name: "Clutch King",
  description: null,
  tier: "special",
  allow_multiple: false,
  image_url: null,
  tournament_id: null,
  event_id: null,
  season_id: null,
  league_season_id: null,
};

let mounted: { unmount: () => void } | null = null;

const searchBodies: Array<{ query?: string; exclude?: string[] }> = [];

registerEndpoint("/api/players-search", {
  method: "POST",
  handler: async (event: any) => {
    const body = await readBody(event);
    searchBodies.push(body);
    const excluded = (body.exclude ?? []).map(String);
    const hits = excluded.includes(me.steam_id) ? [] : [{ document: me }];
    return { found: hits.length, hits };
  },
});

async function openGrantPicker() {
  const wrapper = await mountSuspended(AwardComposer, {
    props: { open: true, grant: true, awardId: award.id, award },
    attachTo: document.body,
  });
  mounted = wrapper;
  await flushPromises();

  const trigger = [...document.body.querySelectorAll("button")].find(
    (button) => button.textContent?.includes("Select player"),
  );
  expect(trigger).toBeDefined();
  trigger!.click();
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flushPromises();
  expect(document.body.querySelector('input[type="search"]')).not.toBeNull();

  return wrapper;
}

function offeredRows(): string[] {
  return [...document.body.querySelectorAll(".divide-y > div")].map(
    (row) => row.textContent ?? "",
  );
}

describe("AwardComposer grant recipient picker", () => {
  beforeEach(() => {
    query.mockResolvedValue({ data: { awards: [award] } });
    useAuthStore().me = me as any;
    searchBodies.length = 0;
  });

  afterEach(() => {
    mounted?.unmount();
    mounted = null;
    useAuthStore().me = undefined;
    useSearchStore().onlineOnly = true;
  });

  it("offers the granting user as a recipient under the online filter", async () => {
    useSearchStore().onlineOnly = true;
    await openGrantPicker();

    expect(offeredRows().some((row) => row.includes(me.name))).toBe(true);
  });

  it("does not exclude the granting user from the player search", async () => {
    useSearchStore().onlineOnly = false;
    await openGrantPicker();

    expect(searchBodies.length).toBeGreaterThan(0);
    for (const body of searchBodies) {
      expect(body.exclude ?? []).not.toContain(me.steam_id);
    }
    expect(offeredRows().some((row) => row.includes(me.name))).toBe(true);
  });
});
