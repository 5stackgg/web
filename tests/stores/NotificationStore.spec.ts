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

function row(id: string, type: string, created_at: string) {
  return {
    id,
    title: type,
    message: "",
    steam_id: ME,
    type,
    role: "user",
    entity_id: ME,
    is_read: false,
    deletable: true,
    created_at,
    actions: null,
  };
}

afterEach(async () => {
  useAuthStore().me = undefined;
  await flushPromises();
  observers = [];
  vi.restoreAllMocks();
});

describe("NotificationStore stacking", () => {
  it("keeps a warning out of the player's name-change stack", async () => {
    serve();
    const store = useNotificationStore();
    useAuthStore().me = { steam_id: ME } as any;
    await flushPromises();

    const feed = observers.find((entry) => entry.root === "notifications");
    expect(feed, "notifications subscription").toBeDefined();
    feed!.observer.next({
      data: {
        notifications: [
          row("name-2", "NameChangeApproved", "2026-09-28T12:00:00Z"),
          row("warning", "PlayerWarning", "2026-09-27T12:00:00Z"),
          row("name-1", "NameChangeDenied", "2026-09-26T12:00:00Z"),
        ],
      },
    });
    await flushPromises();

    expect(store.stackedNotifications).toContainEqual({
      kind: "single",
      notification: expect.objectContaining({ id: "warning" }),
    });
  });

  it("stacks banned-teammate notices about different players together", async () => {
    serve();
    const store = useNotificationStore();
    useAuthStore().me = { steam_id: ME } as any;
    await flushPromises();

    const banned = (id: string, entityId: string, created_at: string) => ({
      ...row(id, "TeammateBanned", created_at),
      entity_id: entityId,
    });

    const feed = observers.find((entry) => entry.root === "notifications");
    feed!.observer.next({
      data: {
        notifications: [
          banned("ban-2", "76561198000000003", "2026-09-28T12:00:00Z"),
          banned("ban-1", "76561198000000002", "2026-09-27T12:00:00Z"),
        ],
      },
    });
    await flushPromises();

    expect(store.stackedNotifications).toEqual([
      expect.objectContaining({
        kind: "stack",
        notifications: [
          expect.objectContaining({ id: "ban-2" }),
          expect.objectContaining({ id: "ban-1" }),
        ],
      }),
    ]);
  });
});

describe("NotificationStore tournament team invites", () => {
  it("asks for what an invite needs to link its tournament and name a team-backed entry", async () => {
    const documents: Record<string, any> = {};
    const client = useApollo().clients!.default;
    vi.spyOn(client, "subscribe").mockImplementation((options: any) => {
      const root = options.query.definitions[0].selectionSet.selections[0];
      documents[root.name.value] = root;
      return {
        subscribe() {
          return { unsubscribe() {}, closed: false };
        },
      } as any;
    });
    useNotificationStore();
    useAuthStore().me = { steam_id: ME } as any;
    await flushPromises();

    const fields = (node: any) =>
      Object.fromEntries(
        node.selectionSet.selections.map((field: any) => [
          field.name.value,
          field,
        ]),
      );
    const invite = documents.tournament_team_invites;
    expect(invite, "tournament_team_invites subscription").toBeDefined();
    const team = fields(fields(invite).team);

    expect(Object.keys(team)).toEqual(
      expect.arrayContaining(["team_id", "team", "tournament"]),
    );
    expect(Object.keys(fields(team.team))).toContain("name");
    expect(Object.keys(fields(team.tournament))).toEqual(
      expect.arrayContaining(["id", "name"]),
    );
  });
});
