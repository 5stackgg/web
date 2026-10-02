import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import MatchActions from "~/components/match/MatchActions.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

type Opened = { query: string; unsubscribe: ReturnType<typeof vi.fn> };

let opened: Opened[];
let wrapper: Awaited<ReturnType<typeof mountSuspended>> | undefined;

const renderJobSubs = () =>
  opened.filter(({ query }) => query.includes("clip_render_jobs"));

function match(id = "m-1") {
  return {
    id,
    status: "Live",
    is_in_lineup: false,
    is_organizer: false,
    is_server_online: true,
    match_maps: [{ id: `${id}-map-1` }, { id: `${id}-map-2` }],
    streams: [],
  };
}

async function mountActions() {
  const mounted = await mountSuspended(MatchActions, {
    props: { match: match() },
    global: { mixins: (useNuxtApp().vueApp as any)._context.mixins },
  });
  await flushPromises();
  return mounted;
}

function signIn(role = e_player_roles_enum.user) {
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;
}

function signOut() {
  useAuthStore().me = undefined;
}

beforeEach(() => {
  opened = [];
  vi.spyOn(
    (useNuxtApp() as any).$apollo.defaultClient,
    "subscribe",
  ).mockImplementation(({ query }: any) => ({
    subscribe: () => {
      const entry = { query: print(query), unsubscribe: vi.fn() };
      opened.push(entry);
      return entry;
    },
  }));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  signOut();
  vi.restoreAllMocks();
});

describe("MatchActions clip render summary subscription", () => {
  it("never subscribes to clip_render_jobs for a guest", async () => {
    signOut();
    wrapper = await mountActions();

    expect(renderJobSubs()).toHaveLength(0);
  });

  it("subscribes for a signed-in player", async () => {
    signIn();
    wrapper = await mountActions();

    expect(renderJobSubs()).toHaveLength(1);
    expect(renderJobSubs()[0].query).toContain("m-1-map-1");
  });

  it("starts when a guest signs in on the page and stops when they sign out", async () => {
    signOut();
    wrapper = await mountActions();
    expect(renderJobSubs()).toHaveLength(0);

    signIn();
    await flushPromises();
    expect(renderJobSubs()).toHaveLength(1);

    signIn(e_player_roles_enum.moderator);
    await flushPromises();
    expect(renderJobSubs()).toHaveLength(1);
    expect(renderJobSubs()[0].unsubscribe).not.toHaveBeenCalled();

    signOut();
    await flushPromises();
    expect(renderJobSubs()[0].unsubscribe).toHaveBeenCalledTimes(1);
    expect((wrapper.vm as any).renderSummary).toEqual([]);
  });

  it("moves the subscription to the new match", async () => {
    signIn();
    wrapper = await mountActions();

    await wrapper.setProps({ match: match("m-2") });
    await flushPromises();

    expect(renderJobSubs()).toHaveLength(2);
    expect(renderJobSubs()[0].unsubscribe).toHaveBeenCalledTimes(1);
    expect(renderJobSubs()[1].query).toContain("m-2-map-1");
  });
});
