import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import {
  chatRoomQuiet,
  chatRoomRings,
  muteChatRoom,
  resetChatRoomSettings,
  setChatRoomNotify,
  syncChatRoomSettings,
  unmuteChatRoom,
  useChatRoomSettings,
} from "~/composables/useChatRoomSettings";
import { fakeRoomSettingsClient, room } from "../helpers/fakeRoomSettings";

const fake = vi.hoisted(() => ({ api: null as any }));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => fake.api.client,
}));

// Asked fresh each time: the real one remembers its first answer for the page.
vi.mock("~/utilities/schemaHasType", () => ({
  schemaHasType: async (client: any, name: string) =>
    !!(await client.query({ variables: { name } })).data?.__type,
  schemaHasField: async (client: any, type: string, field: string) => {
    const { data } = await client.query({ variables: { name: type } });
    return (data?.__type?.fields ?? []).some(
      ({ name }: { name: string }) => name === field,
    );
  },
}));

const ME = "76561198000000001";
const NOW = Date.UTC(2026, 9, 15, 12, 0);
const minutesFromNow = (minutes: number) =>
  new Date(NOW + minutes * 60_000).toISOString();

beforeEach(() => {
  fake.api = fakeRoomSettingsClient();
  useAuthStore().me = { steam_id: ME, role: "user" } as any;
});

afterEach(() => {
  resetChatRoomSettings();
  useAuthStore().me = undefined;
  vi.useRealTimers();
});

async function signIn() {
  await syncChatRoomSettings(ME);
  await flushPromises();
}

describe("useChatRoomSettings", () => {
  it("follows the player's rooms as the api hands them over", async () => {
    await signIn();

    expect(useChatRoomSettings().supported.value).toBe(true);
    expect(chatRoomQuiet("tournament", "t-1").muted).toBe(false);

    fake.api.rooms([room("chat:tournament:t-1", { muted: true })]);

    expect(chatRoomQuiet("tournament", "t-1")).toEqual({
      muted: true,
      mutedUntil: null,
      notify: "all",
    });
    expect(chatRoomRings("tournament", "t-1", false)).toBe(false);
    expect(chatRoomRings("tournament", "t-1", true)).toBe(true);
    expect(chatRoomQuiet("tournament", "t-2").muted).toBe(false);
  });

  it("reads a side's team room by its match room", async () => {
    await signIn();

    fake.api.rooms([room("chat:match:m-1", { notify: "nothing" })]);

    expect(chatRoomRings("match_team", "m-1:l-2", true)).toBe(false);
  });

  it("lets a timed mute run out on its own, with nothing new from the api", async () => {
    vi.useFakeTimers({ now: NOW });
    await signIn();

    fake.api.rooms([
      room("chat:team:t-1", { muted: true, muted_until: minutesFromNow(15) }),
    ]);
    await flushPromises();

    expect(chatRoomQuiet("team", "t-1").muted).toBe(true);

    await vi.advanceTimersByTimeAsync(15 * 60_000 + 100);

    expect(chatRoomQuiet("team", "t-1").muted).toBe(false);
    expect(chatRoomRings("team", "t-1", false)).toBe(true);
  });

  it("asks the api for a length, which ends by the api's clock", async () => {
    vi.useFakeTimers({ now: NOW });
    await signIn();

    await muteChatRoom("tournament", "t-1", 60);

    expect(fake.api.writes()).toEqual([
      { thread: "chat:tournament:t-1", muted: true, mute_minutes: 60 },
    ]);
    expect(chatRoomQuiet("tournament", "t-1")).toEqual({
      muted: true,
      mutedUntil: minutesFromNow(60),
      notify: "all",
    });
  });

  it("mutes until unmuted with no end, and unmutes keeping the room's level", async () => {
    await signIn();
    fake.api.rooms([room("chat:team:t-1", { notify: "mentions" })]);

    await muteChatRoom("team", "t-1", null);
    await unmuteChatRoom("team", "t-1");

    expect(fake.api.writes()).toEqual([
      { thread: "chat:team:t-1", muted: true, mute_minutes: null },
      { thread: "chat:team:t-1", muted: false, mute_minutes: null },
    ]);
    expect(chatRoomQuiet("team", "t-1").notify).toBe("mentions");
  });

  it("sets what the room notifies about, sending nothing of its mute", async () => {
    vi.useFakeTimers({ now: NOW });
    await signIn();
    fake.api.rooms([
      room("chat:team:t-1", { muted: true, muted_until: minutesFromNow(30) }),
    ]);

    await setChatRoomNotify("team", "t-1", "nothing");

    expect(fake.api.writes()).toEqual([
      { thread: "chat:team:t-1", notify: "nothing" },
    ]);
    expect(chatRoomQuiet("team", "t-1").muted).toBe(true);
  });

  it("puts the room back as it was when the api refuses the write", async () => {
    await signIn();
    fake.api.state.mutate.mockRejectedValueOnce(new Error("refused"));

    await expect(muteChatRoom("tournament", "t-1", 15)).rejects.toThrow(
      "refused",
    );

    expect(chatRoomQuiet("tournament", "t-1").muted).toBe(false);
  });

  it("offers nothing against an api without the table", async () => {
    fake.api.state.supported = false;
    await signIn();

    expect(useChatRoomSettings().supported.value).toBe(false);
    expect(fake.api.state.subscriptions).toBe(0);
  });

  it("offers nothing against an api that takes an end time, not a length", async () => {
    fake.api.state.muteLength = false;
    await signIn();

    expect(useChatRoomSettings().supported.value).toBe(false);
    expect(fake.api.state.subscriptions).toBe(0);
  });

  it("forgets every room on sign-out", async () => {
    await signIn();
    fake.api.rooms([room("chat:tournament:t-1", { muted: true })]);

    resetChatRoomSettings();

    expect(chatRoomQuiet("tournament", "t-1").muted).toBe(false);
    expect(useChatRoomSettings().supported.value).toBe(false);
  });
});
