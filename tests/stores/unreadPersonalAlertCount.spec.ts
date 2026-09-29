import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { useAuthStore } from "~/stores/AuthStore";
import { useNotificationStore } from "~/stores/NotificationStore";

const ME = "76561198000000001";

let observers: Array<{ root: string; observer: any }> = [];

function serve() {
  const client = useApollo().clients!.default;
  vi.spyOn(client, "subscribe").mockImplementation(
    (options: any) =>
      ({
        subscribe(observer: any) {
          observers.push({
            root: options.query.definitions[0].selectionSet.selections[0].name
              .value,
            observer,
          });
          return { unsubscribe() {}, closed: false };
        },
      }) as any,
  );
}

function row(id: string, type: string, role: string, entity_id: string) {
  return {
    id,
    title: type,
    message: "",
    steam_id: role === "user" ? ME : null,
    type,
    role,
    entity_id,
    is_read: false,
    deletable: true,
    created_at: "2026-09-28T12:00:00Z",
    actions: null,
  };
}

afterEach(async () => {
  useAuthStore().me = undefined;
  await flushPromises();
  observers = [];
  vi.restoreAllMocks();
});

describe("NotificationStore unreadPersonalAlertCount", () => {
  it("counts an invite once and leaves out chat and staff rows", async () => {
    serve();
    const store = useNotificationStore();
    useAuthStore().me = { steam_id: ME } as any;
    await flushPromises();

    const feed = observers.find((entry) => entry.root === "notifications");
    expect(feed, "notifications subscription").toBeDefined();
    feed!.observer.next({
      data: {
        notifications: [
          row("invite", "TeamInvite", "user", "team-1"),
          row("chat", "ChatMessage", "user", "lobby-1"),
          row("node", "GameNodeStatus", "administrator", "node-1"),
        ],
      },
    });
    store.team_invites = [{ id: "team-invite-1" }];
    await flushPromises();

    expect(store.unreadPersonalAlertCount).toBe(1);
  });
});
