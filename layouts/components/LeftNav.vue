<script setup lang="ts">
import {
  ChevronsUpDownIcon,
  Cog,
  LogOut,
  Logs,
  LineChart,
  Server,
  Play,
  Globe,
  Settings,
  CalendarCog,
  Camera,
  ShieldHalf,
  ChevronRight,
  Users,
  Radio,
  Home,
  Search,
  Database,
  Trophy,
  Swords,
  Film,
  Newspaper,
  ListVideo,
  AlertTriangle,
  Megaphone,
  Leaf,
  CalendarRange,
} from "lucide-vue-next";
import TournamentBracket from "~/components/icons/tournament-bracket.vue";
import PluginIcon from "~/components/plugins/PluginIcon.vue";
import InstallPWA from "~/components/InstallPWA.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { DiscordLogoIcon, GithubLogoIcon } from "@radix-icons/vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import PlayerPendingImports from "~/components/PlayerPendingImports.vue";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import Logout from "./Logout.vue";
import { useMatchContext } from "~/composables/useMatchContext";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { useAuthStore } from "~/stores/AuthStore";

const { setOpenMobile, isMobile } = useSidebar();
const route = useRoute();
const authStore = useAuthStore();
const {
  currentSeasonTo: currentLeagueSeasonTo,
  currentSeason: currentLeagueSeason,
} = useCurrentLeagueSeason();
const hasLeagueSeason = computed(() => !!currentLeagueSeason.value);
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
      <Transition
        enter-active-class="[transition:opacity_0.2s_ease,max-height_0.2s_ease,padding_0.2s_ease,margin_0.2s_ease] overflow-hidden"
        leave-active-class="[transition:opacity_0.2s_ease,max-height_0.2s_ease,padding_0.2s_ease,margin_0.2s_ease] overflow-hidden"
        enter-from-class="opacity-0 max-h-0 py-0 my-0"
        leave-to-class="opacity-0 max-h-0 py-0 my-0"
      >
        <SidebarHeader v-if="!isMobile && (!isPWA || !sideBarOpen)">
          <NuxtLink
            :to="logoPath"
            class="flex min-w-0 items-center overflow-hidden transition-[gap,padding] duration-200 ease-linear [&.router-link-active]:!bg-transparent [&.router-link-exact-active]:!bg-transparent"
            :class="{
              'gap-2 px-2 py-1.5': !isPWA && (isMobile || sideBarOpen),
              'pointer-events-none cursor-default': isLogoRouteActive,
            }"
            :tabindex="isLogoRouteActive ? -1 : undefined"
            :aria-current="isLogoRouteActive ? 'page' : undefined"
          >
            <NuxtImg
              class="shrink-0 rounded max-w-8 max-h-8"
              :src="customLogoUrl || '/favicon/64.png'"
            />
            <Transition
              mode="out-in"
              enter-active-class="[transition:opacity_0.15s_ease,max-width_0.2s_ease] overflow-hidden"
              leave-active-class="[transition:opacity_0.15s_ease,max-width_0.2s_ease] overflow-hidden"
              enter-from-class="opacity-0 max-w-0"
              leave-to-class="opacity-0 max-w-0"
              enter-to-class="max-w-48"
              leave-from-class="max-w-48"
            >
              <span
                v-if="!isPWA && (isMobile || sideBarOpen)"
                key="brand"
                class="font-semibold text-xlg truncate"
              >
                {{ customBrandName || $t("layouts.app_nav.brand") }}
              </span>
            </Transition>
          </NuxtLink>
        </SidebarHeader>
      </Transition>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem
              v-if="isPWA"
              :tooltip="$t('layouts.app_nav.tooltips.dashboard')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.tooltips.dashboard')"
              >
                <NuxtLink
                  to="/me"
                  :class="{
                    'router-link-active':
                      $route.path === '/me' ||
                      ($route.path.startsWith('/players/') &&
                        $route.params.id === me?.steam_id),
                  }"
                >
                  <Home />
                  {{ $t("layouts.app_nav.navigation.dashboard") }}
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem
              :tooltip="$t('layouts.app_nav.tooltips.search_players')"
            >
              <SidebarMenuButton
                @click="
                  setOpenMobile(false);
                  triggerSpotlightSearch();
                "
                :tooltip="$t('layouts.app_nav.tooltips.search_players')"
              >
                <Search />
                <span>{{ $t("layouts.app_nav.navigation.search") }}</span>
                <KbdGroup class="ml-auto" v-if="isMobile || sideBarOpen">
                  <Kbd>{{ isMac ? "⌘" : "Ctrl" }}</Kbd>
                  <Kbd>K</Kbd>
                </KbdGroup>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <Separator v-if="showSeparators" class="mx-4 w-auto" />

            <SidebarMenuItem
              v-if="isMobile && me && !isPWA"
              :tooltip="$t('layouts.app_nav.navigation.dashboard')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.navigation.dashboard')"
              >
                <NuxtLink
                  to="/me"
                  :class="{
                    'router-link-active':
                      $route.path === '/me' ||
                      ($route.path.startsWith('/players/') &&
                        $route.params.id === me?.steam_id),
                  }"
                >
                  <LineChart />
                  {{ $t("layouts.app_nav.navigation.dashboard") }}
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

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

                  <Badge size="sm" v-if="playTotalCount > 0" class="ml-auto">
                    {{ playTotalCount }}
                  </Badge>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem :tooltip="$t('layouts.app_nav.tooltips.watch')">
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

                  <Badge size="sm" v-if="liveMatchesCount > 0" class="ml-auto">
                    {{ liveMatchesCount }}
                  </Badge>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
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

            <SidebarMenuItem v-if="leaguesEnabled && hasLeagueSeason">
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

            <SidebarMenuItem v-if="eventsEnabled">
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
                v-for="page in group.pages"
                :key="page.id"
              >
                <SidebarMenuButton as-child :tooltip="page.title">
                  <NuxtLink
                    :to="`/apps/${page.slug}`"
                    :class="{
                      // Prefix match: a plugin owns every route under its slug,
                      // so its own sub-routes keep the nav entry lit.
                      'router-link-active':
                        $route.path === `/apps/${page.slug}` ||
                        $route.path.startsWith(`/apps/${page.slug}/`),
                    }"
                  >
                    <PluginIcon :name="page.icon" />
                    {{ page.title }}
                  </NuxtLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </template>

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

        <Separator v-if="showSeparators" class="mx-4 w-auto" />

        <SidebarGroup>
          <SidebarGroupLabel>{{
            $t("layouts.app_nav.social.title")
          }}</SidebarGroupLabel>

          <SidebarMenu>
            <SidebarMenuItem v-if="newsEnabled">
              <SidebarMenuButton
                as-child
                :tooltip="newsLabel || $t('layouts.app_nav.tooltips.news')"
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

            <SidebarMenuItem
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
          </SidebarMenu>
        </SidebarGroup>

        <Separator
          v-if="
            showSeparators &&
            (isAdmin || isMatchOrganizer || isTournamentOrganizer || isStreamer)
          "
          class="mx-4 w-auto"
        />

        <SidebarGroup
          v-if="
            isAdmin || isMatchOrganizer || isTournamentOrganizer || isStreamer
          "
        >
          <SidebarGroupLabel>{{
            $t("layouts.app_nav.administration.title")
          }}</SidebarGroupLabel>

          <SidebarMenu>
            <SidebarMenuItem
              v-if="isAdmin || isMatchOrganizer || isTournamentOrganizer"
              :tooltip="$t('layouts.app_nav.tooltips.manage_matches')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.tooltips.manage_matches')"
              >
                <NuxtLink
                  :to="{ name: 'matches' }"
                  :class="{
                    'router-link-active': isRouteActive('matches'),
                  }"
                >
                  <CalendarCog />
                  {{ $t("layouts.app_nav.administration.manage_matches") }}
                  <Badge size="sm" v-if="managingMatchesCount > 0">
                    {{ managingMatchesCount }}
                  </Badge>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem
              v-if="isTournamentOrganizer || isAdmin"
              :tooltip="$t('layouts.app_nav.tooltips.manage_tournaments')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.tooltips.manage_tournaments')"
              >
                <NuxtLink
                  :to="{ name: 'tournaments-manage' }"
                  :class="{
                    'router-link-active': isRouteActive('tournaments-manage'),
                  }"
                >
                  <TournamentBracket />
                  {{ $t("layouts.app_nav.administration.manage_tournaments") }}
                  <Badge size="sm" v-if="managingTournamentsCount > 0">
                    {{ managingTournamentsCount }}
                  </Badge>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem
              v-if="isAdmin && leaguesEnabled"
              :tooltip="$t('layouts.app_nav.tooltips.manage_league')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.tooltips.manage_league')"
              >
                <NuxtLink
                  :to="{ name: 'league' }"
                  :class="{
                    'router-link-active': isRouteActive('league'),
                  }"
                >
                  <Trophy />
                  {{ $t("layouts.app_nav.administration.manage_league") }}
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem
              v-if="(isTournamentOrganizer || isAdmin) && eventsEnabled"
              :tooltip="$t('layouts.app_nav.tooltips.manage_events')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.tooltips.manage_events')"
              >
                <NuxtLink
                  :to="{ name: 'events-manage' }"
                  :class="{
                    'router-link-active': isRouteActive('events-manage'),
                  }"
                >
                  <CalendarRange />
                  {{ $t("layouts.app_nav.administration.manage_events") }}
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem
              :tooltip="$t('layouts.app_nav.administration.stream_deck')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.administration.stream_deck')"
              >
                <NuxtLink
                  :to="{ name: 'stream-deck' }"
                  :class="{
                    'router-link-active': isRouteActive('stream-deck'),
                  }"
                >
                  <Camera />
                  {{ $t("layouts.app_nav.administration.stream_deck") }}
                  <Badge size="sm" v-if="activeStreamingMatchesCount > 0">
                    {{ activeStreamingMatchesCount }}
                  </Badge>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <template v-if="isAdmin">
              <SidebarMenuItem
                :tooltip="$t('layouts.app_nav.tooltips.regions')"
              >
                <SidebarMenuButton
                  as-child
                  :tooltip="$t('layouts.app_nav.tooltips.regions')"
                >
                  <NuxtLink
                    :to="{ name: 'regions' }"
                    :class="{
                      'router-link-active': isRouteActive('regions'),
                    }"
                  >
                    <Globe />
                    {{ $t("layouts.app_nav.administration.regions") }}
                  </NuxtLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <Collapsible
                as-child
                :default-open="true"
                v-slot="{ open }"
                v-if="isMobile || sideBarOpen"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger as-child>
                    <SidebarMenuButton
                      :tooltip="$t('layouts.app_nav.tooltips.servers')"
                    >
                      <Server />
                      <span>{{
                        $t("layouts.app_nav.administration.servers")
                      }}</span>
                      <ChevronRight
                        class="ml-auto transition-transform duration-200"
                        :class="{
                          'rotate-90': open,
                        }"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          as-child
                          :tooltip="
                            $t('layouts.app_nav.tooltips.dedicated_servers')
                          "
                        >
                          <NuxtLink
                            :to="{ name: 'dedicated-servers' }"
                            :class="{
                              'router-link-active':
                                isRouteActive('dedicated-servers'),
                            }"
                          >
                            {{
                              $t(
                                "layouts.app_nav.administration.dedicated_servers",
                              )
                            }}
                          </NuxtLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          as-child
                          :tooltip="
                            $t('layouts.app_nav.tooltips.game_server_nodes')
                          "
                        >
                          <NuxtLink
                            :to="{ name: 'game-server-nodes' }"
                            :class="{
                              'router-link-active':
                                isRouteActive('game-server-nodes'),
                            }"
                          >
                            {{
                              $t(
                                "layouts.app_nav.administration.game_server_nodes",
                              )
                            }}
                          </NuxtLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          as-child
                          :tooltip="
                            gpuPoolNeedsAttention
                              ? gpuPoolTooltip
                              : $t('layouts.app_nav.tooltips.gpu_nodes')
                          "
                        >
                          <NuxtLink
                            :to="{ name: 'gpu-nodes' }"
                            :class="{
                              'router-link-active': isRouteActive('gpu-nodes'),
                            }"
                            class="flex w-full items-center justify-between gap-2"
                          >
                            <span>
                              {{
                                $t("layouts.app_nav.administration.gpu_nodes")
                              }}
                            </span>
                            <AlertTriangle
                              v-if="gpuPoolNeedsAttention"
                              class="w-3.5 h-3.5 text-yellow-500 shrink-0"
                            />
                          </NuxtLink>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <SidebarMenuItem v-else>
                <DropdownMenu v-model:open="serversOpened">
                  <DropdownMenuTrigger as-child>
                    <SidebarMenuButton
                      :class="{
                        'bg-sidebar-accent text-sidebar-accent-foreground':
                          serversOpened,
                      }"
                    >
                      <Server />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                    :side="isMobile ? 'top' : 'right'"
                    align="end"
                    :side-offset="4"
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuItem class="flex gap-2" as-child>
                        <NuxtLink :to="{ name: 'dedicated-servers' }">
                          {{
                            $t(
                              "layouts.app_nav.administration.dedicated_servers",
                            )
                          }}
                        </NuxtLink>
                      </DropdownMenuItem>

                      <DropdownMenuItem class="flex gap-2" as-child>
                        <NuxtLink :to="{ name: 'game-server-nodes' }">
                          {{
                            $t(
                              "layouts.app_nav.administration.game_server_nodes",
                            )
                          }}
                        </NuxtLink>
                      </DropdownMenuItem>

                      <DropdownMenuItem class="flex gap-2" as-child>
                        <NuxtLink
                          :to="{ name: 'gpu-nodes' }"
                          class="flex w-full items-center justify-between gap-2"
                        >
                          <span>
                            {{ $t("layouts.app_nav.administration.gpu_nodes") }}
                          </span>
                          <AlertTriangle
                            v-if="gpuPoolNeedsAttention"
                            class="w-3.5 h-3.5 text-yellow-500 shrink-0"
                          />
                        </NuxtLink>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>

              <SidebarMenuItem :tooltip="$t('layouts.app_nav.tooltips.alerts')">
                <SidebarMenuButton
                  as-child
                  :tooltip="$t('layouts.app_nav.tooltips.alerts')"
                >
                  <NuxtLink
                    :to="{ name: 'system-alerts' }"
                    :class="{
                      'router-link-active': isRouteActive('system-alerts'),
                    }"
                  >
                    <Megaphone />
                    {{ $t("layouts.app_nav.administration.alerts") }}
                  </NuxtLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem
                v-if="isAdmin && seasonsEnabled"
                :tooltip="$t('layouts.app_nav.administration.seasons')"
              >
                <SidebarMenuButton
                  as-child
                  :tooltip="$t('layouts.app_nav.administration.seasons')"
                >
                  <NuxtLink
                    :to="{ name: 'seasons' }"
                    :class="{
                      'router-link-active': isRouteActive('seasons'),
                    }"
                  >
                    <Leaf />
                    {{ $t("layouts.app_nav.administration.seasons") }}
                    <AlertTriangle
                      v-if="seasonsRebuildCount > 0"
                      class="ml-auto h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]"
                    />
                  </NuxtLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem
                :tooltip="$t('layouts.app_nav.tooltips.app_settings')"
              >
                <SidebarMenuButton
                  as-child
                  :tooltip="$t('layouts.app_nav.tooltips.app_settings')"
                >
                  <NuxtLink
                    :to="{ name: 'settings-application' }"
                    :class="{
                      'router-link-active': isRouteActive(
                        'settings-application',
                      ),
                    }"
                  >
                    <Cog />
                    {{ $t("layouts.app_nav.administration.app_settings") }}
                  </NuxtLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </template>
          </SidebarMenu>
        </SidebarGroup>

        <Separator v-if="showSeparators && isAdmin" class="mx-4 w-auto" />

        <SidebarGroup v-if="isAdmin">
          <SidebarGroupLabel>{{
            $t("layouts.app_nav.system.title")
          }}</SidebarGroupLabel>

          <SidebarMenu>
            <SidebarMenuItem
              :tooltip="$t('layouts.app_nav.tooltips.system_logs')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.tooltips.system_logs')"
              >
                <NuxtLink
                  :to="{ name: 'system-logs' }"
                  :class="{
                    'router-link-active': isRouteActive('system-logs'),
                  }"
                >
                  <Logs />
                  {{ $t("layouts.app_nav.system.logs") }}
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem
              :tooltip="$t('layouts.app_nav.tooltips.system_metrics')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.tooltips.system_metrics')"
              >
                <NuxtLink
                  :to="{ name: 'system-metrics' }"
                  :class="{
                    'router-link-active': isRouteActive('system-metrics'),
                  }"
                >
                  <LineChart />
                  {{ $t("layouts.app_nav.system.metrics") }}
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem :tooltip="$t('layouts.app_nav.tooltips.database')">
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.tooltips.database')"
              >
                <NuxtLink
                  :to="{ name: 'database' }"
                  :class="{
                    'router-link-active': isRouteActive('database'),
                  }"
                >
                  <Database />
                  {{ $t("layouts.app_nav.system.database") }}
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem
              :tooltip="$t('layouts.app_nav.system.render_queue')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.system.render_queue')"
              >
                <NuxtLink
                  :to="{ name: 'system-render-queue' }"
                  :class="{
                    'router-link-active': isRouteActive('system-render-queue'),
                  }"
                >
                  <ListVideo />
                  {{ $t("layouts.app_nav.system.render_queue") }}

                  <Badge
                    size="sm"
                    v-if="renderQueueInFlightCount > 0"
                    class="ml-auto"
                  >
                    {{ renderQueueInFlightCount }}
                  </Badge>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup v-if="telemetryStats?.online > 0 && sideBarOpen">
          <Badge
            size="sm"
            variant="outline"
            class="p-2 flex items-center gap-2"
          >
            <Server class="w-3 h-3" />
            {{
              $t("layouts.app_nav.systems_online", telemetryStats.online, {
                count: telemetryStats.online,
              })
            }}
          </Badge>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem
            v-if="
              me?.role === e_player_roles_enum.administrator && showReportIssue
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
                {{ $t("layouts.app_nav.footer.report_issue") }}
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
                {{ $t("layouts.app_nav.footer.join_discord") }}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <InstallPWA />

          <SidebarMenuItem>
            <DropdownMenu v-model:open="profileOpened">
              <DropdownMenuTrigger as-child>
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
              </DropdownMenuTrigger>
              <DropdownMenuContent
                class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                :side="isMobile ? 'top' : 'right'"
                align="end"
                :side-offset="4"
              >
                <DropdownMenuGroup v-if="!isMobile && !sideBarOpen">
                  <DropdownMenuLabel class="font-normal">
                    <PlayerDisplay :player="me" :show-online="false" />
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuGroup>
                  <DropdownMenuItem class="flex gap-2" as-child>
                    <NuxtLink
                      :to="{ name: 'settings' }"
                      :class="{
                        'router-link-active': isRouteActive('settings'),
                      }"
                    >
                      <Settings class="size-4" />
                      {{ $t("layouts.app_nav.profile.my_account") }}
                    </NuxtLink>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  class="flex gap-2"
                  @click="showLogoutModal = true"
                >
                  <LogOut />
                  {{ $t("layouts.app_nav.profile.logout") }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
      serversOpened: false,
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
    triggerSpotlightSearch() {
      const event = new KeyboardEvent("keydown", {
        key: "k",
        metaKey: this.isMac,
        ctrlKey: !this.isMac,
        bubbles: true,
      });
      window.dispatchEvent(event);
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
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
    customLogoUrl() {
      const store = useApplicationSettingsStore();
      return store.logoUrl
        ? `https://${useRuntimeConfig().public.apiDomain}/branding/logo`
        : null;
    },
    customBrandName() {
      return useApplicationSettingsStore().brandName;
    },
    showSeparators() {
      return useApplicationSettingsStore().showSeparators;
    },
    newsEnabled() {
      return useApplicationSettingsStore().newsEnabled;
    },
    eventsEnabled() {
      return useApplicationSettingsStore().eventsEnabled;
    },
    pluginGroups() {
      // visiblePlugins arrive sorted by nav_order, so insertion order keeps both
      // the per-group page order and the group order (first appearance).
      const groups: Array<{ name: string | null; pages: Plugin[] }> = [];
      for (const page of usePluginsStore().visiblePlugins) {
        const name = page.nav_group || null;
        let group = groups.find((entry) => entry.name === name);
        if (!group) {
          group = { name, pages: [] };
          groups.push(group);
        }
        group.pages.push(page);
      }
      return groups;
    },
    seasonsEnabled() {
      return useApplicationSettingsStore().seasonsEnabled;
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
    isMatchOrganizer() {
      return useAuthStore().isMatchOrganizer;
    },
    isStreamer() {
      return useAuthStore().isStreamer;
    },
    isTournamentOrganizer() {
      return useAuthStore().isTournamentOrganizer;
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
    managingTournamentsCount() {
      return useMatchLobbyStore().managingTournamentsCount;
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
