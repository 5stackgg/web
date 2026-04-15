<script setup lang="ts">
import {
  ChevronsUpDownIcon,
  Cog,
  LogOutIcon,
  Logs,
  LineChart,
  Server,
  Play,
  Globe,
  Settings,
  CalendarCog,
  ShieldHalf,
  ChevronRight,
  Users,
  Radio,
  Home,
  Search,
  Database,
  Trophy,
} from "lucide-vue-next";
import TournamentBracket from "~/components/icons/tournament-bracket.vue";
import InstallPWA from "~/components/InstallPWA.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { DiscordLogoIcon, GithubLogoIcon } from "@radix-icons/vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import Logout from "./Logout.vue";
import { useMatchContext } from "~/composables/useMatchContext";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { useAuthStore } from "~/stores/AuthStore";

const { setOpenMobile, isMobile } = useSidebar();
const route = useRoute();
const authStore = useAuthStore();
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
      <Transition name="sidebar-header">
        <SidebarHeader v-if="isMobile || !isPWA || !sideBarOpen">
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
            <Transition name="sidebar-brand" mode="out-in">
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

            <SidebarMenuItem :tooltip="$t('layouts.app_nav.tooltips.search_players')">
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
                      useMatchContext().value?.tournament != null,
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

        <Separator
          v-if="
            showSeparators &&
            (isAdmin || isMatchOrganizer || isTournamentOrganizer)
          "
          class="mx-4 w-auto"
        />

        <SidebarGroup
          v-if="isAdmin || isMatchOrganizer || isTournamentOrganizer"
        >
          <SidebarGroupLabel>{{
            $t("layouts.app_nav.administration.title")
          }}</SidebarGroupLabel>

          <SidebarMenu>
            <SidebarMenuItem
              :tooltip="$t('layouts.app_nav.tooltips.manage_matches')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.tooltips.manage_matches')"
              >
                <NuxtLink
                  :to="{ name: 'manage-matches' }"
                  :class="{
                    'router-link-active': isRouteActive('manage-matches'),
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
                      <DropdownMenuItem
                        class="flex gap-2 cursor-pointer"
                        as-child
                      >
                        <NuxtLink :to="{ name: 'dedicated-servers' }">
                          {{
                            $t(
                              "layouts.app_nav.administration.dedicated_servers",
                            )
                          }}
                        </NuxtLink>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        class="flex gap-2 cursor-pointer"
                        as-child
                      >
                        <NuxtLink :to="{ name: 'game-server-nodes' }">
                          {{
                            $t(
                              "layouts.app_nav.administration.game_server_nodes",
                            )
                          }}
                        </NuxtLink>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
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
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup v-if="telemetryStats?.online > 0 && sideBarOpen">
          <Badge
            size="sm"
            variant="outline"
            class="p-2 flex items-center gap-2"
          >
            <Server class="w-3 h-3" />
            {{ $t("layouts.app_nav.systems_online", telemetryStats.online, { count: telemetryStats.online }) }}
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
                  <DropdownMenuItem class="flex gap-2 cursor-pointer" as-child>
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
                  <LogOutIcon class="size-4" />
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
    liveMatchesCount() {
      return useMatchLobbyStore().liveMatchesCount;
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

<style scoped>
.sidebar-header-enter-active,
.sidebar-header-leave-active {
  transition:
    opacity 0.2s ease,
    max-height 0.2s ease,
    padding 0.2s ease,
    margin 0.2s ease;
  overflow: hidden;
}
.sidebar-header-enter-from,
.sidebar-header-leave-to {
  opacity: 0;
  max-height: 0;
  padding-block: 0;
  margin-block: 0;
}

.sidebar-brand-enter-active,
.sidebar-brand-leave-active {
  transition:
    opacity 0.15s ease,
    max-width 0.2s ease;
  overflow: hidden;
}
.sidebar-brand-enter-from,
.sidebar-brand-leave-to {
  opacity: 0;
  max-width: 0;
}
.sidebar-brand-enter-to,
.sidebar-brand-leave-from {
  max-width: 12rem;
}
</style>
