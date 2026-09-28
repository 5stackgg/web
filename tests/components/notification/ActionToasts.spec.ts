import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ActionToasts from "~/components/notification/ActionToasts.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";
import { useNotificationStore } from "~/stores/NotificationStore";
import { useCallInvites } from "~/composables/useVoiceAnnouncements";

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn().mockResolvedValue({ data: {} }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const ME = "76561198000000001";
const STORAGE_KEY = `5stack:dismissed-action-toasts:${ME}`;

const pendingFriend = (steamId: string, name: string) => ({
  steam_id: steamId,
  name,
  status: "Pending",
  invited_by_steam_id: steamId,
});

const stored = (): string[] =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

let unmount: (() => void) | undefined;

async function mountToasts() {
  const wrapper = await mountSuspended(ActionToasts, {
    global: { stubs: { VoiceRosterPreview: true } },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountToasts>>;

async function dismissToast(wrapper: Wrapper, text: string) {
  const card = wrapper
    .findAll(".toast-card")
    .find((candidate) => candidate.text().includes(text));
  expect(card, `no toast showing "${text}"`).toBeDefined();
  await card!.find(".toast-dismiss").trigger("click");
  await flushPromises();
}

beforeEach(async () => {
  localStorage.clear();
  useAuthStore().me = { steam_id: ME, current_lobby_id: null } as any;
  await flushPromises();

  const matchmaking = useMatchmakingStore();
  matchmaking.friends = [] as any;
  matchmaking.lobbies = [] as any;
  matchmaking.friendsLoaded = false;
  matchmaking.lobbiesLoaded = false;

  const notifications = useNotificationStore();
  notifications.draft_invites = [];
  notifications.draftInvitesLoaded = false;
  notifications.team_invites = [];

  useCallInvites().invites.value = [];
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  localStorage.clear();
});

describe("ActionToasts dismissals", () => {
  it("keeps a dismissed toast hidden after a remount", async () => {
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000002", "Dana")] as any;
    matchmaking.friendsLoaded = true;

    const wrapper = await mountToasts();
    expect(wrapper.text()).toContain("Dana");

    await dismissToast(wrapper, "Dana");
    expect(wrapper.text()).not.toContain("Dana");
    expect(stored()).toEqual(["friend:76561198000000002"]);

    unmount?.();
    const remounted = await mountToasts();
    expect(remounted.text()).not.toContain("Dana");
  });

  it("never stores a call invite dismissal", async () => {
    useCallInvites().invites.value = [
      {
        id: "voice:channel-1",
        channelId: "channel-1",
        channelLabel: "Lobby",
        channelKind: "lobby",
        who: "Rory",
        video: false,
      },
    ];
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000002", "Dana")] as any;
    matchmaking.friendsLoaded = true;

    const wrapper = await mountToasts();
    await dismissToast(wrapper, "Rory");
    await dismissToast(wrapper, "Dana");

    expect(wrapper.text()).not.toContain("Rory");
    expect(stored()).toEqual(["friend:76561198000000002"]);

    unmount?.();
    const remounted = await mountToasts();
    expect(remounted.text()).toContain("Rory");
  });

  it("does not prune before a source has loaded", async () => {
    const seeded = [
      "friend:76561198000000003",
      "lobby:lobby-1",
      "draft:draft-1",
      "team:invite-1",
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));

    await mountToasts();
    expect(stored()).toEqual(seeded);

    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000005", "Sam")] as any;
    await flushPromises();
    expect(stored()).toEqual(seeded);

    matchmaking.lobbiesLoaded = true;
    await flushPromises();
    expect(stored()).toEqual([
      "friend:76561198000000003",
      "draft:draft-1",
      "team:invite-1",
    ]);
  });

  it("does not show a stored dismissal while its source is still loading", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(["friend:76561198000000003"]),
    );
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000003", "Kai")] as any;

    const wrapper = await mountToasts();
    expect(wrapper.text()).not.toContain("Kai");
  });

  it("prunes only the loaded sources' dismissals whose toast is gone", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        "friend:76561198000000003",
        "friend:76561198000000004",
        "lobby:lobby-1",
        "team:invite-1",
      ]),
    );
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000004", "Lee")] as any;

    const wrapper = await mountToasts();
    matchmaking.friendsLoaded = true;
    await flushPromises();

    expect(stored()).toEqual([
      "friend:76561198000000004",
      "lobby:lobby-1",
      "team:invite-1",
    ]);
    expect(wrapper.text()).not.toContain("Lee");

    matchmaking.friends = [pendingFriend("76561198000000003", "Kai")] as any;
    await flushPromises();
    expect(wrapper.text()).toContain("Kai");
    expect(stored()).toEqual(["lobby:lobby-1", "team:invite-1"]);
  });

  it("prunes a draft dismissal once draft invites load", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["draft:draft-1"]));

    await mountToasts();
    useNotificationStore().draftInvitesLoaded = true;
    await flushPromises();

    expect(stored()).toEqual([]);
  });

  it("keeps only the newest 200 stored dismissals", async () => {
    const seeded = Array.from(
      { length: 200 },
      (_, index) => `team:invite-${index}`,
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000002", "Dana")] as any;
    matchmaking.friendsLoaded = true;

    const wrapper = await mountToasts();
    await dismissToast(wrapper, "Dana");

    const ids = stored();
    expect(ids).toHaveLength(200);
    expect(ids[0]).toBe("team:invite-1");
    expect(ids.at(-1)).toBe("friend:76561198000000002");
  });

  it("shows toasts when storage is unavailable", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const matchmaking = useMatchmakingStore();
    matchmaking.friends = [pendingFriend("76561198000000002", "Dana")] as any;
    matchmaking.friendsLoaded = true;

    try {
      const wrapper = await mountToasts();
      expect(wrapper.text()).toContain("Dana");
      await dismissToast(wrapper, "Dana");
      expect(wrapper.text()).not.toContain("Dana");
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
