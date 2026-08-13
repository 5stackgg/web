import { computed } from "vue";
import { useI18n } from "vue-i18n";

/**
 * Single source of truth for the grouped application-settings navigation
 * (left-rail tabs + mobile dropdown).
 *
 * The top level uses the sidebar's Competition / Platform / System buckets so
 * the two navs read as one system, but deliberately leads with Platform: the
 * sidebar is task-ordered, whereas settings is read foundation-first.
 * Subgroups keep each bucket scannable.
 */

export interface SettingsNavItem {
  path: string;
  labelKey: string;
  /** Dev-only pages (e.g. fixtures) are hidden outside local domains. */
  dev?: boolean;
  /** Lower sorts first; unset items fall back to alphabetical order. */
  order?: number;
}

export interface SettingsNavSubgroup {
  labelKey: string;
  items: SettingsNavItem[];
}

export interface SettingsNavGroup {
  labelKey: string;
  subgroups: SettingsNavSubgroup[];
}

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    labelKey: "layouts.app_nav.platform.title",
    subgroups: [
      {
        labelKey: "layouts.application_settings.groups.players_teams",
        items: [
          {
            path: "/settings/application/players",
            labelKey: "pages.players.title",
            order: 0,
          },
          {
            path: "/settings/application/teams",
            labelKey: "pages.settings.application.teams.title",
            order: 1,
          },
          {
            path: "/settings/application/chat",
            labelKey: "pages.settings.application.chat.title",
            order: 2,
          },
        ],
      },
      {
        labelKey: "layouts.application_settings.groups.content_media",
        items: [
          {
            path: "/settings/application/news",
            labelKey: "pages.settings.application.news.title",
            order: 0,
          },
          {
            path: "/settings/application/streaming",
            labelKey: "pages.settings.application.streaming.title",
            order: 1,
          },
          {
            path: "/settings/application/cameras",
            labelKey: "pages.settings.application.cameras.title",
            order: 2,
          },
          {
            path: "/settings/application/demo-settings",
            labelKey: "pages.settings.application.demo_settings.title",
            order: 3,
          },
          {
            path: "/settings/application/highlights",
            labelKey: "pages.settings.application.highlights.title",
            order: 4,
          },
        ],
      },
      {
        labelKey: "layouts.application_settings.groups.integrations",
        items: [
          {
            path: "/settings/application/discord",
            labelKey: "pages.settings.application.discord.title",
            order: 0,
          },
          {
            path: "/settings/application/linked-accounts",
            labelKey: "pages.settings.application.linked_accounts.title",
            order: 1,
          },
          {
            path: "/settings/application/steam-presence",
            labelKey: "pages.settings.application.steam_presence.title",
            order: 2,
          },
          {
            path: "/settings/application/plugins",
            labelKey: "pages.settings.application.plugins.title",
            order: 3,
          },
        ],
      },
      {
        labelKey: "layouts.application_settings.groups.theme",
        items: [
          {
            path: "/settings/application/branding",
            labelKey: "layouts.application_settings.branding_nav",
          },
        ],
      },
    ],
  },
  {
    labelKey: "layouts.app_nav.competition.title",
    subgroups: [
      {
        labelKey: "layouts.application_settings.groups.competition",
        // Ordered to match the sidebar's Competition group, so anything present
        // in both rails (Awards, League, Events, Seasons) scans the same way.
        items: [
          {
            path: "/settings/application/awards",
            labelKey: "pages.settings.application.awards.title",
            order: 0,
          },
          {
            path: "/settings/application/matchmaking",
            labelKey: "pages.settings.application.matchmaking.title",
            order: 1,
          },
          {
            path: "/settings/application/scrim-finder",
            labelKey: "pages.settings.application.scrim_finder.title",
            order: 2,
          },
          {
            path: "/settings/application/leagues",
            labelKey: "pages.settings.application.leagues.title",
            order: 3,
          },
          {
            path: "/settings/application/events",
            labelKey: "pages.settings.application.events.title",
            order: 4,
          },
          {
            path: "/settings/application/seasons",
            labelKey: "pages.settings.application.seasons.title",
            order: 5,
          },
        ],
      },
      {
        labelKey: "layouts.application_settings.groups.match_setup",
        items: [
          {
            path: "/settings/application/game-type-configs",
            labelKey: "pages.settings.application.game_type_configs.title",
          },
          {
            path: "/settings/application/map-pools",
            labelKey: "pages.map_pools.title",
          },
        ],
      },
    ],
  },
  {
    labelKey: "layouts.app_nav.system.title",
    subgroups: [
      {
        labelKey: "layouts.application_settings.groups.infrastructure",
        items: [
          {
            path: "/settings/application/servers",
            labelKey: "pages.settings.application.servers.title",
          },
          {
            path: "/settings/application/telemetry",
            labelKey: "pages.settings.application.telemetry.title",
          },
        ],
      },
      {
        labelKey: "layouts.application_settings.groups.developer",
        items: [
          {
            path: "/settings/application/fixtures",
            labelKey: "layouts.application_settings.fixtures_nav",
            dev: true,
          },
        ],
      },
    ],
  },
];

/** Localized, dev-filtered nav groups for the left rail + mobile dropdown. */
export function useSettingsNav() {
  const { t } = useI18n();
  const isDev = computed(() => {
    const domain = useRuntimeConfig().public.webDomain;
    return domain.includes("localhost") || domain.includes(".local");
  });

  const groups = computed(() =>
    SETTINGS_NAV_GROUPS.map((group) => ({
      label: t(group.labelKey),
      subgroups: group.subgroups
        .map((subgroup) => ({
          label: t(subgroup.labelKey),
          items: subgroup.items
            .filter((item) => !item.dev || isDev.value)
            .map((item) => ({
              path: item.path,
              label: t(item.labelKey),
              order: item.order ?? 999,
            }))
            .sort(
              (a, b) => a.order - b.order || a.label.localeCompare(b.label),
            ),
        }))
        .filter((subgroup) => subgroup.items.length > 0),
    })).filter((group) => group.subgroups.length > 0),
  );

  const items = computed(() =>
    groups.value.flatMap((group) =>
      group.subgroups.flatMap((subgroup) => subgroup.items),
    ),
  );

  return { groups, items };
}
