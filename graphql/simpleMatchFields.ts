import { order_by, Selector } from "@/generated/zeus";
import { mapFields } from "~/graphql/mapGraphql";
import { playerFields } from "~/graphql/playerFields";

const baseMatchFields = {
  id: true,
  status: true,
  ended_at: true,
  organizer_steam_id: true,
  is_in_lineup: true,
  e_match_status: {
    description: true,
  },
  winning_lineup_id: true,
  lineup_1_id: true,
  lineup_2_id: true,
  created_at: true,
  started_at: true,
  scheduled_at: true,
  options: {
    mr: true,
    best_of: true,
    type: true,
    lobby_access: true,
  },
  match_maps: [
    {
      order_by: [
        {
          order: order_by.asc,
        },
      ],
    },
    {
      map: mapFields,
      lineup_1_score: true,
      lineup_2_score: true,
      winning_lineup_id: true,
      vetos: [
        {},
        {
          side: true,
          type: true,
          match_lineup_id: true,
        },
      ],
    },
  ],
  lineup_1: {
    id: true,
    name: true,
    is_on_lineup: true,
    lineup_players: [
      {},
      {
        checked_in: true,
        placeholder_name: true,
        player: playerFields,
      },
    ],
  },
  lineup_2: {
    id: true,
    name: true,
    is_on_lineup: true,
    lineup_players: [
      {},
      {
        checked_in: true,
        placeholder_name: true,
        player: playerFields,
      },
    ],
  },

  max_players_per_lineup: true,
  min_players_per_lineup: true,
  lineup_counts: [{}, true],
};

// Version without invites (for unauthenticated users)
const simpleMatchFieldsWithoutInvites = Selector("matches")(
  baseMatchFields as any,
);

// Version with invites (for authenticated users)
const simpleMatchFieldsWithInvites = Selector("matches")({
  ...baseMatchFields,
  invites: [
    {},
    {
      steam_id: true,
    },
  ],
} as any);

// Function to get the appropriate fields based on authentication
function getSimpleMatchFields() {
  try {
    const { useAuthStore } = require("~/stores/AuthStore");
    const authStore = useAuthStore();
    const isAuthenticated = !!authStore?.me;
    return isAuthenticated
      ? simpleMatchFieldsWithInvites
      : simpleMatchFieldsWithoutInvites;
  } catch {
    // If auth store not available, return without invites
    return simpleMatchFieldsWithoutInvites;
  }
}

// Export the function result
export const simpleMatchFields = getSimpleMatchFields();
