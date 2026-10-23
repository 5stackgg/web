import type { Component } from "vue";
import {
  Activity,
  Cog,
  Cpu,
  Database,
  Globe,
  HardDrive,
  LayoutDashboard,
  Leaf,
  LibraryBig,
  LineChart,
  ListVideo,
  Logs,
  Medal,
  Megaphone,
  MonitorPlay,
  RadioTower,
  ServerCog,
  Target,
} from "lucide-vue-next";
import { e_player_roles_enum } from "~/generated/zeus";

// The one list of admin pages. The left nav's Admin list, ⌘K and the nav
// mode (which routes count as admin) all read it, so a page's label, icon,
// group, order and gate are set here once.

export type AdminGroupId =
  "competition" | "servers" | "media" | "monitoring" | "site";

/** Group order and labels, as the left nav shows them. */
export const ADMIN_GROUPS: ReadonlyArray<{
  id: AdminGroupId;
  labelKey: string;
}> = [
  { id: "competition", labelKey: "layouts.app_nav.competition.title" },
  { id: "servers", labelKey: "layouts.app_nav.administration.servers" },
  { id: "media", labelKey: "layouts.app_nav.groups.media" },
  { id: "monitoring", labelKey: "layouts.app_nav.groups.monitoring" },
  { id: "site", labelKey: "layouts.app_nav.groups.site" },
];

/** What the gates read: the signed-in role and the feature settings. */
export type AdminAccess = {
  above: (role: e_player_roles_enum) => boolean;
  canManageAwards: boolean;
  canGrantAwards: boolean;
  seasonsEnabled: boolean;
  gamePluginsEnabled: boolean;
  /** Fleet telemetry exists on 5stack.gg only. */
  fleetTelemetry: boolean;
};

export type AdminEntry = {
  id: string;
  /** Route name. */
  route: string;
  labelKey: string;
  icon: Component;
  /** Null: above the groups, unlabelled. */
  group: AdminGroupId | null;
  /** Lowest role that opens it; matches the page's middleware. */
  role?: e_player_roles_enum;
  /** A settings gate on top of the role. */
  feature?: (access: AdminAccess) => boolean;
  /** Every `<route>-*` child route is part of the page too. Children of a
   *  page without this (e.g. the public /awards/[id]) are not admin. */
  children?: boolean;
  /** Reached from elsewhere (search, a nav strip), not the Admin list. */
  hiddenInNav?: boolean;
  /** Extra search terms, e.g. a page's former name. */
  keywordKeys?: string[];
  order: number;
};

const admin = e_player_roles_enum.administrator;

const ENTRIES: AdminEntry[] = [
  {
    id: "overview",
    route: "admin",
    labelKey: "layouts.app_nav.administration.overview",
    icon: LayoutDashboard,
    group: null,
    role: admin,
    children: true,
    order: 0,
  },
  {
    id: "awards",
    route: "awards",
    labelKey: "layouts.app_nav.administration.awards",
    icon: Medal,
    group: "competition",
    feature: (access) => access.canManageAwards || access.canGrantAwards,
    order: 10,
  },
  {
    id: "seasons",
    route: "seasons",
    labelKey: "layouts.app_nav.administration.seasons",
    icon: Leaf,
    group: "competition",
    role: admin,
    feature: (access) => access.seasonsEnabled,
    order: 20,
  },
  {
    id: "game-server-nodes",
    route: "game-server-nodes",
    labelKey: "layouts.app_nav.administration.game_server_nodes",
    icon: ServerCog,
    group: "servers",
    role: admin,
    children: true,
    order: 30,
  },
  {
    id: "dedicated-servers",
    route: "dedicated-servers",
    labelKey: "layouts.app_nav.administration.dedicated_servers",
    icon: HardDrive,
    group: "servers",
    role: admin,
    children: true,
    order: 40,
  },
  {
    id: "practice-servers",
    route: "practice-servers",
    labelKey: "layouts.app_nav.administration.practice_servers",
    icon: Target,
    group: "servers",
    role: e_player_roles_enum.moderator,
    order: 45,
  },
  {
    id: "gpu-nodes",
    route: "gpu-nodes",
    labelKey: "layouts.app_nav.administration.gpu_nodes",
    icon: Cpu,
    group: "servers",
    role: admin,
    order: 50,
  },
  // Last of the servers: the geography they belong to, set up rather than run.
  {
    id: "regions",
    route: "regions",
    labelKey: "layouts.app_nav.administration.regions",
    icon: Globe,
    group: "servers",
    role: admin,
    order: 60,
  },
  {
    id: "control-room",
    route: "stream-deck",
    labelKey: "layouts.app_nav.administration.control_room",
    icon: MonitorPlay,
    group: "media",
    role: e_player_roles_enum.streamer,
    children: true,
    keywordKeys: ["layouts.app_nav.administration.stream_deck"],
    order: 70,
  },
  {
    id: "media-server",
    route: "system-media-server",
    labelKey: "layouts.app_nav.system.media_server",
    icon: RadioTower,
    group: "media",
    role: admin,
    order: 80,
  },
  {
    id: "render-queue",
    route: "system-render-queue",
    labelKey: "layouts.app_nav.system.render_queue",
    icon: ListVideo,
    group: "media",
    role: admin,
    order: 90,
  },
  {
    id: "metrics",
    route: "system-metrics",
    labelKey: "layouts.app_nav.system.metrics",
    icon: LineChart,
    group: "monitoring",
    role: admin,
    order: 100,
  },
  {
    id: "logs",
    route: "system-logs",
    labelKey: "layouts.app_nav.system.logs",
    icon: Logs,
    group: "monitoring",
    role: admin,
    order: 110,
  },
  {
    id: "database",
    route: "database",
    labelKey: "layouts.app_nav.system.database",
    icon: Database,
    group: "monitoring",
    role: admin,
    order: 120,
  },
  // The nav reaches it from the "systems online" strip under the lists.
  {
    id: "fleet-telemetry",
    route: "fleet-telemetry",
    labelKey: "pages.system_telemetry.title",
    icon: Activity,
    group: "monitoring",
    role: admin,
    feature: (access) => access.fleetTelemetry,
    hiddenInNav: true,
    order: 130,
  },
  {
    id: "alerts",
    route: "system-alerts",
    labelKey: "layouts.app_nav.administration.alerts",
    icon: Megaphone,
    group: "site",
    role: admin,
    order: 140,
  },
  {
    id: "plugins",
    route: "plugins",
    labelKey: "layouts.app_nav.platform.plugin_directory",
    icon: LibraryBig,
    group: "site",
    role: admin,
    feature: (access) => access.gamePluginsEnabled,
    children: true,
    order: 150,
  },
  // Always the last thing in the list.
  {
    id: "app-settings",
    route: "settings-application",
    labelKey: "layouts.app_nav.administration.app_settings",
    icon: Cog,
    group: "site",
    role: admin,
    children: true,
    order: 160,
  },
];

export const ADMIN_ENTRIES: readonly AdminEntry[] = [...ENTRIES].sort(
  (a, b) => a.order - b.order,
);

/** A group's label key; ungrouped entries read as "Administration". */
export function adminGroupLabelKey(group: AdminGroupId | null): string {
  return (
    ADMIN_GROUPS.find((entry) => entry.id === group)?.labelKey ??
    "layouts.app_nav.administration.title"
  );
}

/** The admin page a route belongs to, if any; ignores gates. */
export function adminEntryForRoute(name: unknown): AdminEntry | undefined {
  if (typeof name !== "string") {
    return undefined;
  }
  return ADMIN_ENTRIES.find(
    (entry) =>
      name === entry.route ||
      (!!entry.children && name.startsWith(`${entry.route}-`)),
  );
}

export function canOpenAdminEntry(entry: AdminEntry, access: AdminAccess) {
  return (
    (!entry.role || access.above(entry.role)) &&
    (!entry.feature || entry.feature(access))
  );
}

/**
 * The entries `access` opens, in order. `nav` leaves out the ones the Admin
 * list doesn't show; `hasRoute` drops pages this build doesn't have yet.
 */
export function visibleAdminEntries(
  access: AdminAccess,
  options: { nav?: boolean; hasRoute?: (name: string) => boolean } = {},
): AdminEntry[] {
  return ADMIN_ENTRIES.filter(
    (entry) =>
      canOpenAdminEntry(entry, access) &&
      !(options.nav && entry.hiddenInNav) &&
      (!options.hasRoute || options.hasRoute(entry.route)),
  );
}

/** Entries by group, groups in nav order; ungrouped entries lead. */
export function groupAdminEntries(entries: readonly AdminEntry[]) {
  const groups: Array<{
    id: AdminGroupId | null;
    labelKey: string | null;
    entries: AdminEntry[];
  }> = [];
  const lead = entries.filter((entry) => !entry.group);
  if (lead.length) {
    groups.push({ id: null, labelKey: null, entries: lead });
  }
  for (const group of ADMIN_GROUPS) {
    const members = entries.filter((entry) => entry.group === group.id);
    if (members.length) {
      groups.push({ id: group.id, labelKey: group.labelKey, entries: members });
    }
  }
  return groups;
}

/** The signed-in player's access, read from the stores (reactive in a computed). */
export function adminAccess(): AdminAccess {
  const auth = useAuthStore();
  const settings = useApplicationSettingsStore();
  return {
    above: (role) => !!auth.me && auth.isRoleAbove(role),
    canManageAwards: settings.canManageAwards,
    canGrantAwards: settings.canGrantAwards,
    seasonsEnabled: settings.seasonsEnabled,
    gamePluginsEnabled: settings.gamePluginsEnabled,
    fleetTelemetry: useRuntimeConfig().public.webDomain === "5stack.gg",
  };
}

/** The admin pages the signed-in player can open, in nav order. */
export function useAdminEntries(options: { nav?: boolean } = {}) {
  const router = useRouter();
  return computed(() =>
    visibleAdminEntries(adminAccess(), {
      nav: options.nav,
      hasRoute: (name) => router.hasRoute(name),
    }),
  );
}
