import { useI18n } from "vue-i18n";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  clearUtilityVoteMutation,
  favoriteUtilityLineupMutation,
  setUtilityVoteMutation,
  unfavoriteUtilityLineupMutation,
} from "~/graphql/utilityGraphql";
import type { UtilityLineup } from "~/types/utility";

/**
 * Voting and favouriting, in one place. The detail page owned both and the card
 * showed the totals without being able to change them, which is how you end up
 * with a heart that looks like a button and is not one.
 *
 * Every call reports what the row should now look like, so a caller holding a
 * list can patch its copy instead of refetching the page to move one number.
 */
export type UtilityReactionPatch = {
  my_vote: number | null;
  upvotes: number;
  downvotes: number;
  is_favorited: boolean;
};

export function useUtilityReactions() {
  const { t } = useI18n();

  function snapshot(lineup: UtilityLineup): UtilityReactionPatch {
    return {
      my_vote: lineup.my_vote ?? null,
      upvotes: Number(lineup.upvotes ?? 0),
      downvotes: Number(lineup.downvotes ?? 0),
      is_favorited: !!lineup.is_favorited,
    };
  }

  /** What the counts become locally, so the click lands before the round trip. */
  function afterVote(
    lineup: UtilityLineup,
    value: 1 | -1,
  ): UtilityReactionPatch {
    const next = snapshot(lineup);
    const had = next.my_vote;

    // Clicking the vote you already hold clears it.
    next.my_vote = had === value ? null : value;

    if (had === 1) {
      next.upvotes = Math.max(0, next.upvotes - 1);
    }
    if (had === -1) {
      next.downvotes = Math.max(0, next.downvotes - 1);
    }
    if (next.my_vote === 1) {
      next.upvotes += 1;
    }
    if (next.my_vote === -1) {
      next.downvotes += 1;
    }

    return next;
  }

  function afterFavorite(lineup: UtilityLineup): UtilityReactionPatch {
    const next = snapshot(lineup);
    next.is_favorited = !next.is_favorited;
    return next;
  }

  async function vote(
    lineup: UtilityLineup,
    steamId: string,
    value: 1 | -1,
  ): Promise<boolean> {
    const clearing = lineup.my_vote === value;
    const where = {
      utility_lineup_id: { _eq: lineup.id },
      steam_id: { _eq: steamId },
    };

    try {
      const client = getGraphqlClient();

      if (clearing) {
        await client.mutate({
          mutation: clearUtilityVoteMutation,
          variables: { where },
        });
      } else {
        await client.mutate({
          mutation: setUtilityVoteMutation,
          variables: {
            where,
            object: { utility_lineup_id: lineup.id, vote: value },
          },
        });
      }

      return true;
    } catch (error: any) {
      toast({
        title: t("pages.utility.detail.vote_failed"),
        description: error?.message,
        variant: "destructive",
      });
      return false;
    }
  }

  async function toggleFavorite(
    lineup: UtilityLineup,
    steamId: string,
  ): Promise<boolean> {
    try {
      const client = getGraphqlClient();

      if (lineup.is_favorited) {
        await client.mutate({
          mutation: unfavoriteUtilityLineupMutation,
          variables: {
            where: {
              utility_lineup_id: { _eq: lineup.id },
              steam_id: { _eq: steamId },
            },
          },
        });
      } else {
        await client.mutate({
          mutation: favoriteUtilityLineupMutation,
          variables: { object: { utility_lineup_id: lineup.id } },
        });
      }

      return true;
    } catch (error: any) {
      toast({
        title: t("pages.utility.detail.favorite_failed"),
        description: error?.message,
        variant: "destructive",
      });
      return false;
    }
  }

  return { vote, toggleFavorite, afterVote, afterFavorite };
}
