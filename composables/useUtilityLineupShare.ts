import { useRouter } from "vue-router";
import { useClipShare } from "~/composables/useClipShare";
import { utilityLineupRoute } from "~/utilities/utilityDisplay";

// A lineup's clip is shared the way a highlight is, but what goes out is the
// lineup's page rather than the mp4: the stills, the run-up and the practice
// button are the part worth sending.
export function useUtilityLineupShare() {
  const router = useRouter();
  const { copiedClipId, shareLink } = useClipShare();

  function shareLineup(mapName: string | null | undefined, id: string) {
    if (typeof window === "undefined") {
      return Promise.resolve();
    }
    const { href } = router.resolve(utilityLineupRoute(mapName, id));
    return shareLink(id, `${window.location.origin}${href}`);
  }

  return { copiedLineupId: copiedClipId, shareLineup };
}
