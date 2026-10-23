import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { print } from "graphql";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

type Subscription = {
  client: string;
  document: string;
  next: (result: any) => void;
  closed: boolean;
};

let subscriptions: Array<Subscription> = [];

function watch(name: "default" | "public") {
  const client = (useApollo().clients as Record<string, any>)[name];
  vi.spyOn(client, "subscribe").mockImplementation(
    (options: any) =>
      ({
        subscribe({ next }: { next: (result: any) => void }) {
          const subscription = {
            client: name,
            document: print(options.query),
            next,
            closed: false,
          };
          subscriptions.push(subscription);
          return {
            unsubscribe() {
              subscription.closed = true;
            },
            closed: false,
          };
        },
      }) as any,
  );
}

beforeEach(() => {
  watch("default");
  watch("public");
});

afterEach(() => {
  useDraftGamesStore().unsubscribeFromOpenDraftGames();
  subscriptions = [];
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

function signIn() {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    role: e_player_roles_enum.user,
  } as any;
}

// Signing in starts the app's own subscriptions too; these are the open lists.
const openLists = () =>
  subscriptions.filter((subscription) =>
    subscription.document.includes("draft_games(where: {status: {_eq: Open}"),
  );
const on = (client: string) =>
  openLists().filter((subscription) => subscription.client === client);
const where = (document: string) =>
  document.match(/draft_games\(where: (\{.*\})\)/)?.[1];

// Open drafts are the same for every viewer, so they are read as a guest and
// everyone on the Play page shares one Hasura poll. Only the drafts a viewer
// sees through friends, invites or hosting are read with their own session.
describe("the Play page's open draft rooms", () => {
  it("reads Open drafts as a guest and the rest with the viewer's session", async () => {
    signIn();
    await useDraftGamesStore().subscribeToOpenDraftGames();

    const [shared] = on("public");
    const [mine] = on("default");
    expect(on("public")).toHaveLength(1);
    expect(on("default")).toHaveLength(1);
    expect(where(shared.document)).toBe(
      "{status: {_eq: Open}, access: {_eq: Open}}",
    );
    expect(where(mine.document)).toBe(
      "{status: {_eq: Open}, access: {_neq: Open}}",
    );
    expect(shared.document).not.toMatch(/\binvite_code\b/);
    expect(mine.document).toMatch(/\binvite_code\b/);
  });

  it("lists both together, once each", async () => {
    signIn();
    const store = useDraftGamesStore();
    await store.subscribeToOpenDraftGames();

    on("public")[0].next({
      data: { draft_games: [{ id: "open-1" }, { id: "open-2" }] },
    });
    on("default")[0].next({
      data: { draft_games: [{ id: "friends-1" }, { id: "open-2" }] },
    });

    expect(store.openDraftGames.map((game: any) => game.id)).toEqual([
      "open-1",
      "open-2",
      "friends-1",
    ]);
  });

  it("reads only the shared list for a signed-out visitor", async () => {
    const store = useDraftGamesStore();
    await store.subscribeToOpenDraftGames();

    expect(on("public")).toHaveLength(1);
    expect(on("default")).toHaveLength(0);

    on("public")[0].next({ data: { draft_games: [{ id: "open-1" }] } });
    expect(store.openDraftGames.map((game: any) => game.id)).toEqual([
      "open-1",
    ]);
  });

  it("stops both when the page is left", async () => {
    signIn();
    const store = useDraftGamesStore();
    await store.subscribeToOpenDraftGames();
    on("public")[0].next({ data: { draft_games: [{ id: "open-1" }] } });

    store.unsubscribeFromOpenDraftGames();

    expect(openLists()).toHaveLength(2);
    expect(openLists().every((subscription) => subscription.closed)).toBe(true);
    expect(store.openDraftGames).toEqual([]);
  });
});
