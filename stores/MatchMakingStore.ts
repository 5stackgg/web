import { ref, watch } from "vue";
import { defineStore, acceptHMRUpdate } from "pinia";
import { e_match_types_enum, $ } from "~/generated/zeus";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { generateQuery, generateSubscription } from "~/graphql/graphqlGen";
import { playerFields } from "~/graphql/playerFields";
import { typedGql } from "~/generated/zeus/typedDocumentNode";

export const useMatchmakingStore = defineStore("matchmaking", () => {
  const playersOnline = ref([]);
  const onlinePlayerSteamIds = ref<string[]>([]);

  const joinedMatchmakingQueues = ref<{
    details?: {
      totalInQueue: number;
      type: e_match_types_enum;
      regions: Array<string>;
    };
    confirmation?: {
      matchId: string;
      isReady: boolean;
      expiresAt: string;
      confirmed: number;
      confirmationId: string;
      type: e_match_types_enum;
      region: string;
    };
  }>({
    details: undefined,
    confirmation: undefined,
  });

  const regionStats = ref<
    Partial<Record<string, Partial<Record<e_match_types_enum, number>>>>
  >({});

  const queryPlayers = async () => {
    const steamIds = onlinePlayerSteamIds.value;
    if (steamIds.length === 0) {
      return;
    }
    const { data } = await getGraphqlClient().query({
      query: generateQuery({
        players: [
          {
            where: {
              steam_id: {
                _in: $("steam_ids", "[bigint]!"),
              },
            },
          },
          playerFields,
        ],
      }),
      variables: {
        steam_ids: steamIds,
      },
    });

    playersOnline.value = data.players;
  };

  const friends = ref([]);
  const subscribeToFriends = async () => {
    const subscription = getGraphqlClient().subscribe({
      query: generateSubscription({
        my_friends: [
          {},
          {
            name: true,
            country: true,
            steam_id: true,
            avatar_url: true,
            status: true,
            invited_by_steam_id: true,
            // TODO - this is problematic, cant limit current_lobby_id since its in a view....
            // this exposes the lobby id....
            // current_lobby_id: true,
          },
        ],
      }),
    });

    subscription.subscribe({
      next: ({ data }) => {
        friends.value = data.my_friends;
        // TODO - refresh the lobby list
      },
    });
  };

  subscribeToFriends();

  watch(onlinePlayerSteamIds, (newSteamIds, oldSteamIds) => {
    if (
      newSteamIds.length !== oldSteamIds.length ||
      !newSteamIds.every((id, index) => id === oldSteamIds[index])
    ) {
      queryPlayers();
    }
  });

  const inviteToLobby = async (steam_id: string) => {
    const me = useAuthStore().me;

    let lobby_id = me?.current_lobby_id;

    if (!lobby_id) {
      const { data } = await getGraphqlClient().mutate({
        mutation: typedGql("mutation")({
          insert_lobbies_one: [
            {
              object: {},
            },
            {
              id: true,
            },
          ],
        }),
      });
      lobby_id = data.insert_lobbies_one.id;
    }

    await getGraphqlClient().mutate({
      mutation: typedGql("mutation")({
        insert_lobby_players_one: [
          {
            object: {
              steam_id,
              lobby_id,
            },
          },
          {
            __typename: true,
          },
        ],
      }),
    });
  };

  return {
    friends,
    regionStats,
    playersOnline,
    onlinePlayerSteamIds,
    joinedMatchmakingQueues,
    inviteToLobby,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMatchmakingStore, import.meta.hot));
}

const temp = {
  _or: [
    {
      _and: [
        {
          lobby: {
            _or: [
              {
                players: {
                  steam_id: {
                    _eq: "X-Hasura-User-Id",
                  },
                },
              },
              {
                access: {
                  _eq: "Open",
                },
              },
            ],
          },
        },
        {
          _and: [
            {
              status: {
                _neq: "Invited",
              },
            },
          ],
        },
      ],
    },
    {
      _and: [
        {
          lobby: {
            _or: [
              {
                players: {
                  steam_id: {
                    _eq: "X-Hasura-User-Id",
                  },
                },
              },
              {
                access: {
                  _eq: "Open",
                },
              },
            ],
          },
        },
        {
          _and: [
            {
              status: {
                _eq: "Invited",
              },
              steam_id: {
                _eq: "X-Hasura-User-Id",
              },
            },
          ],
        },
      ],
    },
  ],
};
