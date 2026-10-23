<script setup lang="ts">
import { h, type FunctionalComponent } from "vue";
import {
  ChevronsUpDownIcon,
  ChevronRight,
  Server,
  List,
  ShieldHalf,
  ShieldX,
  Users,
  Home,
  Search,
  Swords,
  Film,
  Newspaper,
  AlertTriangle,
  CalendarRange,
  Gamepad2,
  ShieldCheck,
  Crosshair,
  Tv,
  Shield,
  CircleHelp,
  LayoutGrid,
  Target,
  MonitorPlay,
} from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { SlideSwap } from "~/components/ui/transitions";
import LeftNavLink from "~/layouts/components/LeftNavLink.vue";
import LeftNavSection from "~/layouts/components/LeftNavSection.vue";
import LeftNavDoors from "~/layouts/components/LeftNavDoors.vue";
import LeftNavPins from "~/layouts/components/LeftNavPins.vue";
import LeftNavBanner from "~/layouts/components/LeftNavBanner.vue";
import {
  adminEntryForRoute as adminEntryFor,
  useAdminEntries,
} from "~/composables/adminEntries";
import type {
  LeftNavItem,
  LeftNavSectionData,
} from "~/layouts/components/leftNav";
import { useLeftNavState } from "~/composables/useLeftNavState";
import { rememberNavMarker } from "~/composables/useLeftNavMarker";
import { usePublicServersListed } from "~/composables/usePublicServersListed";
import { placeApps } from "~/utilities/leftNavApps";
import { signInWithSteam } from "~/utilities/loginLinks";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import type { Plugin } from "~/stores/Plugins";
import { useNavMode } from "~/composables/useNavMode";
import BracketIcon from "~/components/icons/BracketIcon.vue";
import LineupIcon from "~/components/icons/LineupIcon.vue";
import PodiumIcon from "~/components/icons/PodiumIcon.vue";
import PluginIcon from "~/components/plugins/PluginIcon.vue";
import InstallPWA from "~/components/InstallPWA.vue";
import ProfileMenu from "~/layouts/components/ProfileMenu.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { DiscordLogoIcon, GithubLogoIcon } from "@radix-icons/vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerPendingImports from "~/components/PlayerPendingImports.vue";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import Logout from "./Logout.vue";
import { useMatchContext } from "~/composables/useMatchContext";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { useAuthStore } from "~/stores/AuthStore";
import { useGlobalSearchOpen } from "~/composables/useGlobalSearchOpen";

const { setOpenMobile, isMobile } = useSidebar();
const globalSearchOpen = useGlobalSearchOpen();
const route = useRoute();
const authStore = useAuthStore();
const {
  currentSeasonTo: currentLeagueSeasonTo,
  currentSeason: currentLeagueSeason,
} = useCurrentLeagueSeason();
const hasLeagueSeason = computed(() => !!currentLeagueSeason.value);

// Same rule as the top nav: an empty view-only section stays hidden from
// anyone who can't add to it.
const applicationSettings = useApplicationSettingsStore();
const { hasContent } = useSiteContent();
const showTournamentsLink = computed(
  () =>
    hasContent("tournaments") ||
    (!!authStore.me &&
      authStore.isRoleAbove(applicationSettings.tournamentCreateRole)),
);
const showEventsLink = computed(
  () =>
    applicationSettings.eventsEnabled &&
    (hasContent("events") ||
      (!!authStore.me &&
        authStore.isRoleAbove(applicationSettings.eventCreateRole))),
);
const showNewsLink = computed(
  () =>
    applicationSettings.newsEnabled &&
    (hasContent("news") || applicationSettings.canPostNews),
);
const showHighlightsLink = computed(() => hasContent("highlights"));
const { pendingImports: pendingMatchImports } = usePendingImports();
const matchContext = useMatchContext();
const logoPath = computed(() => (authStore.me ? "/me" : "/watch"));
const isLogoRouteActive = computed(() => {
  if (logoPath.value === "/me") {
    return (
      route.path === "/me" ||
      (route.path.startsWith("/players/") &&
        String(route.params.id) === String(authStore.me?.steam_id))
    );
  }

  return route.path === logoPath.value;
});
const { t } = useI18n();
const matchLobbyStore = useMatchLobbyStore();
const pluginsStore = usePluginsStore();
const renderQueueStatus = useRenderQueueStatusStore();
const { listed: publicServersListed } = usePublicServersListed();
const { pins, setOpen } = useLeftNavState();

const isNamed = (name: string) => {
  const current = String(route.name ?? "");
  return current === name || current.startsWith(`${name}-`);
};

// Play and Watch are the two doors at the top. Below them four sections fold
// on their own: organised competition, practice, media and the community.
const appItem = (plugin: Plugin): LeftNavItem => ({
  key: `app:${plugin.slug}`,
  label: plugin.title,
  icon: pluginIcon(plugin.icon),
  to: `/apps/${plugin.slug}`,
  // A plugin owns every route under its slug.
  active:
    route.path === `/apps/${plugin.slug}` ||
    route.path.startsWith(`/apps/${plugin.slug}/`),
});

const doors = computed<LeftNavItem[]>(() => [
  {
    key: "play",
    label: t("layouts.app_nav.navigation.play"),
    icon: Crosshair,
    to: { name: "play" },
    active: isNamed("play"),
  },
  {
    key: "watch",
    label: t("layouts.app_nav.navigation.watch"),
    icon: Tv,
    to: { name: "watch" },
    active: isNamed("watch"),
    badge: matchLobbyStore.liveMatchesCount || undefined,
    badgeTone: "live",
  },
  // A featured app sits with them, after Watch.
  ...pluginsStore.visiblePlugins
    .filter((plugin) => plugin.nav_featured)
    .map(appItem),
]);

const builtInSections = computed<LeftNavSectionData[]>(() => {
  const activeTournaments =
    matchLobbyStore.liveTournamentsCount +
    matchLobbyStore.openRegistrationTournamentsCount;
  const compete: LeftNavItem[] = [];
  if (showTournamentsLink.value) {
    compete.push({
      key: "tournaments",
      label: t("layouts.app_nav.navigation.tournaments"),
      icon: BracketIcon,
      to: { name: "tournaments" },
      active: isNamed("tournaments") || matchContext?.value?.tournament != null,
      badge: activeTournaments || undefined,
    });
  }
  if (
    applicationSettings.leaguesEnabled &&
    (hasLeagueSeason.value || authStore.isAdmin)
  ) {
    compete.push({
      key: "league",
      label: t("layouts.app_nav.navigation.leagues"),
      icon: Shield,
      to: currentLeagueSeasonTo.value,
      active: isNamed("league"),
    });
  }
  if (showEventsLink.value) {
    compete.push({
      key: "events",
      label: t("layouts.app_nav.navigation.events"),
      icon: CalendarRange,
      to: { name: "events" },
      active: isNamed("events"),
    });
  }

  const practice: LeftNavItem[] = [
    {
      key: "utility",
      label: t("layouts.app_nav.navigation.utility"),
      icon: LineupIcon,
      to: { name: "utility" },
      active: isNamed("utility"),
    },
  ];
  if (
    publicServersListed.value ||
    authStore.isRoleAbove(e_player_roles_enum.moderator)
  ) {
    practice.push({
      key: "public-servers",
      label: t("layouts.app_nav.navigation.public_servers"),
      icon: Server,
      to: { name: "public-servers" },
      active: isNamed("public-servers"),
    });
  }
  if (applicationSettings.scrimFinderEnabled) {
    practice.push({
      key: "scrims",
      label: t("layouts.app_nav.navigation.scrims"),
      icon: Swords,
      to: { name: "scrims" },
      active: isNamed("scrims"),
    });
  }

  const media: LeftNavItem[] = [
    {
      key: "matches",
      label: t("layouts.app_nav.navigation.matches"),
      icon: List,
      to: { name: "matches" },
      active: isNamed("matches"),
      badge: matchLobbyStore.managingMatchesCount || undefined,
    },
  ];
  if (showHighlightsLink.value) {
    media.push({
      key: "highlights",
      label: t("layouts.app_nav.navigation.highlights"),
      icon: Film,
      to: { name: "highlights" },
      active: isNamed("highlights"),
      badge: authStore.isAdmin
        ? renderQueueStatus.inFlightCount || undefined
        : undefined,
    });
  }
  if (showNewsLink.value) {
    media.push({
      key: "news",
      label:
        applicationSettings.newsLabel || t("layouts.app_nav.navigation.news"),
      icon: Newspaper,
      to: { name: "news" },
      active: isNamed("news"),
    });
  }

  const community: LeftNavItem[] = [
    {
      key: "players",
      label: t("layouts.app_nav.navigation.players"),
      icon: Users,
      to: { name: "players" },
      active: isNamed("players") && !route.path.startsWith("/me"),
    },
    {
      key: "teams",
      label: t("layouts.app_nav.navigation.teams"),
      icon: ShieldHalf,
      to: { name: "teams" },
      active: isNamed("teams"),
    },
    {
      key: "leaderboard",
      label: t("layouts.app_nav.navigation.leaderboard"),
      icon: PodiumIcon,
      to: { name: "leaderboard" },
      active: isNamed("leaderboard"),
    },
    {
      key: "bans",
      label: t("layouts.app_nav.navigation.bans"),
      icon: ShieldX,
      to: { name: "bans" },
      active: isNamed("bans"),
    },
  ];

  return [
    {
      id: "compete",
      label: t("layouts.app_nav.groups.compete"),
      icon: BracketIcon,
      items: compete,
    },
    {
      id: "practice",
      label: t("layouts.app_nav.groups.practice"),
      icon: Target,
      items: practice,
    },
    {
      id: "media",
      label: t("layouts.app_nav.groups.media"),
      icon: MonitorPlay,
      items: media,
    },
    {
      id: "community",
      label: t("layouts.app_nav.community.title"),
      icon: Users,
      items: community,
    },
  ];
});

const pluginIcons = new Map<string | null, FunctionalComponent>();
const pluginIcon = (name: string | null) => {
  if (!pluginIcons.has(name)) {
    pluginIcons.set(name, (_, { attrs }) => h(PluginIcon, { ...attrs, name }));
  }
  return pluginIcons.get(name)!;
};

// Apps join the section their nav group names, at the slot their nav order
// gives; see placeApps.
const navSections = computed<LeftNavSectionData[]>(() =>
  placeApps(
    builtInSections.value,
    pluginsStore.visiblePlugins.filter((plugin) => !plugin.nav_featured),
    appItem,
    t("layouts.app_nav.plugins.title"),
  )
    .map((section) => ({ icon: LayoutGrid, ...section }))
    .filter((section) => section.items.length > 0),
);

// Admin pages can be pinned too; they gather under their own label in Pinned.
const adminEntries = useAdminEntries({ nav: true });
const adminPinItems = computed<LeftNavItem[]>(() =>
  authStore.me
    ? adminEntries.value.map((entry) => ({
        key: `admin:${entry.id}`,
        label: t(entry.labelKey),
        icon: entry.icon,
        to: { name: entry.route },
        active: adminEntryFor(route.name) === entry,
      }))
    : [],
);
const pinsFrom = (items: LeftNavItem[]) =>
  pins.value
    .map((key) => items.find((item) => item.key === key))
    .filter((item): item is LeftNavItem => !!item);
const pinnedPages = computed(() =>
  pinsFrom(navSections.value.flatMap((section) => section.items)),
);
const pinnedAdmin = computed(() => pinsFrom(adminPinItems.value));

// Where the guide-line marker is before the nav shows a new page, so it can
// glide from there.
watch(() => route.path, rememberNavMarker, { flush: "pre" });

// Going to a page whose section is folded opens that section.
watch(
  () => route.path,
  () => {
    const section = navSections.value.find((entry) =>
      entry.items.some((item) => item.active),
    );
    if (section) {
      setOpen(section.id, true);
    }
  },
);

// The nav shows one list at a time: Play for the site, Admin for running it.
const {
  mode: navMode,
  setMode: setNavMode,
  toggle: toggleNavMode,
} = useNavMode();

// Collapsing switches Home | Search from a row to a stack in one layout
// change; play each button from where it was to where it lands as a
// transform (read before the patch, play after), so they glide instead of jump.
const { state: sidebarState } = useSidebar();
const homeEl = ref<HTMLElement | null>(null);
const searchEl = ref<HTMLElement | null>(null);
let headerRects: Array<DOMRect | undefined> | null = null;
watch(
  sidebarState,
  () => {
    headerRects = [homeEl.value, searchEl.value].map((el) =>
      el?.getBoundingClientRect(),
    );
  },
  { flush: "pre" },
);
watch(
  sidebarState,
  async () => {
    await nextTick();
    const rects = headerRects;
    headerRects = null;
    if (
      !rects ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    [homeEl.value, searchEl.value].forEach((el, index) => {
      const from = rects[index];
      if (!el || !from || typeof el.animate !== "function") {
        return;
      }
      const to = el.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        return;
      }
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: 240, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    });
  },
  { flush: "post" },
);

const swipeStartX = ref(0);
const swipeStartY = ref(0);
function onLeftNavTouchStart(e: TouchEvent) {
  if (!e.touches[0]) return;
  swipeStartX.value = e.touches[0].clientX;
  swipeStartY.value = e.touches[0].clientY;
}
function onLeftNavTouchEnd(e: TouchEvent) {
  if (!e.changedTouches[0] || !isMobile.value) return;
  const deltaX = e.changedTouches[0].clientX - swipeStartX.value;
  const deltaY = e.changedTouches[0].clientY - swipeStartY.value;
  if (deltaX > -50) return; // need swipe left (negative deltaX)
  if (Math.abs(deltaY) > Math.abs(deltaX) * 1.2) return; // prefer horizontal
  setOpenMobile(false);
}
</script>

<template>
  <Sidebar collapsible="icon">
    <div
      class="flex h-full w-full flex-col"
      @touchstart.passive="onLeftNavTouchStart"
      @touchend="onLeftNavTouchEnd"
    >
      <!-- Players and visitors get the brand across the top, which is also
           the home link; admins with the Play / Admin switch keep the compact
           Home | Search row. -->
      <LeftNavBanner
        v-if="!showNavModes && (isMobile || sideBarOpen)"
        :to="logoPath"
      />
      <SidebarContent>
        <SidebarGroup
          v-if="authStore.me || showNavModes || !(isMobile || sideBarOpen)"
        >
          <!-- Home | Search on one row; collapsed, they stack as icons. The
               buttons glide between the two layouts (see homeEl/searchEl).
               The stack pins left: centred, its target would drift while the
               sidebar's width is still animating. -->
          <div
            class="flex gap-1"
            :class="
              isMobile || sideBarOpen
                ? 'flex-row items-center'
                : 'flex-col items-start'
            "
          >
            <div
              v-if="showNavModes || !(isMobile || sideBarOpen)"
              ref="homeEl"
              class="shrink-0"
            >
              <SidebarMenuButton
                as-child
                class="w-8 justify-center px-0"
                :tooltip="$t('layouts.app_nav.navigation.home')"
              >
                <NuxtLink
                  :to="logoPath"
                  :class="{ 'router-link-active': isLogoRouteActive }"
                  :aria-label="$t('layouts.app_nav.navigation.home')"
                  :title="
                    isMobile || sideBarOpen
                      ? $t('layouts.app_nav.navigation.home')
                      : undefined
                  "
                >
                  <Home />
                </NuxtLink>
              </SidebarMenuButton>
            </div>
            <Separator
              v-if="authStore.me && showNavModes && (isMobile || sideBarOpen)"
              orientation="vertical"
              class="h-4 shrink-0"
            />
            <div
              v-if="authStore.me"
              ref="searchEl"
              class="min-w-0"
              :class="{ 'flex-1': isMobile || sideBarOpen }"
            >
              <SidebarMenuButton
                @click="
                  setOpenMobile(false);
                  globalSearchOpen = true;
                "
                :tooltip="$t('layouts.app_nav.navigation.search')"
              >
                <Search />
                <span>{{ $t("layouts.app_nav.navigation.search") }}</span>
                <KbdGroup class="ml-auto" v-if="isMobile || sideBarOpen">
                  <Kbd>{{ isMac ? "⌘" : "Ctrl" }}</Kbd>
                  <Kbd>K</Kbd>
                </KbdGroup>
              </SidebarMenuButton>
            </div>
          </div>

          <SidebarMenu>
            <!-- Collapsed to icons, the Play / Admin switch is one toggle. -->
            <SidebarMenuItem v-if="showNavModes && !(isMobile || sideBarOpen)">
              <SidebarMenuButton
                :tooltip="
                  navMode === 'admin'
                    ? $t('layouts.app_nav.modes.switch_to_play')
                    : $t('layouts.app_nav.modes.switch_to_admin')
                "
                class="relative"
                @click="toggleNavMode()"
              >
                <Gamepad2 v-if="navMode === 'admin'" />
                <ShieldCheck v-else />
                <span
                  v-if="navMode === 'play' && adminAttentionCount > 0"
                  class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[hsl(var(--tac-amber))]"
                  aria-hidden="true"
                ></span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <AnimatedFilters
            v-if="showNavModes && (isMobile || sideBarOpen)"
            class="mt-2"
            :model-value="navMode"
            :options="[
              {
                key: 'play',
                label: $t('layouts.app_nav.modes.play'),
                icon: Gamepad2,
              },
              {
                key: 'admin',
                label: $t('layouts.app_nav.modes.admin'),
                icon: ShieldCheck,
                count: adminAttentionCount || undefined,
                title:
                  adminAttentionCount > 0
                    ? $t(
                        'layouts.app_nav.modes.attention',
                        { count: adminAttentionCount },
                        adminAttentionCount,
                      )
                    : undefined,
              },
            ]"
            block
            square
            @update:model-value="setNavMode($event as 'play' | 'admin')"
          />
        </SidebarGroup>

        <!-- The lists pan the way the Play / Admin tab moved. -->
        <SlideSwap :index="showNavModes && navMode === 'admin' ? 1 : 0">
          <div v-if="navMode === 'play' || !showNavModes" key="play">
            <SidebarGroup v-if="!authStore.me">
              <div
                v-if="isMobile || sideBarOpen"
                class="rounded-lg bg-sidebar-accent/40 p-3 shadow-[0_0_0_1px_hsl(0_0%_100%/0.07)]"
              >
                <p class="text-[0.8rem] leading-snug text-muted-foreground">
                  {{ $t("layouts.app_nav.sign_in.prompt") }}
                </p>
                <button
                  type="button"
                  class="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-[linear-gradient(180deg,hsl(var(--tac-amber)/0.18),hsl(var(--tac-amber)/0.07))] text-[0.8rem] font-semibold text-foreground transition-[background-color,transform] duration-150 hover:bg-[hsl(var(--tac-amber)/0.12)] active:scale-[0.97]"
                  @click="signInWithSteam()"
                >
                  <SteamIcon class="h-3.5 w-3.5 fill-current" />
                  {{ $t("pages.play.matchmaking.sign_in") }}
                </button>
              </div>
              <SidebarMenu v-else>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    :tooltip="$t('pages.play.matchmaking.sign_in')"
                    class="text-[hsl(var(--tac-amber))]"
                    @click="signInWithSteam()"
                  >
                    <SteamIcon class="fill-current" />
                    <span>{{ $t("pages.play.matchmaking.sign_in") }}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <LeftNavDoors :doors="doors" :rail="!(isMobile || sideBarOpen)" />

            <LeftNavPins
              v-if="
                authStore.me &&
                (pinnedPages.length ||
                  pinnedAdmin.length ||
                  isMobile ||
                  sideBarOpen)
              "
              :items="pinnedPages"
              :admin-items="pinnedAdmin"
              :rail="!(isMobile || sideBarOpen)"
            />

            <template v-for="section in navSections" :key="section.id">
              <Separator
                v-if="!(isMobile || sideBarOpen)"
                class="mx-auto my-1 w-5"
              />
              <LeftNavSection
                :section="section"
                :rail="!(isMobile || sideBarOpen)"
                :pinnable="!!authStore.me"
              />
            </template>

            <!-- Below three admin pages a mode switch is noise (an organizer
                 with Awards and Control Room): they join this list as one
                 section, so its labels don't repeat Play's. -->
            <template v-if="!showNavModes && adminGroups.length">
              <Separator
                v-if="!(isMobile || sideBarOpen)"
                class="mx-auto my-1 w-5"
              />
              <LeftNavSection
                :section="{ ...adminSection, icon: ShieldCheck }"
                :rail="!(isMobile || sideBarOpen)"
                :pinnable="!!authStore.me"
              />
            </template>
          </div>

          <div v-else key="admin">
            <SidebarGroup
              v-if="adminAttentionCount > 0 && (isMobile || sideBarOpen)"
            >
              <p
                class="flex items-center gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.25)] bg-[hsl(var(--tac-amber)/0.06)] px-2.5 py-2 text-xs text-[hsl(var(--tac-amber))]"
              >
                <AlertTriangle class="h-3.5 w-3.5 shrink-0" />
                {{
                  $t(
                    "layouts.app_nav.modes.attention",
                    { count: adminAttentionCount },
                    adminAttentionCount,
                  )
                }}
              </p>
            </SidebarGroup>

            <SidebarGroup v-for="group in adminGroups" :key="group.key">
              <SidebarGroupLabel v-if="group.label">{{
                group.label
              }}</SidebarGroupLabel>
              <SidebarMenu>
                <LeftNavLink
                  v-for="item in group.items"
                  :key="item.key"
                  :to="item.to"
                  :icon="item.icon"
                  :label="item.label"
                  :active="item.active"
                  :badge="item.badge"
                  :warning="item.warning"
                  :pin-key="item.key"
                />
              </SidebarMenu>
            </SidebarGroup>
          </div>
        </SlideSwap>
      </SidebarContent>
      <!-- Pinned under the lists, whichever one is showing, as a band of its
           own: the scrolling list ends at its edge. -->
      <div class="shrink-0 border-t border-sidebar-border bg-background/40">
        <div
          v-if="(isMobile || sideBarOpen) && telemetryStats?.online > 0"
          class="px-2 pt-2"
        >
          <NuxtLink
            :to="{ name: 'fleet-telemetry' }"
            class="flex h-8 items-center gap-2 rounded-md border border-sidebar-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <span
              class="h-1.5 w-1.5 shrink-0 rounded-full bg-success"
              aria-hidden="true"
            ></span>
            <span class="min-w-0 flex-1 truncate tabular-nums">{{
              $t(
                "layouts.app_nav.systems_online",
                { count: telemetryStats.online },
                telemetryStats.online,
              )
            }}</span>
            <ChevronRight class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </NuxtLink>
        </div>
        <SidebarFooter class="gap-1.5">
          <!-- The issue tracker and Discord on the left; installing the app
               and help on the right. -->
          <div v-if="isMobile || sideBarOpen" class="flex items-center gap-0.5">
            <Button
              v-if="showReportIssue"
              as="a"
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground"
              :href="githubUrl"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="$t('layouts.app_nav.footer.report_issue')"
              :title="$t('layouts.app_nav.footer.report_issue')"
            >
              <GithubLogoIcon class="h-4 w-4" />
            </Button>
            <Button
              as="a"
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground"
              :href="inviteLink"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="$t('layouts.app_nav.footer.join_discord')"
              :title="$t('layouts.app_nav.footer.join_discord')"
            >
              <DiscordLogoIcon class="h-4 w-4" />
            </Button>
            <span class="flex-1"></span>
            <InstallPWA :is-menu-item="false" compact />
            <Button
              as-child
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground"
            >
              <NuxtLink
                to="/faq"
                :aria-label="$t('layouts.top_nav.support_menu')"
                :title="$t('layouts.top_nav.support_menu')"
              >
                <CircleHelp class="h-4 w-4" />
              </NuxtLink>
            </Button>
          </div>

          <SidebarMenu>
            <template v-if="!(isMobile || sideBarOpen)">
              <SidebarMenuItem v-if="showReportIssue">
                <SidebarMenuButton
                  as-child
                  :tooltip="$t('layouts.app_nav.tooltips.report_issue')"
                >
                  <a
                    :href="githubUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <GithubLogoIcon class="w-5 h-5" />
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  as-child
                  :tooltip="$t('layouts.app_nav.tooltips.join_discord')"
                >
                  <a
                    :href="inviteLink"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <DiscordLogoIcon class="w-5 h-5" />
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <InstallPWA />

              <SidebarMenuItem>
                <SidebarMenuButton
                  as-child
                  :tooltip="$t('layouts.top_nav.support_menu')"
                >
                  <NuxtLink
                    to="/faq"
                    class="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <CircleHelp class="w-5 h-5" />
                  </NuxtLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </template>

            <SidebarMenuItem v-if="authStore.me">
              <ProfileMenu
                v-model:open="profileOpened"
                :side="isMobile ? 'top' : 'right'"
                align="end"
                @logout="showLogoutModal = true"
              >
                <template #trigger>
                  <SidebarMenuButton
                    size="lg"
                    class="hover:!bg-transparent hover:!text-current active:!bg-transparent"
                    :class="{
                      'bg-sidebar-accent text-sidebar-accent-foreground':
                        profileOpened,
                    }"
                  >
                    <PlayerDisplay
                      :player="me"
                      :show-online="false"
                      :show-role="isMobile || sideBarOpen"
                      size="xs"
                    />

                    <PlayerPendingImports
                      v-if="(pendingMatchImports?.length ?? 0) > 0"
                      :imports="pendingMatchImports"
                    />
                    <ChevronsUpDownIcon class="ml-auto size-4" />
                  </SidebarMenuButton>
                </template>
              </ProfileMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </div>
      <SidebarRail />
    </div>
  </Sidebar>

  <Logout v-if="showLogoutModal" @update:open="showLogoutModal = $event" />
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import type { LeftNavItem as AdminNavItem } from "~/layouts/components/leftNav";
import {
  adminAccess,
  adminEntryForRoute,
  groupAdminEntries,
  visibleAdminEntries,
} from "~/composables/adminEntries";
export default {
  props: {
    isMobile: {
      type: Boolean,
      required: true,
    },
    sideBarOpen: {
      type: Boolean,
      required: true,
    },
  },
  data() {
    return {
      profileOpened: false,
      showLogoutModal: false,
    };
  },
  apollo: {
    telemetryStats: {
      query: generateQuery({
        telemetryStats: {
          online: true,
          __typename: true,
        },
      }),
      pollInterval: 60 * 1000,
      skip() {
        if (!this.me || this.me.role !== e_player_roles_enum.administrator) {
          return true;
        }

        return useRuntimeConfig().public.webDomain !== "5stack.gg";
      },
    },
    gpuPoolHealth: {
      query: generateQuery({
        game_server_nodes: [
          { where: { gpu: { _eq: true } } as any },
          { id: true },
        ],
        steam_accounts: [{}, { id: true }],
      }),
      pollInterval: 60 * 1000,
      update(this: any, data: any) {
        const nodes = (data?.game_server_nodes ?? []) as Array<{ id: string }>;
        const accounts = (data?.steam_accounts ?? []) as Array<{ id: string }>;
        return {
          nodes: nodes.length,
          pool: accounts.length,
          short: nodes.length > 0 && accounts.length < nodes.length,
        };
      },
      skip() {
        return !this.me || this.me.role !== e_player_roles_enum.administrator;
      },
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    // The Admin list, from adminEntries. An organizer typically gets Awards
    // (and Control Room) alone, admins get everything; players get none.
    adminGroups() {
      const extras: Record<
        string,
        { badge?: number; warning?: string | null }
      > = {
        seasons: {
          warning:
            this.seasonsRebuildCount > 0
              ? (this.$t("layouts.app_nav.modes.seasons_rebuild") as string)
              : null,
        },
        "gpu-nodes": {
          warning: this.gpuPoolNeedsAttention ? this.gpuPoolTooltip : null,
        },
        "control-room": { badge: this.activeStreamingMatchesCount },
        "render-queue": { badge: this.renderQueueInFlightCount },
      };
      const entries = visibleAdminEntries(adminAccess(), {
        nav: true,
        hasRoute: (name) => this.$router.hasRoute(name),
      });
      return groupAdminEntries(entries).map((group) => ({
        key: group.id ?? "lead",
        label: group.labelKey ? (this.$t(group.labelKey) as string) : "",
        items: group.entries.map((entry) => ({
          key: `admin:${entry.id}`,
          to: { name: entry.route },
          icon: entry.icon,
          label: this.$t(entry.labelKey) as string,
          active: adminEntryForRoute(this.$route.name) === entry,
          ...extras[entry.id],
        })),
      }));
    },
    // An organizer's one or two admin pages, as a section of the Play list.
    adminSection(): { id: string; label: string; items: AdminNavItem[] } {
      return {
        id: "admin",
        label: this.$t("layouts.app_nav.administration.title") as string,
        items: (this.adminGroups as Array<{ items: AdminNavItem[] }>).flatMap(
          (group) => group.items,
        ),
      };
    },
    // A Play / Admin switch for one or two pages is noise; below three they
    // join the Play list instead.
    showNavModes() {
      const count = (this.adminGroups as Array<{ items: unknown[] }>).reduce(
        (total, group) => total + group.items.length,
        0,
      );
      return count >= 3;
    },
    adminAttentionCount() {
      return (
        this.adminGroups as Array<{ items: Array<{ warning?: string | null }> }>
      )
        .flatMap((group) => group.items)
        .filter((entry) => entry.warning).length;
    },
    gpuPoolNeedsAttention() {
      const h = (this as any).gpuPoolHealth;
      if (!h || h.nodes === 0) {
        return false;
      }
      return h.pool === 0 || h.short;
    },
    gpuPoolTooltip(): string {
      const h = (this as any).gpuPoolHealth;
      if (!h) {
        return "";
      }
      if (h.pool === 0) {
        return this.$t(
          "pages.gpu_nodes.steam_pool.empty_warning_title",
        ) as string;
      }
      if (h.short) {
        return this.$t("pages.gpu_nodes.steam_pool.short_warning_title", {
          accounts: h.pool,
          nodes: h.nodes,
        }) as string;
      }
      return "";
    },
    seasonsRebuildCount() {
      return useNotificationStore().seasonRebuildCount;
    },
    showReportIssue() {
      return useApplicationSettingsStore().showReportIssue;
    },
    githubUrl() {
      return useApplicationSettingsStore().githubUrl;
    },
    isMac() {
      if (typeof navigator !== "undefined") {
        return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      }
      return false;
    },
    // TODO - move to global
    inviteLink() {
      return `https://${useRuntimeConfig().public.webDomain}/discord-invite`;
    },
    activeStreamingMatchesCount() {
      return useStreamerStore().activeStreamingMatchesCount;
    },
    renderQueueInFlightCount() {
      return useRenderQueueStatusStore().inFlightCount;
    },
  },
};
</script>
