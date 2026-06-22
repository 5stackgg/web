import { h, watch } from "vue";
import { useRouter } from "vue-router";
import { toast, ToastAction } from "~/components/ui/toast";
import { useAuthStore } from "~/stores/AuthStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";

type DraftSnapshot = {
  id: string;
  status: string;
  pickLineup: number | null;
  matchId: string | null;
};

export function useOffPageToasts() {
  const draftStore = useDraftGamesStore();
  const matchStore = useMatchLobbyStore();
  const auth = useAuthStore();
  const router = useRouter();
  const { $i18n } = useNuxtApp();
  const t = (key: string, ...args: any[]) => ($i18n as any).t(key, ...args);

  const onPage = (prefix: string, id: string) => {
    return router.currentRoute.value.path.startsWith(`${prefix}/${id}`);
  };

  const goAction = (label: string, to: string) => {
    return h(ToastAction, { altText: label, onClick: () => navigateTo(to) }, () => label);
  };

  let prevDraft: DraftSnapshot | null = null;

  watch(
    () => draftStore.myDraftGame,
    (room: any) => {
      const me = auth.me?.steam_id;
      const prev = prevDraft;

      if (!room || !me) {
        if (
          prev &&
          !prev.matchId &&
          draftStore.selfInitiatedExitId !== prev.id &&
          !onPage("/draft-room", prev.id)
        ) {
          toast({
            title: t("draft_games.toasts.removed_title"),
            description: t("draft_games.toasts.removed_desc"),
          });
        }
        if (prev && draftStore.selfInitiatedExitId === prev.id) {
          draftStore.selfInitiatedExitId = null;
        }
        prevDraft = null;
        return;
      }

      const myPlayer = (room.players || []).find(
        (player: any) => String(player.steam_id) === String(me),
      );
      const pickLineup = room.current_pick_lineup ?? null;
      const isMyTurn =
        room.status === "Drafting" &&
        !!myPlayer?.is_captain &&
        pickLineup != null &&
        pickLineup === (myPlayer?.lineup ?? null);

      const advancedToMe =
        !!prev &&
        prev.id === room.id &&
        prev.status === "Drafting" &&
        prev.pickLineup !== pickLineup;

      if (isMyTurn && advancedToMe && !onPage("/draft-room", room.id)) {
        toast({
          title: t("draft_games.toasts.your_pick_title"),
          description: t("draft_games.toasts.your_pick_desc"),
          action: goAction(
            t("draft_games.room.go_to_room"),
            `/draft-room/${room.id}`,
          ),
        });
      }

      prevDraft = {
        id: room.id,
        status: room.status,
        pickLineup,
        matchId: room.match_id ?? null,
      };
    },
    { deep: true },
  );

  let prevMatches = new Map<string, { status: string; canPick: boolean }>();

  watch(
    () => matchStore.myMatches,
    (matches: any[]) => {
      const next = new Map<string, { status: string; canPick: boolean }>();

      for (const match of matches || []) {
        const canPick =
          !!match.is_in_lineup &&
          !!(
            match.lineup_1?.can_pick_map_veto ||
            match.lineup_2?.can_pick_map_veto ||
            match.lineup_1?.can_pick_region_veto ||
            match.lineup_2?.can_pick_region_veto
          );

        const prev = prevMatches.get(match.id);
        const embeddedDraftId = match.draft_games?.[0]?.id;

        if (
          prev &&
          prev.status === "Veto" &&
          match.status === "Veto" &&
          canPick &&
          !prev.canPick &&
          !onPage("/matches", match.id) &&
          !(embeddedDraftId && onPage("/draft-room", embeddedDraftId))
        ) {
          toast({
            title: t("matchmaking.toasts.your_veto_title"),
            description: t("matchmaking.toasts.your_veto_desc"),
            action: goAction(
              t("matchmaking.go_to_match"),
              `/matches/${match.id}`,
            ),
          });
        }

        next.set(match.id, { status: match.status, canPick });
      }

      prevMatches = next;
    },
    { deep: true },
  );
}
