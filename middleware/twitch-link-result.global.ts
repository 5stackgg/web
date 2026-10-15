import { toast } from "~/components/ui/toast";
import { TWITCH_LINK_ERRORS } from "~/composables/useTwitch";

// On every route, not just Linked Accounts: when the api cannot tell where
// the sign-in started (an expired or replayed state) it sends the player
// home. Stripped as a redirect of this same navigation, so nothing lands
// after a page's own redirect (the home page's) and undoes it.
export default defineNuxtRouteMiddleware((to) => {
  if (process.server) {
    return;
  }

  const { twitch, twitch_error: error, ...query } = to.query;

  if (twitch === undefined && error === undefined) {
    return;
  }

  const { t } = useNuxtApp().$i18n;

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
  }

  return navigateTo({ path: to.path, query, hash: to.hash }, { replace: true });
});
