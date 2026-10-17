<script setup lang="ts">
import {
  ChevronsUpDownIcon,
  ChevronRight,
  Server,
  Play,
  CalendarCog,
  ShieldHalf,
  Users,
  Radio,
  Home,
  Search,
  Trophy,
  Swords,
  Film,
  Newspaper,
  AlertTriangle,
  CalendarRange,
  Gamepad2,
  ShieldCheck,
} from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import { SlideSwap } from "~/components/ui/transitions";
import LeftNavLink from "~/layouts/components/LeftNavLink.vue";
import { useNavMode } from "~/composables/useNavMode";
import TournamentBracket from "~/components/icons/tournament-bracket.vue";
import HeGrenadeIcon from "~/components/icons/HeGrenadeIcon.vue";
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
      <SidebarContent>
        <SidebarGroup>
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
            <div ref="homeEl" class="shrink-0">
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
              v-if="isMobile || sideBarOpen"
              orientation="vertical"
              class="h-4 shrink-0"
            />
            <div
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
            <!-- The everyday doors first, then small groups by intent. -->
            <SidebarGroup>
              <SidebarMenu>
                <Separator v-if="showSeparators" class="mx-4 w-auto" />

                <SidebarMenuItem :tooltip="$t('layouts.app_nav.tooltips.play')">
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.tooltips.play')"
                  >
                    <NuxtLink
                      :to="{ name: 'play' }"
                      :class="{
                        'router-link-active': isRouteActive('play'),
                      }"
                    >
                      <Play />
                      {{ $t("layouts.app_nav.navigation.play") }}

                      <Badge
                        size="sm"
                        v-if="playTotalCount > 0"
                        class="ml-auto"
                      >
                        {{ playTotalCount }}
                      </Badge>
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem
                  :tooltip="$t('layouts.app_nav.tooltips.watch')"
                >
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.tooltips.watch')"
                  >
                    <NuxtLink
                      :to="{ name: 'watch' }"
                      :class="{
                        'router-link-active': isRouteActive('watch'),
                      }"
                    >
                      <Radio />
                      {{ $t("layouts.app_nav.navigation.watch") }}

                      <Badge
                        size="sm"
                        v-if="liveMatchesCount > 0"
                        class="ml-auto"
                      >
                        {{ liveMatchesCount }}
                      </Badge>
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.tooltips.matches')"
                  >
                    <NuxtLink
                      :to="{ name: 'matches' }"
                      :class="{
                        'router-link-active': isRouteActive('matches'),
                      }"
                    >
                      <CalendarCog />
                      {{ $t("layouts.app_nav.navigation.matches") }}
                      <Badge
                        size="sm"
                        v-if="managingMatchesCount > 0"
                        class="ml-auto"
                      >
                        {{ managingMatchesCount }}
                      </Badge>
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <Separator v-if="showSeparators" class="mx-4 w-auto" />
            <SidebarGroup>
              <SidebarGroupLabel>{{
                $t("layouts.app_nav.groups.compete")
              }}</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem v-if="showTournamentsLink">
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.tooltips.tournaments')"
                  >
                    <NuxtLink
                      :to="{ name: 'tournaments' }"
                      :class="{
                        'router-link-active':
                          isRouteActive('tournaments') ||
                          matchContext?.value?.tournament != null,
                      }"
                    >
                      <TournamentBracket />
                      {{ $t("layouts.app_nav.navigation.tournaments") }}
                      <Badge
                        size="sm"
                        v-if="activeTournamentsCount > 0"
                        class="ml-auto"
                      >
                        {{ activeTournamentsCount }}
                      </Badge>
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem
                  v-if="leaguesEnabled && (hasLeagueSeason || isAdmin)"
                >
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.tooltips.leagues')"
                  >
                    <NuxtLink
                      :to="currentLeagueSeasonTo"
                      :class="{
                        'router-link-active': isRouteActive('league'),
                      }"
                    >
                      <Trophy />
                      {{ $t("layouts.app_nav.navigation.leagues") }}
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem v-if="showEventsLink">
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.tooltips.events')"
                  >
                    <NuxtLink
                      :to="{ name: 'events' }"
                      :class="{
                        'router-link-active': isRouteActive('events'),
                      }"
                    >
                      <CalendarRange />
                      {{ $t("layouts.app_nav.navigation.events") }}
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.navigation.scrims')"
                  >
                    <NuxtLink
                      :to="{ name: 'scrims' }"
                      :class="{
                        'router-link-active': isRouteActive('scrims'),
                      }"
                    >
                      <Swords />
                      {{ $t("layouts.app_nav.navigation.scrims") }}
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <Separator v-if="showSeparators" class="mx-4 w-auto" />
            <SidebarGroup>
              <SidebarGroupLabel>{{
                $t("layouts.app_nav.groups.practice")
              }}</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem
                  :tooltip="$t('layouts.app_nav.tooltips.utility')"
                >
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.tooltips.utility')"
                  >
                    <NuxtLink
                      :to="{ name: 'utility' }"
                      :class="{
                        'router-link-active': isRouteActive('utility'),
                      }"
                    >
                      <HeGrenadeIcon class="size-4" />
                      {{ $t("layouts.app_nav.navigation.utility") }}
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.tooltips.public_servers')"
                  >
                    <NuxtLink
                      :to="{ name: 'public-servers' }"
                      :class="{
                        'router-link-active': isRouteActive('public-servers'),
                      }"
                    >
                      <Server />
                      {{ $t("layouts.app_nav.navigation.public_servers") }}
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <Separator v-if="showSeparators" class="mx-4 w-auto" />
            <SidebarGroup>
              <SidebarGroupLabel>{{
                $t("layouts.app_nav.community.title")
              }}</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.tooltips.players')"
                  >
                    <NuxtLink
                      :to="{ name: 'players' }"
                      :class="{
                        'router-link-active':
                          isRouteActive('players') &&
                          !$route.path.startsWith('/me'),
                      }"
                    >
                      <Users />
                      {{ $t("layouts.app_nav.navigation.players") }}
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.tooltips.teams')"
                  >
                    <NuxtLink
                      :to="{ name: 'teams' }"
                      :class="{
                        'router-link-active': isRouteActive('teams'),
                      }"
                    >
                      <ShieldHalf />
                      {{ $t("layouts.app_nav.navigation.teams") }}
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    as-child
                    :tooltip="$t('layouts.app_nav.tooltips.leaderboard')"
                  >
                    <NuxtLink
                      :to="{ name: 'leaderboard' }"
                      :class="{
                        'router-link-active': isRouteActive('leaderboard'),
                      }"
                    >
                      <Trophy />
                      {{ $t("layouts.app_nav.navigation.leaderboard") }}
                    </NuxtLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <template v-if="showNewsLink || showHighlightsLink">
              <Separator v-if="showSeparators" class="mx-4 w-auto" />
              <SidebarGroup>
                <SidebarGroupLabel>{{
                  $t("layouts.app_nav.groups.media")
                }}</SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem
                    v-if="showHighlightsLink"
                    :tooltip="$t('layouts.app_nav.navigation.highlights')"
                  >
                    <SidebarMenuButton
                      as-child
                      :tooltip="$t('layouts.app_nav.navigation.highlights')"
                    >
                      <NuxtLink
                        :to="{ name: 'highlights' }"
                        :class="{
                          'router-link-active': isRouteActive('highlights'),
                        }"
                      >
                        <Film />
                        {{ $t("layouts.app_nav.navigation.highlights") }}

                        <Badge
                          size="sm"
                          v-if="isAdmin && renderQueueInFlightCount > 0"
                          class="ml-auto"
                        >
                          {{ renderQueueInFlightCount }}
                        </Badge>
                      </NuxtLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem v-if="showNewsLink">
                    <SidebarMenuButton
                      as-child
                      :tooltip="
                        newsLabel || $t('layouts.app_nav.tooltips.news')
                      "
                    >
                      <NuxtLink
                        :to="{ name: 'news' }"
                        :class="{
                          'router-link-active': isRouteActive('news'),
                        }"
                      >
                        <Newspaper />
                        {{ newsLabel || $t("layouts.app_nav.navigation.news") }}
                      </NuxtLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            </template>

            <template v-if="pluginGroups.length > 0">
              <Separator v-if="showSeparators" class="mx-4 w-auto" />

              <SidebarGroup
                v-for="group in pluginGroups"
                :key="group.name ?? 'apps'"
              >
                <SidebarGroupLabel>{{
                  group.name || $t("layouts.app_nav.plugins.title")
                }}</SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem
                    v-for="plugin in group.plugins"
                    :key="plugin.id"
                  >
                    <SidebarMenuButton as-child :tooltip="plugin.title">
                      <NuxtLink
                        :to="`/apps/${plugin.slug}`"
                        :class="{
                          // Prefix match: a plugin owns every route under its slug,
                          // so its own sub-routes keep the nav entry lit.
                          'router-link-active':
                            $route.path === `/apps/${plugin.slug}` ||
                            $route.path.startsWith(`/apps/${plugin.slug}/`),
                        }"
                      >
                        <PluginIcon :name="plugin.icon" class="size-4" />
                        {{ plugin.title }}
                      </NuxtLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            </template>

            <!-- Below three admin pages a mode switch is noise (an
                   organizer with Awards and Control Room): they join this
                   list as one group, so its labels don't repeat Play's. -->
            <SidebarGroup v-if="!showNavModes && adminGroups.length">
              <Separator v-if="showSeparators" class="mx-4 mb-2 w-auto" />
              <SidebarGroupLabel>{{
                $t("layouts.app_nav.administration.title")
              }}</SidebarGroupLabel>
              <SidebarMenu>
                <LeftNavLink
                  v-for="item in adminGroups.flatMap((group) => group.items)"
                  :key="item.key"
                  :to="item.to"
                  :icon="item.icon"
                  :label="item.label"
                  :active="item.active"
                  :badge="item.badge"
                  :warning="item.warning"
                />
              </SidebarMenu>
            </SidebarGroup>
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
                />
              </SidebarMenu>
            </SidebarGroup>
          </div>
        </SlideSwap>
      </SidebarContent>
      <!-- Pinned under the lists, whichever one is showing: the fleet status,
           then the install prompt. Collapses away when neither applies. -->
      <div
        v-if="isMobile || sideBarOpen"
        class="grid shrink-0 gap-2 px-2 pb-2 empty:hidden"
      >
        <NuxtLink
          v-if="telemetryStats?.online > 0"
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
        <InstallPWA :is-menu-item="false" framed />
      </div>
      <SidebarFooter class="gap-1.5 border-t border-sidebar-border">
        <!-- Expanded, the two outside links share one row, each labelled. -->
        <div
          v-if="isMobile || sideBarOpen"
          class="grid auto-cols-fr grid-flow-col gap-1"
        >
          <Button
            v-if="
              me?.role === e_player_roles_enum.administrator && showReportIssue
            "
            as="a"
            variant="ghost"
            size="sm"
            class="min-w-0 gap-2 text-muted-foreground"
            :href="githubUrl"
            target="_blank"
            rel="noopener noreferrer"
            :title="$t('layouts.app_nav.footer.report_issue')"
          >
            <GithubLogoIcon class="h-4 w-4 shrink-0" />
            <span class="truncate">{{
              $t("layouts.app_nav.footer.report_issue_short")
            }}</span>
          </Button>
          <Button
            as="a"
            variant="ghost"
            size="sm"
            class="min-w-0 gap-2 text-muted-foreground"
            :href="inviteLink"
            target="_blank"
            rel="noopener noreferrer"
            :title="$t('layouts.app_nav.footer.join_discord')"
          >
            <DiscordLogoIcon class="h-4 w-4 shrink-0" />
            <span class="truncate">{{
              $t("layouts.app_nav.footer.discord")
            }}</span>
          </Button>
        </div>

        <SidebarMenu>
          <template v-if="!(isMobile || sideBarOpen)">
            <SidebarMenuItem
              v-if="
                me?.role === e_player_roles_enum.administrator &&
                showReportIssue
              "
            >
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
          </template>

          <SidebarMenuItem>
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
      <SidebarRail />
    </div>
  </Sidebar>

  <Logout v-if="showLogoutModal" @update:open="showLogoutModal = $event" />
</template>

<script lang="ts">
import { generateQuery } from "~/graphql/graphqlGen";
import type { Plugin } from "~/stores/Plugins";
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
  methods: {
    isRouteActive(route: string) {
      const name = this.$route.name as string;
      return name === route || name?.startsWith(`${route}-`);
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    // The Admin list, from adminEntries. Only match organizers and up see the
    // left nav at all; an organizer typically gets Awards (and Control Room)
    // alone, admins get everything.
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
          key: entry.id,
          to: { name: entry.route },
          icon: entry.icon,
          label: this.$t(entry.labelKey) as string,
          active: adminEntryForRoute(this.$route.name) === entry,
          ...extras[entry.id],
        })),
      }));
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
    showSeparators() {
      return useApplicationSettingsStore().showSeparators;
    },
    eventsEnabled() {
      return useApplicationSettingsStore().eventsEnabled;
    },
    pluginGroups() {
      // visiblePlugins arrive sorted by nav_order, so insertion order keeps both
      // the per-group plugin order and the group order (first appearance).
      const groups: Array<{ name: string | null; plugins: Plugin[] }> = [];
      for (const plugin of usePluginsStore().visiblePlugins) {
        const name = plugin.nav_group || null;
        let group = groups.find((entry) => entry.name === name);
        if (!group) {
          group = { name, plugins: [] };
          groups.push(group);
        }
        group.plugins.push(plugin);
      }
      return groups;
    },
    leaguesEnabled() {
      return useApplicationSettingsStore().leaguesEnabled;
    },
    seasonsRebuildCount() {
      return useNotificationStore().seasonRebuildCount;
    },
    newsLabel() {
      return useApplicationSettingsStore().newsLabel;
    },
    showReportIssue() {
      return useApplicationSettingsStore().showReportIssue;
    },
    githubUrl() {
      return useApplicationSettingsStore().githubUrl;
    },
    isPWA() {
      return window.matchMedia("(display-mode: standalone)").matches;
    },
    isMac() {
      if (typeof navigator !== "undefined") {
        return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      }
      return false;
    },
    myMatches() {
      return useMatchLobbyStore().myMatches;
    },
    isAdmin() {
      return useAuthStore().isAdmin;
    },
    // TODO - move to global
    inviteLink() {
      return `https://${useRuntimeConfig().public.webDomain}/discord-invite`;
    },
    managingMatchesCount() {
      return useMatchLobbyStore().managingMatchesCount;
    },
    activeStreamingMatchesCount() {
      return useStreamerStore().activeStreamingMatchesCount;
    },
    liveMatchesCount() {
      return useMatchLobbyStore().liveMatchesCount;
    },
    renderQueueInFlightCount() {
      return useRenderQueueStatusStore().inFlightCount;
    },
    activeTournamentsCount() {
      const store = useMatchLobbyStore();
      return (
        store.liveTournamentsCount + store.openRegistrationTournamentsCount
      );
    },
    playTotalCount() {
      return this.myMatches.length + this.activeTournamentsCount;
    },
  },
};
</script>
