import { afterEach, describe, expect, it } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { readBody } from "h3";
import PlayerSearch from "~/components/PlayerSearch.vue";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useAuthStore } from "~/stores/AuthStore";
import { useSearchStore } from "~/stores/SearchStore";

const ALPHA = "76561198000000801";
const BRAVO = "76561198000000802";

registerEndpoint("/api/players-search", {
  method: "POST",
  handler: async (event: any) => {
    const body = await readBody(event);
    const steamId = body.query === "alpha" ? ALPHA : BRAVO;
    return {
      hits: [{ document: { steam_id: steamId, name: body.query } }],
      found: 1,
    };
  },
});

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
});

async function mountSearch() {
  useAuthStore().me = {
    steam_id: "76561198000000800",
    name: "me",
    role: "user",
  } as any;
  useSearchStore().onlineOnly = false;
  const checks: Array<{ requestId: string; steamIds: Array<string> }> = [];
  useMatchmakingStore().sendOnlineCheck = (
    requestId: string,
    steamIds: Array<string>,
  ) => {
    checks.push({ requestId, steamIds });
  };

  const wrapper = await mountSuspended(PlayerSearch, {
    props: { label: "Find a player" },
  });
  unmount = () => wrapper.unmount();
  return { vm: wrapper.vm as any, checks };
}

describe("player search results' online status", () => {
  it("asks once which of the results are online and shows it", async () => {
    const { vm, checks } = await mountSearch();

    await vm.searchPlayers("alpha");
    await flushPromises();
    expect(checks.map((check) => check.steamIds)).toEqual([[ALPHA]]);

    useMatchmakingStore().setOnlineCheck({
      requestId: checks[0].requestId,
      online: [ALPHA],
    });
    await flushPromises();

    expect(vm.onlineFor({ steam_id: ALPHA })).toBe(true);
  });

  it("drops an answer for a search that has since been replaced", async () => {
    const { vm, checks } = await mountSearch();

    await vm.searchPlayers("alpha");
    await vm.searchPlayers("bravo");
    await flushPromises();

    useMatchmakingStore().setOnlineCheck({
      requestId: checks[0].requestId,
      online: [ALPHA],
    });
    useMatchmakingStore().setOnlineCheck({
      requestId: checks[1].requestId,
      online: [],
    });
    await flushPromises();

    expect(vm.onlineFor({ steam_id: ALPHA })).toBeUndefined();
    expect(vm.onlineFor({ steam_id: BRAVO })).toBeUndefined();
  });
});
