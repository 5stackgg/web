import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { print } from "graphql";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import { useChatTabs } from "~/composables/useChatTabs";
import { useChatTabSetup } from "~/composables/useChatTabSetup";
import TournamentChatEndedStamp from "~/components/chat/TournamentChatEndedStamp.vue";
import { e_player_roles_enum } from "~/generated/zeus";

vi.mock("~/web-sockets/Socket", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/web-sockets/Socket")>()),
  default: {
    listen: () => ({ stop() {} }),
    joinLobby: () => ({ messages: [], on() {}, leave() {} }),
    markLobbyRead() {},
  },
}));

const NOW = new Date("2026-10-02T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const tournament = (
  id: string,
  status: string,
  finished_at: string | null = null,
) => ({
  id,
  name: id,
  status,
  finished_at,
  joined_tournament: true,
  is_organizer: false,
});

let subscriptions: Array<{ options: any; observer: any }> = [];
let unmount: (() => void) | null = null;

function serve() {
  const client = useApollo().clients!.default;
  vi.spyOn(client, "subscribe").mockImplementation(
    (options: any) =>
      ({
        subscribe(observer: any) {
          subscriptions.push({ options, observer });
          return { unsubscribe() {}, closed: false };
        },
      }) as any,
  );
}

async function deliver(rows: unknown[]) {
  await useMatchLobbyStore().subscribeToChatTournaments();
  subscriptions.at(-1)!.observer.next({ data: { tournaments: rows } });
  await nextTick();
}

const ids = () =>
  (useMatchLobbyStore().chatTournaments as Array<{ id: string }>).map(
    ({ id }) => id,
  );

beforeEach(() => {
  vi.useFakeTimers({
    now: NOW,
    toFake: ["Date", "setInterval", "clearInterval"],
  });
  serve();
});

afterEach(() => {
  unmount?.();
  unmount = null;
  subscriptions = [];
  useMatchLobbyStore().chatTournaments = [];
  useChatTabs().clearAll();
  useAuthStore().me = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("chat tournaments", () => {
  it("asks for tournaments that finished in the last seven days", async () => {
    await useMatchLobbyStore().subscribeToChatTournaments();

    const { options } = subscriptions.at(-1)!;
    const query = print(options.query);

    expect(query).toContain("finished_at");
    expect(query).toMatch(/Finished/);
    expect(Object.values(options.variables ?? {})).toContain(ago(7 * DAY));
  });

  it("keeps a finished tournament for seven days and no longer", async () => {
    await deliver([
      tournament("live", "Live"),
      tournament("yesterday", "Finished", ago(DAY)),
      tournament("last-week", "Finished", ago(8 * DAY)),
      tournament("unstamped", "Finished", null),
    ]);

    expect(ids()).toEqual(["live", "yesterday"]);
  });

  it("drops a finished tournament when its week runs out, with no new result", async () => {
    await deliver([
      tournament("live", "Live"),
      tournament("yesterday", "Finished", ago(DAY)),
    ]);

    vi.advanceTimersByTime(6 * DAY - HOUR);
    expect(ids()).toEqual(["live", "yesterday"]);

    vi.advanceTimersByTime(2 * HOUR);
    expect(ids()).toEqual(["live"]);
  });

  it("keeps the tab open while the tournament's chat is, then closes it", async () => {
    useAuthStore().me = {
      steam_id: "76561198000000001",
      role: e_player_roles_enum.user,
    } as any;
    vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({ threads: [] }));

    const wrapper = await mountSuspended(
      defineComponent({
        setup() {
          useChatTabSetup();
          return () => h("div");
        },
      }),
    );
    unmount = () => wrapper.unmount();
    await flushPromises();

    await deliver([tournament("cup", "Live")]);
    expect(useChatTabs().tabs.value.map(({ id }) => id)).toContain(
      "tournament:cup",
    );

    subscriptions.at(-1)!.observer.next({
      data: { tournaments: [tournament("cup", "Finished", ago(0))] },
    });
    await nextTick();
    expect(useChatTabs().tabs.value.map(({ id }) => id)).toContain(
      "tournament:cup",
    );

    vi.advanceTimersByTime(7 * DAY + HOUR);
    await nextTick();
    expect(useChatTabs().tabs.value.map(({ id }) => id)).not.toContain(
      "tournament:cup",
    );
  });
});

describe("the ended stamp", () => {
  const stamp = async (finishedAt: string) => {
    const wrapper = await mountSuspended(TournamentChatEndedStamp, {
      props: { finishedAt },
    });
    unmount = () => wrapper.unmount();
    await flushPromises();
    return wrapper;
  };

  it("counts down in days", async () => {
    expect((await stamp(ago(DAY))).text()).toBe("Ended · closes in 6d");
  });

  it("counts the last day down in hours", async () => {
    expect((await stamp(ago(6 * DAY + 13 * HOUR))).text()).toBe(
      "Ended · closes in 11h",
    );
  });

  it("says under an hour rather than rounding up to one", async () => {
    expect((await stamp(ago(7 * DAY - 10 * 60 * 1000))).text()).toBe(
      "Ended · closes in <1h",
    );
  });

  it("counts the last full hour as one", async () => {
    expect((await stamp(ago(7 * DAY - 90 * 60 * 1000))).text()).toBe(
      "Ended · closes in 1h",
    );
  });

  it("follows the clock", async () => {
    const wrapper = await stamp(ago(DAY));

    vi.advanceTimersByTime(2 * DAY);
    await nextTick();

    expect(wrapper.text()).toBe("Ended · closes in 4d");
  });

  it("explains itself", async () => {
    const wrapper = await stamp(ago(DAY));

    expect(wrapper.find("[aria-label]").attributes("aria-label")).toContain(
      "This tournament has ended. Its chat stays open for 7 days.",
    );
  });
});
