import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";
import {
  BookOpen,
  CalendarCog,
  CalendarRange,
  FileText,
  Film,
  LifeBuoy,
  LineChart,
  Newspaper,
  Play,
  Plus,
  Radio,
  Scale,
  Server,
  ShieldCheck,
  ShieldHalf,
  Swords,
  Trophy,
  UserCog,
  Users,
} from "lucide-vue-next";
import TournamentBracket from "~/components/icons/tournament-bracket.vue";
import HeGrenadeIcon from "~/components/icons/HeGrenadeIcon.vue";
import PluginIcon from "~/components/plugins/PluginIcon.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import {
  adminAccess,
  adminGroupLabelKey,
  visibleAdminEntries,
} from "~/composables/adminEntries";

export type AppSection = {
  id: string;
  label: string;
  to: RouteLocationRaw;
  icon: Component;
  iconProps?: Record<string, unknown>;
  /** The nav group it sits in, shown beside it and searchable. */
  group?: string;
  /** Searchable, never shown. */
  keywords?: string;
};

/**
 * Every page of the app the signed-in player can open, behind the same gates
 * as the navs and the pages' own middleware.
 */
export function useAppSections() {
  const { t } = useI18n();
  const authStore = useAuthStore();
  const settings = useApplicationSettingsStore();
  const plugins = usePluginsStore();
  const { hasContent } = useSiteContent();
  const { currentSeasonTo, currentSeason } = useCurrentLeagueSeason();
  const router = useRouter();

  return computed(() => {
    const me = !!authStore.me;
    // Role settings read false until they load, which denies.
    const above = (role: string | false) =>
      me && authStore.isRoleAbove(role as e_player_roles_enum);
    const admin = above(e_player_roles_enum.administrator);

    const community = t("layouts.app_nav.community.title");
    const social = t("layouts.app_nav.social.title");
    const support = t("layouts.top_nav.support_menu");
    const legal = t("legal.section");

    const sections: (AppSection | false)[] = [
      me && {
        id: "me",
        label: t("layouts.app_nav.navigation.dashboard"),
        to: "/me",
        icon: LineChart,
      },
      {
        id: "play",
        label: t("layouts.app_nav.navigation.play"),
        to: { name: "play" },
        icon: Play,
      },
      {
        id: "watch",
        label: t("layouts.app_nav.navigation.watch"),
        to: { name: "watch" },
        icon: Radio,
      },
      {
        id: "utility",
        label: t("layouts.app_nav.navigation.utility"),
        to: { name: "utility" },
        icon: HeGrenadeIcon,
        keywords: t("layouts.top_nav.community.utility.subtitle"),
      },
      {
        id: "matches",
        label: t("layouts.app_nav.navigation.matches"),
        to: { name: "matches" },
        icon: CalendarCog,
      },
      (hasContent("tournaments") || above(settings.tournamentCreateRole)) && {
        id: "tournaments",
        label: t("layouts.app_nav.navigation.tournaments"),
        to: { name: "tournaments" },
        icon: TournamentBracket,
      },
      settings.leaguesEnabled &&
        (!!currentSeason.value || admin) && {
          id: "league",
          label: t("layouts.app_nav.navigation.leagues"),
          to: currentSeasonTo.value,
          icon: Trophy,
        },
      settings.eventsEnabled &&
        (hasContent("events") || above(settings.eventCreateRole)) && {
          id: "events",
          label: t("layouts.app_nav.navigation.events"),
          to: { name: "events" },
          icon: CalendarRange,
          keywords: t("layouts.top_nav.community.events.subtitle"),
        },
      {
        id: "public-servers",
        label: t("layouts.app_nav.navigation.public_servers"),
        to: { name: "public-servers" },
        icon: Server,
      },
      {
        id: "players",
        label: t("layouts.app_nav.navigation.players"),
        to: { name: "players" },
        icon: Users,
        group: community,
      },
      {
        id: "teams",
        label: t("layouts.app_nav.navigation.teams"),
        to: { name: "teams" },
        icon: ShieldHalf,
        group: community,
      },
      {
        id: "scrims",
        label: t("layouts.app_nav.navigation.scrims"),
        to: { name: "scrims" },
        icon: Swords,
        group: community,
      },
      {
        id: "leaderboard",
        label: t("layouts.app_nav.navigation.leaderboard"),
        to: { name: "leaderboard" },
        icon: Trophy,
        group: community,
        keywords: t("layouts.top_nav.community.leaderboard.subtitle"),
      },
      settings.newsEnabled &&
        (hasContent("news") || settings.canPostNews) && {
          id: "news",
          label: settings.newsLabel || t("layouts.app_nav.navigation.news"),
          to: { name: "news" },
          icon: Newspaper,
          group: social,
        },
      hasContent("highlights") && {
        id: "highlights",
        label: t("layouts.app_nav.navigation.highlights"),
        to: { name: "highlights" },
        icon: Film,
        group: social,
        keywords: t("layouts.top_nav.community.highlights.subtitle"),
      },
      ...plugins.visiblePlugins.map((plugin) => ({
        id: `apps-${plugin.slug}`,
        label: plugin.title,
        to: `/apps/${plugin.slug}`,
        icon: PluginIcon,
        iconProps: { name: plugin.icon },
        group: plugin.nav_group || t("layouts.app_nav.plugins.title"),
      })),
      // Admin pages: labels, icons, groups, order and gates from adminEntries,
      // the same list the left nav's Admin list reads.
      ...visibleAdminEntries(adminAccess(), {
        hasRoute: (name) => router.hasRoute(name),
      }).map((entry) => ({
        id: entry.route,
        label: t(entry.labelKey),
        to: { name: entry.route },
        icon: entry.icon,
        group: t(adminGroupLabelKey(entry.group)),
        keywords: entry.keywordKeys?.map((key) => t(key)).join(" "),
      })),
      me && {
        id: "settings",
        label: t("layouts.account_settings.title"),
        to: "/settings",
        icon: UserCog,
      },
      {
        id: "faq",
        label: t("faq.title"),
        to: "/faq",
        icon: LifeBuoy,
        group: support,
      },
      {
        id: "stats-guide",
        label: t("glossary.title"),
        to: "/stats-guide",
        icon: BookOpen,
        group: support,
      },
      {
        id: "terms",
        label: t("legal.terms.title"),
        to: "/terms",
        icon: FileText,
        group: legal,
      },
      {
        id: "privacy",
        label: t("legal.privacy.title"),
        to: "/privacy",
        icon: ShieldCheck,
        group: legal,
      },
      {
        id: "licenses",
        label: t("licenses.title"),
        to: "/licenses",
        icon: Scale,
        group: legal,
      },
      above(e_player_roles_enum.match_organizer) && {
        id: "matches-create",
        label: t("pages.matches.create"),
        to: "/matches/create",
        icon: Plus,
      },
      above(settings.tournamentCreateRole) && {
        id: "tournaments-create",
        label: t("pages.tournaments.create"),
        to: "/tournaments/create",
        icon: Plus,
      },
      settings.eventsEnabled &&
        above(settings.eventCreateRole) && {
          id: "events-create",
          label: t("pages.events.create"),
          to: "/events/create",
          icon: Plus,
        },
      me && {
        id: "teams-create",
        label: t("pages.teams.create"),
        to: "/teams/create",
        icon: Plus,
      },
    ];

    return sections.filter((section): section is AppSection => !!section);
  });
}
