import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  changeUtilityPracticeMapMutation,
  sendUtilityDrillToServerMutation,
  sendUtilityLineupToServerMutation,
  sendUtilityScratchToServerMutation,
  utilityPracticeWhereAmIQuery,
} from "~/graphql/utilityGraphql";
import { toast } from "~/components/ui/toast";
import { useAuthStore } from "~/stores/AuthStore";
import socket from "~/web-sockets/Socket";
import { useUtilityPracticeSession } from "~/composables/useUtilityPracticeSession";
import cleanMapName from "~/utilities/cleanMapName";
import { UTILITY_EYE_HEIGHT_UNITS } from "~/utilities/utilityDisplay";
import type { UtilityMetaSpot } from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

type WhereAmI = {
  on_server: boolean;
  map_name: string | null;
  session_id: string | null;
  // map_name is where the server is HEADED while this is true. A load sent into
  // a level that is still loading has no player to teleport.
  switching: boolean;
};

type LoadResult = {
  sent: boolean;
  reason: string;
  map_name: string | null;
};

// Module scope: every surface that offers "load me in" is asking the same
// question about the same player, and each one polling for itself would be one
// request per card on screen.
const where = ref<WhereAmI | null>(null);
const checking = ref(false);
const sending = ref<string | null>(null);
let checkedAt = 0;

// Somebody joins or leaves a practice server perhaps twice an hour. Re-asking
// more often than this buys nothing, and the answer is refreshed on demand
// after anything that would change it.
const FRESH_MS = 30_000;

// The API pushes this to the player's own sockets the moment the practice
// plugin reports them connecting or disconnecting, so nothing has to poll to
// find out. Bound here rather than in a component because the answer belongs to
// the module -- the nav that used to own the polling is `v-if="!isMobile"`, and
// a phone would otherwise never learn the player had joined.
let socketBound = false;

function bindSocket() {
  if (socketBound) {
    return;
  }

  socketBound = true;

  socket.listen("utility:where", (data: WhereAmI) => {
    where.value = data;
    checkedAt = Date.now();
  });

  // A flip that happened while the socket was down was pushed to nobody.
  socket.listen("online", () => {
    if (useAuthStore().me?.steam_id) {
      void check(true);
    }
  });
}

async function check(force = false): Promise<WhereAmI | null> {
  if (!useAuthStore().me?.steam_id) {
    where.value = null;
    return null;
  }
  if (!force && where.value && Date.now() - checkedAt < FRESH_MS) {
    return where.value;
  }
  if (checking.value) {
    return where.value;
  }

  checking.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityPracticeWhereAmIQuery,
      fetchPolicy: "network-only",
    });
    where.value = (data as any)?.utilityPracticeWhereAmI ?? null;
    checkedAt = Date.now();
  } catch (error) {
    // Never a reason to break a page: not knowing where somebody is just
    // means offering the booking dialog, which is what used to happen always.
    console.error("[utility] where-am-i error:", error);
    where.value = null;
  } finally {
    checking.value = false;
  }

  return where.value;
}

export function useUtilityLoad() {
  const { t } = useI18n();

  bindSocket();

  /** Whether "load me in" is worth offering for a lineup on this map. */
  function canLoad(mapName: string | null | undefined): boolean {
    return (
      !!where.value?.on_server &&
      !where.value.switching &&
      !!mapName &&
      where.value.map_name === mapName
    );
  }

  /**
   * Whether the server this player is on can be BROUGHT to a lineup's map.
   *
   * Only the host: a changelevel drops everyone on the server into a load
   * screen, which is not a thing a guest gets to do to the person who booked
   * it. Everyone else keeps the old behaviour -- no button, and the banner on
   * the map page says who to ask.
   */
  function canSwitchTo(mapName: string | null | undefined): boolean {
    const session = useUtilityPracticeSession();

    return (
      !!where.value?.on_server &&
      !where.value.switching &&
      !!mapName &&
      where.value.map_name !== mapName &&
      session.canManage.value &&
      !!session.session.value?.id
    );
  }

  function report(result: LoadResult | null, name: string) {
    if (result?.sent) {
      toast({
        title: t("pages.utility.load.sent", { name }),
        description: t("pages.utility.load.sent_description"),
      });
      return true;
    }

    // Each refusal has a different fix, so each one says which.
    const reason = result?.reason ?? "unreachable";
    toast({
      title: t(`pages.utility.load.failed_${reason}`),
      variant: "destructive",
    });

    // The player has moved since we last looked; the next button press should
    // ask again rather than repeat this.
    if (
      reason === "not_on_a_server" ||
      reason === "wrong_map" ||
      reason === "map_switching"
    ) {
      void check(true);
    }

    return false;
  }

  async function sendLineup(lineup: UtilityLineup): Promise<boolean> {
    sending.value = lineup.id;
    try {
      const { data } = await getGraphqlClient().mutate({
        mutation: sendUtilityLineupToServerMutation,
        variables: { lineup_id: lineup.id },
      });
      return report((data as any)?.sendUtilityLineupToServer, lineup.name);
    } catch (error: any) {
      toast({
        title: t("pages.utility.load.failed_unreachable"),
        description: error?.message,
        variant: "destructive",
      });
      return false;
    } finally {
      sending.value = null;
    }
  }

  /**
   * A mined cluster has no lineup behind it, so this sends the throw itself.
   * The client_id is derived from the cluster key rather than random, so
   * pressing it twice replaces the scratch throw instead of stacking copies of
   * it in the server's library.
   */
  function spotScratch(
    spot: UtilityMetaSpot,
    mapName: string,
    name: string,
  ): Record<string, unknown> {
    return {
      client_id: `scratch-${spot.key}`,
      name,
      map_name: mapName,
      utility_type: spot.utilityType,
      side: spot.side ?? "TERRORIST",
      technique: spot.technique ?? "Stationary",
      throw_strength: spot.throwStrength ?? "Full",
      origin_x: spot.origin.x,
      origin_y: spot.origin.y,
      origin_z: spot.origin.z,
      // The cluster stores where the feet were; the throw leaves from the
      // eye, and nothing else here knows how far apart those are.
      eye_z: spot.origin.z + UTILITY_EYE_HEIGHT_UNITS,
      view_yaw: Number(spot.viewYaw ?? 0),
      view_pitch: Number(spot.viewPitch ?? 0),
      land_x: spot.landing?.x ?? null,
      land_y: spot.landing?.y ?? null,
      land_z: spot.landing?.z ?? null,
    };
  }

  async function sendSpot(
    spot: UtilityMetaSpot,
    mapName: string,
    name: string,
  ): Promise<boolean> {
    const id = `scratch-${spot.key}`;
    sending.value = id;
    try {
      const { data } = await getGraphqlClient().mutate({
        mutation: sendUtilityScratchToServerMutation,
        variables: { lineup: spotScratch(spot, mapName, name) },
      });
      return report((data as any)?.sendUtilityScratchToServer, name);
    } catch (error: any) {
      toast({
        title: t("pages.utility.load.failed_unreachable"),
        description: error?.message,
        variant: "destructive",
      });
      return false;
    } finally {
      sending.value = null;
    }
  }

  /**
   * A draft that has never been saved. Same road as a mined spot -- the server
   * takes a throw, not a row -- which is what lets somebody stand on a lineup
   * they are still writing and find out whether it works before deciding it is
   * worth keeping.
   */
  type UtilityDraftThrow = {
    map_name: string;
    utility_type: string;
    side: string;
    technique: string;
    throw_strength: string;
    origin: { x: number; y: number; z: number };
    landing: { x: number; y: number; z: number } | null;
    view_yaw: number;
    view_pitch: number;
  };

  function draftScratch(
    draft: UtilityDraftThrow,
    name: string,
  ): Record<string, unknown> {
    return {
      // Stable, so testing the same draft twice replaces it rather than piling
      // up copies in the server's library.
      client_id: "scratch-draft",
      name,
      map_name: draft.map_name,
      utility_type: draft.utility_type,
      side: draft.side,
      technique: draft.technique,
      throw_strength: draft.throw_strength,
      origin_x: draft.origin.x,
      origin_y: draft.origin.y,
      origin_z: draft.origin.z,
      eye_z: draft.origin.z + UTILITY_EYE_HEIGHT_UNITS,
      view_yaw: draft.view_yaw,
      view_pitch: draft.view_pitch,
      land_x: draft.landing?.x ?? null,
      land_y: draft.landing?.y ?? null,
      land_z: draft.landing?.z ?? null,
    };
  }

  async function sendDraft(
    draft: UtilityDraftThrow,
    name: string,
  ): Promise<boolean> {
    sending.value = "scratch-draft";
    try {
      const { data } = await getGraphqlClient().mutate({
        mutation: sendUtilityScratchToServerMutation,
        variables: { lineup: draftScratch(draft, name) },
      });
      return report((data as any)?.sendUtilityScratchToServer, name);
    } catch (error: any) {
      toast({
        title: t("pages.utility.load.failed_unreachable"),
        description: error?.message,
        variant: "destructive",
      });
      return false;
    } finally {
      sending.value = null;
    }
  }

  /**
   * Bring the server onto another map, landing the caller on something once it
   * is up.
   *
   * There is no confirmation step by design: the button that reaches this says
   * it will switch the map, and the countdown in game is what warns anybody
   * else on the server. `queued: false` means the map is changing but the
   * server is on a plugin build that cannot hold a load across it.
   */
  async function switchMap(
    mapName: string,
    queue?: {
      key?: string;
      name?: string;
      lineup_id?: string;
      lineup_ids?: Array<string>;
      scratch?: Record<string, unknown>;
    },
  ): Promise<boolean> {
    const sessionId = useUtilityPracticeSession().session.value?.id;

    if (!sessionId) {
      toast({
        title: t("pages.utility.load.failed_not_on_a_server"),
        variant: "destructive",
      });
      return false;
    }

    sending.value = queue?.key ?? `map-${mapName}`;

    try {
      const { data } = await getGraphqlClient().mutate({
        mutation: changeUtilityPracticeMapMutation,
        variables: {
          session_id: sessionId,
          map_name: mapName,
          lineup_id: queue?.lineup_id ?? null,
          lineup_ids: queue?.lineup_ids ?? null,
          scratch: queue?.scratch ?? null,
        },
      });

      const result = (data as any)?.changeUtilityPracticeMap;

      if (!result?.success) {
        throw new Error(t("pages.utility.practice.switch_failed"));
      }

      toast({
        title: t("pages.utility.practice.switching", {
          map: cleanMapName(mapName),
        }),
        description:
          queue?.name && result.queued
            ? t("pages.utility.load.switch_then_load", { name: queue.name })
            : t("pages.utility.practice.switching_description"),
      });

      // The session row carries map_changing_at, but this is what every
      // "am I on the right map" check reads, and it is otherwise 15s stale.
      await check(true);

      return true;
    } catch (error: any) {
      toast({
        title: t("pages.utility.practice.switch_failed"),
        description: error?.message,
        variant: "destructive",
      });
      return false;
    } finally {
      sending.value = null;
    }
  }

  /** Drill a chosen set, in the order given, on the server they are in. */
  async function sendDrill(lineups: Array<UtilityLineup>): Promise<boolean> {
    if (lineups.length === 0) {
      return false;
    }

    sending.value = "drill";
    try {
      const { data } = await getGraphqlClient().mutate({
        mutation: sendUtilityDrillToServerMutation,
        variables: { lineup_ids: lineups.map((lineup) => lineup.id) },
      });
      return report(
        (data as any)?.sendUtilityDrillToServer,
        t("pages.utility.load.drill_name", { count: lineups.length }),
      );
    } catch (error: any) {
      toast({
        title: t("pages.utility.load.failed_unreachable"),
        description: error?.message,
        variant: "destructive",
      });
      return false;
    } finally {
      sending.value = null;
    }
  }

  return {
    where: computed(() => where.value),
    onServer: computed(() => !!where.value?.on_server),
    switching: computed(() => where.value?.switching === true),
    checking: computed(() => checking.value),
    sending: computed(() => sending.value),
    check,
    canLoad,
    canSwitchTo,
    switchMap,
    spotScratch,
    draftScratch,
    sendLineup,
    sendSpot,
    sendDraft,
    sendDrill,
  };
}
