<script setup lang="ts">
import {
  ChevronsUpDownIcon,
  Cog,
  LogOutIcon,
  Logs,
  LineChart,
  Server,
  Calendar,
  Play,
  Globe,
  Map,
  Settings,
  User,
  CalendarCog,
  ShieldHalf,
  ChevronRight,
  Users,
} from "lucide-vue-next";
import TournamentBracket from "~/components/icons/tournament-bracket.vue";
import InstallPWA from "~/components/InstallPWA.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { DiscordLogoIcon, GithubLogoIcon } from "@radix-icons/vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import Logout from "./Logout.vue";
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <nuxt-link to="/">
              <NuxtImg class="rounded max-w-8" src="/favicon/64.png" />
              <span> {{ $t("layouts.app_nav.brand") }} </span>
            </nuxt-link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
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

                <Badge size="sm" v-if="myMatches.length > 0">
                  {{ myMatches.length }}
                </Badge>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem :tooltip="$t('layouts.app_nav.tooltips.matches')">
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
                <Calendar />
                {{ $t("layouts.app_nav.navigation.matches") }}
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
                  'router-link-active': isRouteActive('tournaments'),
                }"
              >
                <TournamentBracket />
                {{ $t("layouts.app_nav.navigation.tournaments") }}
                <Badge variant="destructive" class="ml-2">alpha</Badge>
              </NuxtLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              as-child
              :tooltip="$t('layouts.app_nav.tooltips.players')"
            >
              <NuxtLink
                :to="{ name: 'players' }"
                :class="{
                  'router-link-active': isRouteActive('players'),
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
        </SidebarMenu>
      </SidebarGroup>

      <Separator
        class="mx-4 w-auto"
        v-if="isAdmin || isMatchOrganizer || isTournamentOrganizer"
      />

      <SidebarGroup v-if="isAdmin || isMatchOrganizer || isTournamentOrganizer">
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
          <template v-if="isAdmin">
            <SidebarMenuItem
              :tooltip="$t('layouts.app_nav.tooltips.map_pools')"
            >
              <SidebarMenuButton
                as-child
                :tooltip="$t('layouts.app_nav.tooltips.map_pools')"
              >
                <NuxtLink
                  :to="{ name: 'map-pools' }"
                  :class="{
                    'router-link-active': isRouteActive('map-pools'),
                  }"
                >
                  <Map />
                  {{ $t("layouts.app_nav.administration.map_pools") }}
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem :tooltip="$t('layouts.app_nav.tooltips.regions')">
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
                          $t("layouts.app_nav.administration.dedicated_servers")
                        }}
                      </NuxtLink>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      class="flex gap-2 cursor-pointer"
                      as-child
                    >
                      <NuxtLink :to="{ name: 'game-server-nodes' }">
                        {{
                          $t("layouts.app_nav.administration.game_server_nodes")
                        }}
                      </NuxtLink>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>

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
                  {{ $t("layouts.app_nav.administration.logs") }}
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
                  {{ $t("layouts.app_nav.administration.metrics") }}
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
                    'router-link-active': isRouteActive('settings-application'),
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
      <SidebarGroup v-if="telemetryStats?.online > 0 && sideBarOpen">
        <Badge size="sm" variant="outline" class="p-2 flex items-center gap-2">
          <Server class="w-3 h-3" />
          {{ telemetryStats.online }} System{{
            telemetryStats.online > 1 ? "s" : ""
          }}
          Online
        </Badge>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem v-if="me?.role === e_player_roles_enum.administrator">
          <SidebarMenuButton
            as-child
            :tooltip="$t('layouts.app_nav.tooltips.report_issue')"
          >
            <a
              href="https://github.com/5stackgg/5stack-panel/issues"
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
                    :to="{ name: 'players-id', params: { id: me.steam_id } }"
                    :class="{
                      'router-link-active': isRouteActive('players'),
                    }"
                  >
                    <User class="size-4" />
                    {{ $t("layouts.app_nav.profile.my_profile") }}
                  </NuxtLink>
                </DropdownMenuItem>
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
      return (
        this.$route.path === `/${route}` ||
        this.$route.path.startsWith(`/${route}/`)
      );
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
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
  },
};
</script>
