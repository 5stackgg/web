import { watch } from "vue";
import { toast } from "~/components/ui/toast";
import { TWITCH_LINK_ERRORS } from "~/composables/useTwitch";

let installed = false;

// Read on every page, not just Linked Accounts: when the api cannot tell
// where the sign-in started (an expired or replayed state) it sends the
// player home, and that result still has to be explained and cleared.
export function installTwitchLinkResult() {
  if (installed) {
    return;
  }
  installed = true;

  const router = useRouter();
  const { t } = useNuxtApp().$i18n;

  watch(
    () => router.currentRoute.value,
    (route) => {
      const { twitch, twitch_error: error, ...rest } = route.query;

      if (twitch === "linked") {
        toast({ title: t("twitch.account.linked") });
      } else if (typeof error === "string" && error) {
        const code = (TWITCH_LINK_ERRORS as readonly string[]).includes(error)
          ? error
          : "unknown";
        toast({
          title: t("twitch.account.link_failed"),
          description: t(`twitch.account.errors.${code}`),
          variant: "destructive",
        });
      } else if (twitch === undefined && error === undefined) {
        return;
      }

      void router.replace({ path: route.path, query: rest, hash: route.hash });
    },
    { immediate: true },
  );
}
