import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { useGlobalSearch } from "~/composables/useGlobalSearch";
import { useAuthStore } from "~/stores/AuthStore";

mockNuxtImport("useCurrentLeagueSeason", () => () => ({
  currentSeason: ref(null),
  currentSeasonTo: ref("/league"),
}));

async function searchAs(role: string) {
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;
  let search!: ReturnType<typeof useGlobalSearch>["search"];
  await mountSuspended(
    defineComponent({
      setup() {
        ({ search } = useGlobalSearch());
        return () => h("div");
      },
    }),
  );
  return search;
}

const ids = (sections: { id: string }[]) => sections.map(({ id }) => id);

afterEach(() => {
  useAuthStore().me = undefined;
});

describe("useGlobalSearch", () => {
  it("finds a page by its name and by its nav group", async () => {
    const search = await searchAs("administrator");
    expect(ids(search("leaderboard").sections)).toContain("leaderboard");
    expect(ids(search("bans").sections)).toContain("bans");
    expect(ids(search("servers").sections)).toEqual(
      expect.arrayContaining([
        "dedicated-servers",
        "game-server-nodes",
        "gpu-nodes",
      ]),
    );
  });

  it("finds Practice Servers for a moderator and not for a player", async () => {
    expect(
      ids((await searchAs("moderator"))("practice servers").sections),
    ).toContain("practice-servers");
    expect(
      ids((await searchAs("user"))("practice servers").sections),
    ).not.toContain("practice-servers");
  });

  it("keeps admin pages and application settings from players", async () => {
    const search = await searchAs("user");
    expect(search("game server nodes").sections).toEqual([]);
    expect(search("veto pick timer").application).toEqual([]);
    expect(search("noise suppression").account).toContainEqual(
      expect.objectContaining({
        path: "/settings/voice",
        label: "Noise Suppression",
      }),
    );
  });

  it("finds application settings for administrators, with where to reveal them", async () => {
    const search = await searchAs("administrator");
    expect(search("veto pick timer").application[0]).toMatchObject({
      path: "/settings/application/matchmaking",
      label: "Veto pick timer",
      page: "Matchmaking",
      hit: { section: "matchmaking", label: "Veto pick timer" },
    });
  });

  it("offers a create page only to roles that can open it", async () => {
    expect(ids((await searchAs("user"))("create").sections)).not.toContain(
      "matches-create",
    );
    expect(
      ids((await searchAs("match_organizer"))("create").sections),
    ).toContain("matches-create");
  });
});
