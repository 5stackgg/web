import { ref } from "vue";
import gql from "graphql-tag";
import { defineStore, acceptHMRUpdate } from "pinia";
import { useSubscriptionManager } from "~/composables/useSubscriptionManager";
import { $, e_draft_game_status_enum, order_by } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateSubscription } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";
import { mapFields } from "~/graphql/mapGraphql";
import { useAuthStore } from "~/stores/AuthStore";

export const useDraftGamesStore = defineStore("draft-games", () => {
  const openDraftGames = ref<Array<any>>([]);
  const currentRoom = ref<any | undefined>(undefined);

  const draftGameFields = {
    id: true,
    host_steam_id: true,
    status: true,
    created_at: true,
    type: true,
    mode: true,
    access: true,
    invite_code: true,
    require_approval: true,
    regions: true,
    capacity: true,
    map_pool_id: true,
    team_1_id: true,
    team_2_id: true,
    inner_squad: true,
    team_1: {
      id: true,
      name: true,
    },
    team_2: {
      id: true,
      name: true,
    },
    captain_selection: true,
    draft_order: true,
    min_elo: true,
    max_elo: true,
    match_id: true,
    current_pick_lineup: true,
    pick_deadline: true,
    expires_at: true,
    host: playerFields,
    map_pool: {
      id: true,
      type: true,
    },
    players: [
      {},
      {
        steam_id: true,
        status: true,
        joined_at: true,
        elo_snapshot: true,
        is_captain: true,
        lineup: true,
        pick_order: true,
        player: playerFields,
      },
    ],
    picks: [
      {
        order_by: [{}, { created_at: order_by.asc }],
      },
      {
        id: true,
        lineup: true,
        auto_picked: true,
        created_at: true,
        captain: playerFields,
        picked: playerFields,
      },
    ],
  };

  const draftRoomFields = {
    ...draftGameFields,
    options: {
      mr: true,
      best_of: true,
      overtime: true,
      knife_round: true,
      coaches: true,
      map_veto: true,
      number_of_substitutes: true,
      map_pool: {
        id: true,
        type: true,
        maps: [{}, mapFields],
      },
    },
  };

  const subscribeToOpenDraftGames = async () => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        draft_games: [
          {
            where: {
              status: {
                _eq: e_draft_game_status_enum.Open,
              },
            },
          },
          draftGameFields,
        ],
      }),
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "draft-games:open",
      subscription.subscribe({
        next: ({ data }) => {
          openDraftGames.value = data.draft_games;
        },
        error: (error: any) => {
          console.error("[draft-games] open subscription:", error);
        },
      }),
    );
  };

  const unsubscribeFromOpenDraftGames = () => {
    const { unsubscribe } = useSubscriptionManager();
    unsubscribe("draft-games:open");
    openDraftGames.value = [];
  };

  const myDraftGame = ref<any | undefined>(undefined);

  const selfInitiatedExitId = ref<string | null>(null);

  const subscribeToMyDraftGame = async (steamId: bigint) => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        draft_games: [
          {
            where: {
              status: {
                _nin: [
                  e_draft_game_status_enum.Completed,
                  e_draft_game_status_enum.Canceled,
                ],
              },
              _or: [
                { host_steam_id: { _eq: steamId } },
                { players: { steam_id: { _eq: steamId } } },
              ],
            },
          },
          {
            id: true,
            type: true,
            mode: true,
            status: true,
            capacity: true,
            match_id: true,
            host_steam_id: true,
            current_pick_lineup: true,
            players: [
              {},
              { steam_id: true, status: true, lineup: true, is_captain: true },
            ],
          },
        ],
      }),
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "draft-games:mine",
      subscription.subscribe({
        next: ({ data }: any) => {
          myDraftGame.value = data?.draft_games?.[0];
        },
      }),
    );
  };

  const subscribeToDraftGame = async (draftGameId: string) => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        draft_games: [
          {
            where: {
              id: {
                _eq: $("id", "uuid!"),
              },
            },
          },
          draftRoomFields,
        ],
      }),
      variables: {
        id: draftGameId,
      },
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "draft-games:room",
      subscription.subscribe({
        next: ({ data }) => {
          currentRoom.value = data.draft_games.at(0) ?? null;
        },
        error: (error: any) => {
          console.error("[draft-games] room subscription:", error);
          currentRoom.value = null;
        },
      }),
    );
  };

  const unsubscribeFromDraftGame = () => {
    const { unsubscribe } = useSubscriptionManager();
    unsubscribe("draft-games:room");
    currentRoom.value = undefined;
  };

  const currentMatch = ref<any | undefined>(undefined);

  const subscribeToMatch = async (matchId: string) => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        matches_by_pk: [
          { id: $("matchId", "uuid!") },
          {
            id: true,
            status: true,
            region: true,
            e_region: { description: true },
            is_captain: true,
            is_organizer: true,
            is_in_lineup: true,
            is_coach: true,
            can_cancel: true,
            can_start: true,
            can_check_in: true,
            can_assign_server: true,
            can_stream_live: true,
            requested_organizer: true,
            server_id: true,
            server_type: true,
            is_server_online: true,
            is_match_server_available: true,
            min_players_per_lineup: true,
            max_players_per_lineup: true,
            lineup_1_id: true,
            lineup_2_id: true,
            winning_lineup_id: true,
            map_veto_type: true,
            map_veto_picking_lineup_id: true,
            region_veto_picking_lineup_id: true,
            region_veto_picks: {
              type: true,
              region: true,
            },
            options: {
              mr: true,
              best_of: true,
              overtime: true,
              knife_round: true,
              region_veto: true,
              map_veto: true,
              regions: true,
              coaches: true,
              check_in_setting: true,
              type: true,
              map_pool: {
                id: true,
                type: true,
                maps: {
                  id: true,
                  name: true,
                  patch: true,
                  poster: true,
                },
              },
            },
            match_maps: [
              { order_by: [{}, { order: order_by.asc }] },
              {
                id: true,
                order: true,
                lineup_1_side: true,
                lineup_2_side: true,
                lineup_1_score: true,
                lineup_2_score: true,
                map: { id: true, name: true, patch: true, poster: true },
                status: true,
                is_current_map: true,
                winning_lineup_id: true,
                demos: [{}, { id: true }],
              },
            ],
            lineup_1: [
              {},
              {
                id: true,
                name: true,
                is_picking_map_veto: true,
                can_pick_map_veto: true,
                is_picking_region_veto: true,
                can_pick_region_veto: true,
                lineup_players: [{}, { steam_id: true, checked_in: true }],
              },
            ],
            lineup_2: [
              {},
              {
                id: true,
                name: true,
                is_picking_map_veto: true,
                can_pick_map_veto: true,
                is_picking_region_veto: true,
                can_pick_region_veto: true,
                lineup_players: [{}, { steam_id: true, checked_in: true }],
              },
            ],
            streams: [
              {},
              {
                id: true,
                match_id: true,
                is_game_streamer: true,
                is_live: true,
                status: true,
                error_message: true,
              },
            ],
          },
        ],
      }),
      variables: {
        matchId,
      },
    });

    const { subscribe } = useSubscriptionManager();
    subscribe(
      "draft-games:match",
      subscription.subscribe({
        next: ({ data }) => {
          currentMatch.value = data.matches_by_pk;
        },
      }),
    );
  };

  const unsubscribeFromMatch = () => {
    const { unsubscribe } = useSubscriptionManager();
    unsubscribe("draft-games:match");
    currentMatch.value = undefined;
  };

  const create = async (settings: Record<string, unknown>) => {
    const { data } = await getGraphqlClient().mutate({
      mutation: gql`
        mutation CreateDraftGame($settings: jsonb!) {
          createDraftGame(settings: $settings) {
            draftGameId
          }
        }
      `,
      variables: { settings },
    });
    return data?.createDraftGame?.draftGameId as string | undefined;
  };

  const update = (draftGameId: string, settings: Record<string, unknown>) =>
    getGraphqlClient().mutate({
      mutation: gql`
        mutation UpdateDraftGame($draftGameId: uuid!, $settings: jsonb!) {
          updateDraftGame(draftGameId: $draftGameId, settings: $settings) {
            success
          }
        }
      `,
      variables: { draftGameId, settings },
    });

  const join = (draftGameId: string, inviteCode?: string) =>
    getGraphqlClient().mutate({
      mutation: gql`
        mutation JoinDraftGame($draftGameId: uuid!, $inviteCode: String) {
          joinDraftGame(draftGameId: $draftGameId, inviteCode: $inviteCode) {
            success
          }
        }
      `,
      variables: { draftGameId, inviteCode },
    });

  const joinParty = (draftGameId: string, inviteCode?: string) =>
    getGraphqlClient().mutate({
      mutation: gql`
        mutation JoinDraftGameAsParty($draftGameId: uuid!, $inviteCode: String) {
          joinDraftGameAsParty(
            draftGameId: $draftGameId
            inviteCode: $inviteCode
          ) {
            success
          }
        }
      `,
      variables: { draftGameId, inviteCode },
    });

  const extend = (draftGameId: string) =>
    getGraphqlClient().mutate({
      mutation: gql`
        mutation ExtendDraftGame($draftGameId: uuid!, $expiresAt: timestamptz!) {
          update_draft_games_by_pk(
            pk_columns: { id: $draftGameId }
            _set: { expires_at: $expiresAt }
          ) {
            id
          }
        }
      `,
      variables: {
        draftGameId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    });

  const start = (draftGameId: string) =>
    getGraphqlClient().mutate({
      mutation: gql`
        mutation StartDraftGame($draftGameId: uuid!) {
          update_draft_games_by_pk(
            pk_columns: { id: $draftGameId }
            _set: { status: Filled }
          ) {
            id
          }
        }
      `,
      variables: { draftGameId },
    });

  const pick = (draftGameId: string, steamId: string) =>
    getGraphqlClient().mutate({
      mutation: gql`
        mutation DraftPick($draftGameId: uuid!, $steamId: bigint!) {
          insert_draft_game_picks_one(
            object: { draft_game_id: $draftGameId, picked_steam_id: $steamId }
          ) {
            id
          }
        }
      `,
      variables: { draftGameId, steamId },
    });

  const clearMyDraftGame = (draftGameId: string) => {
    if (myDraftGame.value?.id === draftGameId) {
      myDraftGame.value = undefined;
    }
  };

  const leave = async (draftGameId: string) => {
    selfInitiatedExitId.value = draftGameId;
    await getGraphqlClient().mutate({
      mutation: gql`
        mutation LeaveDraftGame($draftGameId: uuid!, $steamId: bigint!) {
          delete_draft_game_players_by_pk(
            draft_game_id: $draftGameId
            steam_id: $steamId
          ) {
            draft_game_id
          }
        }
      `,
      variables: { draftGameId, steamId: useAuthStore().me?.steam_id },
    });
    clearMyDraftGame(draftGameId);
  };

  const cancelDraftRoom = async (draftGameId: string) => {
    selfInitiatedExitId.value = draftGameId;
    await getGraphqlClient().mutate({
      mutation: gql`
        mutation CancelDraftGame($draftGameId: uuid!) {
          delete_draft_games_by_pk(id: $draftGameId) {
            id
          }
        }
      `,
      variables: { draftGameId },
    });
    clearMyDraftGame(draftGameId);
  };

  const add = (draftGameId: string, steamId: string) =>
    getGraphqlClient().mutate({
      mutation: gql`
        mutation AddDraftPlayer($object: draft_game_players_insert_input!) {
          insert_draft_game_players_one(object: $object) {
            draft_game_id
          }
        }
      `,
      variables: { object: { draft_game_id: draftGameId, steam_id: steamId } },
    });

  const kick = (draftGameId: string, steamId: string) =>
    getGraphqlClient().mutate({
      mutation: gql`
        mutation KickDraftPlayer($draftGameId: uuid!, $steamId: bigint!) {
          delete_draft_game_players_by_pk(
            draft_game_id: $draftGameId
            steam_id: $steamId
          ) {
            draft_game_id
          }
        }
      `,
      variables: { draftGameId, steamId },
    });

  const deny = (draftGameId: string, steamId: string) =>
    kick(draftGameId, steamId);

  const approve = (draftGameId: string, steamId: string) =>
    getGraphqlClient().mutate({
      mutation: gql`
        mutation ApproveDraftPlayer($draftGameId: uuid!, $steamId: bigint!) {
          update_draft_game_players_by_pk(
            pk_columns: { draft_game_id: $draftGameId, steam_id: $steamId }
            _set: { status: Accepted }
          ) {
            draft_game_id
          }
        }
      `,
      variables: { draftGameId, steamId },
    });

  const teamAssign = (
    draftGameId: string,
    steamId: string,
    lineup: number | null,
  ) =>
    getGraphqlClient().mutate({
      mutation: gql`
        mutation TeamAssignDraftPlayer(
          $draftGameId: uuid!
          $steamId: bigint!
          $lineup: Int
        ) {
          update_draft_game_players_by_pk(
            pk_columns: { draft_game_id: $draftGameId, steam_id: $steamId }
            _set: { lineup: $lineup }
          ) {
            draft_game_id
          }
        }
      `,
      variables: { draftGameId, steamId, lineup },
    });

  return {
    openDraftGames,
    currentRoom,
    currentMatch,
    myDraftGame,
    selfInitiatedExitId,
    subscribeToMyDraftGame,
    subscribeToOpenDraftGames,
    unsubscribeFromOpenDraftGames,
    subscribeToDraftGame,
    unsubscribeFromDraftGame,
    subscribeToMatch,
    unsubscribeFromMatch,
    create,
    update,
    join,
    joinParty,
    leave,
    cancelDraftRoom,
    extend,
    start,
    pick,
    add,
    kick,
    teamAssign,
    approve,
    deny,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDraftGamesStore, import.meta.hot));
}
