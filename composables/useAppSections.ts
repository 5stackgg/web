import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";
import {
  BookOpen,
  CalendarCog,
  CalendarRange,
  Camera,
  Cog,
  Database,
  Film,
  Globe,
  HardDrive,
  LibraryBig,
  LifeBuoy,
  LineChart,
  ListVideo,
  Logs,
  Leaf,
  Medal,
  Megaphone,
  Newspaper,
  Play,
  Plus,
  Radio,
  Server,
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

  return computed(() => {
    const me = !!authStore.me;
    // Role settings read false until they load, which denies.
    const above = (role: string | false) =>
      me && authStore.isRoleAbove(role as e_player_roles_enum);
    const admin = above(e_player_roles_enum.administrator);

    const community = t("layouts.app_nav.community.title");
    const social = t("layouts.app_nav.social.title");
    const competition = t("layouts.app_nav.competition.title");
    const platform = t("layouts.app_nav.platform.title");
    const servers = t("layouts.app_nav.administration.servers");
    const system = t("layouts.app_nav.system.title");
    const support = t("layouts.top_nav.support_menu");

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
      (settings.canManageAwards || settings.canGrantAwards) && {
        id: "awards",
        label: t("layouts.app_nav.administration.awards"),
        to: { name: "awards" },
        icon: Medal,
        group: competition,
      },
      admin &&
        settings.seasonsEnabled && {
          id: "seasons",
          label: t("layouts.app_nav.administration.seasons"),
          to: { name: "seasons" },
          icon: Leaf,
          group: competition,
        },
      admin && {
        id: "system-alerts",
        label: t("layouts.app_nav.administration.alerts"),
        to: { name: "system-alerts" },
        icon: Megaphone,
        group: platform,
      },
      above(e_player_roles_enum.streamer) && {
        id: "stream-deck",
        label: t("layouts.app_nav.administration.stream_deck"),
        to: { name: "stream-deck" },
        icon: Camera,
        group: platform,
      },
      admin &&
        settings.gamePluginsEnabled && {
          id: "plugins",
          label: t("layouts.app_nav.platform.plugin_directory"),
          to: { name: "plugins" },
          icon: LibraryBig,
          group: platform,
        },
      admin && {
        id: "regions",
        label: t("layouts.app_nav.administration.regions"),
        to: { name: "regions" },
        icon: Globe,
        group: platform,
      },
      admin && {
        id: "settings-application",
        label: t("layouts.app_nav.administration.app_settings"),
        to: { name: "settings-application" },
        icon: Cog,
        group: platform,
      },
      admin && {
        id: "dedicated-servers",
        label: t("layouts.app_nav.administration.dedicated_servers"),
        to: { name: "dedicated-servers" },
        icon: Server,
        group: servers,
      },
      admin && {
        id: "game-server-nodes",
        label: t("layouts.app_nav.administration.game_server_nodes"),
        to: { name: "game-server-nodes" },
        icon: Server,
        group: servers,
      },
      admin && {
        id: "gpu-nodes",
        label: t("layouts.app_nav.administration.gpu_nodes"),
        to: { name: "gpu-nodes" },
        icon: Server,
        group: servers,
      },
      admin && {
        id: "system-logs",
        label: t("layouts.app_nav.system.logs"),
        to: { name: "system-logs" },
        icon: Logs,
        group: system,
      },
      admin && {
        id: "system-metrics",
        label: t("layouts.app_nav.system.metrics"),
        to: { name: "system-metrics" },
        icon: LineChart,
        group: system,
      },
      admin && {
        id: "system-media-server",
        label: t("layouts.app_nav.system.media_server"),
        to: { name: "system-media-server" },
        icon: Radio,
        group: system,
      },
      admin && {
        id: "database",
        label: t("layouts.app_nav.system.database"),
        to: { name: "database" },
        icon: Database,
        group: system,
      },
      admin && {
        id: "system-render-queue",
        label: t("layouts.app_nav.system.render_queue"),
        to: { name: "system-render-queue" },
        icon: ListVideo,
        group: system,
      },
      admin &&
        useRuntimeConfig().public.webDomain === "5stack.gg" && {
          id: "fleet-telemetry",
          label: t("pages.system_telemetry.title"),
          to: { name: "fleet-telemetry" },
          icon: HardDrive,
          group: system,
        },
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
