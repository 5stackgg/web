import { reactive } from "vue";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import getGraphqlClient from "~/graphql/getGraphqlClient";

export type FriendRelationship = "none" | "friend" | "incoming" | "outgoing";
export type FriendAction =
  | "add"
  | "accept"
  | "decline"
  | "cancel"
  | "remove"
  | "invite";

// Module-level so every row shares the same in-flight map — the friends
// subscription drives the relationship, this tracks which action is mid-flight.
const inFlight = reactive<Record<string, FriendAction | undefined>>({});

function sid(steam_id: string | number | bigint) {
  return String(steam_id);
}

export function useFriendActions() {
  const matchmaking = useMatchmakingStore();

  function relationship(steam_id: string | number): FriendRelationship {
    const target = sid(steam_id);
    const entry = (matchmaking.friends as any[])?.find(
      (f) => sid(f.steam_id) === target,
    );
    if (!entry) return "none";
    if (entry.status !== "Pending") return "friend";
    return sid(entry.invited_by_steam_id) === sid(useAuthStore().me?.steam_id)
      ? "outgoing"
      : "incoming";
  }

  function pendingAction(steam_id: string | number): FriendAction | undefined {
    return inFlight[sid(steam_id)];
  }

  function isBusy(steam_id: string | number) {
    return inFlight[sid(steam_id)] != null;
  }

  async function run(
    steam_id: string | number,
    action: FriendAction,
    fn: () => Promise<unknown>,
  ) {
    const key = sid(steam_id);
    inFlight[key] = action;
    try {
      await fn();
    } finally {
      inFlight[key] = undefined;
    }
  }

  function addFriend(steam_id: string | number) {
    return run(steam_id, "add", () =>
      getGraphqlClient().mutate({
        mutation: typedGql("mutation")({
          insert_my_friends_one: [
            { object: { steam_id: sid(steam_id) } },
            { steam_id: true },
          ],
        }),
      }),
    );
  }

  function acceptFriend(steam_id: string | number) {
    return run(steam_id, "accept", () =>
      getGraphqlClient().mutate({
        mutation: typedGql("mutation")({
          update_my_friends: [
            { where: { steam_id: { _eq: sid(steam_id) } } },
            { __typename: true },
          ],
        }),
      }),
    );
  }

  function deleteFriend(steam_id: string | number, action: FriendAction) {
    return run(steam_id, action, () =>
      getGraphqlClient().mutate({
        mutation: typedGql("mutation")({
          delete_my_friends: [
            { where: { steam_id: { _eq: sid(steam_id) } } },
            { __typename: true },
          ],
        }),
      }),
    );
  }

  // Incoming decline, outgoing cancel and friend removal all delete the row —
  // the distinct action keys just let the UI label the in-flight spinner.
  const declineFriend = (steam_id: string | number) =>
    deleteFriend(steam_id, "decline");
  const cancelRequest = (steam_id: string | number) =>
    deleteFriend(steam_id, "cancel");
  const removeFriend = (steam_id: string | number) =>
    deleteFriend(steam_id, "remove");

  function inviteToLobby(steam_id: string | number) {
    return run(steam_id, "invite", () =>
      matchmaking.inviteToLobby(sid(steam_id)),
    );
  }

  return {
    relationship,
    pendingAction,
    isBusy,
    addFriend,
    acceptFriend,
    declineFriend,
    cancelRequest,
    removeFriend,
    inviteToLobby,
  };
}
