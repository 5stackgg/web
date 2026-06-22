import { computed } from "vue";
import { useI18n } from "vue-i18n";

/**
 * Single source of truth for the grouped application-settings navigation
 * (left-rail tabs + mobile dropdown).
 */

export interface SettingsNavItem {
  path: string;
  labelKey: string;
  /** Dev-only pages (e.g. fixtures) are hidden outside local domains. */
  dev?: boolean;
}

export interface SettingsNavGroup {
  labelKey: string;
  items: SettingsNavItem[];
}

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    labelKey: "layouts.application_settings.groups.general",
    items: [
      {
        path: "/settings/application",
        labelKey: "pages.settings.application.matchmaking.title",
      },
      {
        path: "/settings/application/players",
        labelKey: "pages.players.title",
      },
      {
        path: "/settings/application/news",
        labelKey: "pages.settings.application.news.title",
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
      {
        path: "/settings/application/external-matches",
        labelKey: "pages.settings.application.external_matches.title",
      },
    ],
  },
  {
    labelKey: "layouts.application_settings.groups.media",
    items: [
      {
        path: "/settings/application/streaming",
        labelKey: "pages.settings.application.streaming.title",
      },
      {
        path: "/settings/application/demo-settings",
        labelKey: "pages.settings.application.demo_settings.title",
      },
      {
        path: "/settings/application/highlights",
        labelKey: "pages.settings.application.highlights.title",
      },
    ],
  },
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
    labelKey: "layouts.application_settings.groups.integrations",
    items: [
      {
        path: "/settings/application/discord",
        labelKey: "pages.settings.application.discord.title",
      },
      {
        path: "/settings/application/chat",
        labelKey: "pages.settings.application.chat.title",
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
      items: group.items
        .filter((item) => !item.dev || isDev.value)
        .map((item) => ({ path: item.path, label: t(item.labelKey) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    })).filter((group) => group.items.length > 0),
  );

  const items = computed(() => groups.value.flatMap((group) => group.items));

  return { groups, items };
}
