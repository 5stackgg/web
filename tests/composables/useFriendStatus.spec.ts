import { describe, expect, it } from "vitest";
import { useFriendStatus } from "~/composables/useFriendStatus";

const LINEUP_1 = "lineup-1";
const LINEUP_2 = "lineup-2";

const friendIn = (lineupId: string | null, player: Record<string, any> = {}) => ({
  last_presence_state: null,
  player: {
    is_in_lobby: false,
    is_in_draft: false,
    ...player,
    live_lineup: lineupId
      ? [
          {
            lineup: {
              id: lineupId,
              match: {
                id: "match-1",
                status: "Live",
                started_at: "2026-10-16T12:00:00Z",
                lineup_1_id: LINEUP_1,
                lineup_2_id: LINEUP_2,
                options: { type: "Competitive", best_of: 3 },
                streams: [{ id: "stream-1" }],
                match_maps: [
                  {
                    id: "map-1",
                    order: 1,
                    status: "Finished",
                    is_current_map: false,
                    map: { name: "de_inferno", label: "Inferno" },
                    lineup_1_score: 13,
                    lineup_2_score: 9,
                    winning_lineup_id: LINEUP_1,
                  },
                  {
                    id: "map-2",
                    order: 2,
                    status: "Live",
                    is_current_map: true,
                    map: { name: "de_mirage", label: "Mirage" },
                    lineup_1_score: 4,
                    lineup_2_score: 7,
                    winning_lineup_id: null,
                  },
                ],
              },
            },
          },
        ]
      : [],
  },
});

describe("useFriendStatus", () => {
  it("shows the live match from the friend's live lineup, scored from their side", () => {
    const { statusKey, currentMatch } = useFriendStatus(
      friendIn(LINEUP_2),
      true,
    );

    expect(statusKey.value).toBe("in_match");
    expect(currentMatch.value).toMatchObject({
      id: "match-1",
      type: "Competitive",
      hasLiveStream: true,
      bestOf: 3,
      isSeries: true,
      mapName: "Mirage",
      mapNumber: 2,
      friendScore: 7,
      oppScore: 4,
      friendMapsWon: 0,
      oppMapsWon: 1,
    });
  });

  it("orients the score the other way for the first lineup", () => {
    const { currentMatch } = useFriendStatus(friendIn(LINEUP_1), true);

    expect(currentMatch.value).toMatchObject({
      friendScore: 4,
      oppScore: 7,
      friendMapsWon: 1,
      oppMapsWon: 0,
    });
  });

  it("falls back to lobby, draft and presence without a live lineup", () => {
    expect(useFriendStatus(friendIn(null), true).currentMatch.value).toBeNull();
    expect(
      useFriendStatus(friendIn(null, { is_in_lobby: true }), true).statusKey
        .value,
    ).toBe("in_lobby");
    expect(
      useFriendStatus(friendIn(null, { is_in_draft: true }), true).statusKey
        .value,
    ).toBe("in_draft");
    expect(useFriendStatus(friendIn(null), true).statusKey.value).toBe(
      "available",
    );
    expect(useFriendStatus(friendIn(null), false).statusKey.value).toBe(
      "offline",
    );
  });

  describe("a practice server the friend hosts", () => {
    const hosting = (status: string, session: Record<string, any> = {}) => ({
      ...friendIn(null, {
        hosted_practice_sessions: [
          {
            id: "s-1",
            map_name: "de_ancient",
            access: "Open",
            status: "Ready",
            invite_code: "c0de",
            seated_players: 2,
            max_players: 10,
            is_full: false,
            ...session,
          },
        ],
      }),
      status,
    });

    it("is offered with the invite link's path, even while the friend is offline", () => {
      const { statusKey, statusLabelParams, hostedPractice } = useFriendStatus(
        hosting("Accepted"),
        false,
      );

      expect(statusKey.value).toBe("in_practice");
      expect(statusLabelParams.value).toEqual({ map: "Ancient" });
      expect(hostedPractice.value).toMatchObject({
        path: "/utility/de_ancient?practice=c0de",
        full: false,
        seated: 2,
        max: 10,
      });
    });

    it("reads full from the api", () => {
      const { hostedPractice } = useFriendStatus(
        hosting("Accepted", { seated_players: 10, is_full: true }),
        true,
      );

      expect(hostedPractice.value).toMatchObject({ full: true, seated: 10 });
    });

    it("is never offered on a pending request", () => {
      const { statusKey, hostedPractice } = useFriendStatus(
        hosting("Pending"),
        true,
      );

      expect(hostedPractice.value).toBeNull();
      expect(statusKey.value).toBe("available");
    });
  });
});
