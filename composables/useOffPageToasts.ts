import { h, watch } from "vue";
import { toast, ToastAction } from "~/components/ui/toast";
import { useAuthStore } from "~/stores/AuthStore";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";

type DraftSnapshot = {
  id: string;
  status: string;
  pickLineup: number | null;
  matchId: string | null;
};

export function useOffPageToasts() {
  const draftStore = useDraftGamesStore();
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
}
