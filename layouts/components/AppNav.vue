<script setup lang="ts">
import {
  BadgeCheck,
  ChevronsRight,
  ChevronRight,
  ChevronsUpDownIcon,
  Cog,
  LogOut,
  Logs,
  LineChart,
  Server,
  Calendar,
  BookUser,
} from "lucide-vue-next";
import { Play, ShieldHalf, Globe } from "lucide-vue-next";
import TournamentBracket from "~/components/icons/tournament-bracket.vue";
import SystemUpdate from "./SystemUpdate.vue";
import BreadCrumbs from "~/components/BreadCrumbs.vue";
import { Users } from "lucide-vue-next";
import RegionStatuses from "~/components/RegionStatuses.vue";
import AppNotifications from "./AppNotifications.vue";
import ScrollArea from "~/components/ui/scroll-area/ScrollArea.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchLobbies from "./MatchLobbies.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { DiscordLogoIcon, GithubLogoIcon } from "@radix-icons/vue";
import InstallPWA from "~/components/InstallPWA.vue";
import MatchmakingLobby from "~/components/matchmaking-lobby/MatchmakingLobby.vue";
import FriendsList from "~/components/matchmaking-lobby/FriendsList.vue";
import ChatLobby from "~/components/chat/ChatLobby.vue";
</script>

<template>
  <SidebarProvider class="bg-muted/40" v-slot="{ open, isMobile }">
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" as-child>
              <nuxt-link to="/">
                <NuxtImg class="rounded max-w-8" src="/favicon/64.png" />
                <span> 5Stack </span>
              </nuxt-link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem tooltip="Play">
              <SidebarMenuButton as-child tooltip="Play">
                <NuxtLink
                  :to="{ name: 'play' }"
                  :class="{
                    'router-link-active':
                      isRouteActive('matches') || isRouteActive('play'),
                  }"
                >
                  <Play />
                  Play
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem tooltip="Matches">
              <SidebarMenuButton as-child tooltip="Matches">
                <NuxtLink
                  :to="{ name: 'matches' }"
                  :class="{
                    'router-link-active': isRouteActive('matches'),
                  }"
                >
                  <Calendar />
                  Matches
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton as-child tooltip="Tournaments">
                <NuxtLink
                  :to="{ name: 'tournaments' }"
                  :class="{
                    'router-link-active': isRouteActive('tournaments'),
                  }"
                >
                  <TournamentBracket />
                  Tournaments
                  <Badge variant="destructive" class="ml-2">alpha</Badge>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton as-child tooltip="Players">
                <NuxtLink
                  :to="{ name: 'players' }"
                  :class="{
                    'router-link-active': isRouteActive('players'),
                  }"
                >
                  <Users />

                  Players
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton as-child tooltip="Teams">
                <NuxtLink
                  :to="{ name: 'teams' }"
                  :class="{
                    'router-link-active': isRouteActive('teams'),
                  }"
                >
                  <ShieldHalf />
                  Teams
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup v-if="me?.role === e_player_roles_enum.administrator">
          <SidebarGroupLabel>Administration</SidebarGroupLabel>

          <SidebarMenu>
            <SidebarMenuItem tooltip="Regions">
              <SidebarMenuButton as-child tooltip="Regions">
                <NuxtLink
                  :to="{ name: 'regions' }"
                  :class="{
                    'router-link-active': isRouteActive('regions'),
                  }"
                >
                  <Globe />
                  Regions
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <Collapsible
              as-child
              :default-open="true"
              v-slot="{ open }"
              v-if="open || isMobile"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger as-child>
                  <SidebarMenuButton tooltip="Servers">
                    <Server />
                    <span>Servers</span>
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
                        tooltip="Dedicated Servers"
                      >
                        <NuxtLink
                          :to="{ name: 'dedicated-servers' }"
                          :class="{
                            'router-link-active':
                              isRouteActive('dedicated-servers'),
                          }"
                        >
                          Dedicated Servers
                        </NuxtLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>

                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        as-child
                        tooltip="Game Server Nodes"
                      >
                        <NuxtLink
                          :to="{ name: 'game-server-nodes' }"
                          :class="{
                            'router-link-active':
                              isRouteActive('game-server-nodes'),
                          }"
                        >
                          Game Server Nodes
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
                        Dedicated Servers
                      </NuxtLink>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      class="flex gap-2 cursor-pointer"
                      as-child
                    >
                      <NuxtLink :to="{ name: 'game-server-nodes' }">
                        Game Server Nodes
                      </NuxtLink>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>

            <SidebarMenuItem tooltip="System Logs">
              <SidebarMenuButton as-child tooltip="System Logs">
                <NuxtLink
                  :to="{ name: 'system-logs' }"
                  :class="{
                    'router-link-active': isRouteActive('system-logs'),
                  }"
                >
                  <Logs />
                  Logs
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem tooltip="System Metrics">
              <SidebarMenuButton as-child tooltip="System Metrics">
                <NuxtLink
                  :to="{ name: 'system-metrics' }"
                  :class="{
                    'router-link-active': isRouteActive('system-metrics'),
                  }"
                >
                  <LineChart />
                  Metrics
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem tooltip="App Settings">
              <SidebarMenuButton as-child tooltip="App Settings">
                <NuxtLink
                  :to="{ name: 'settings-application' }"
                  :class="{
                    'router-link-active': isRouteActive('settings-application'),
                  }"
                >
                  <Cog />
                  App Settings
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem
            v-if="me?.role === e_player_roles_enum.administrator"
          >
            <SidebarMenuButton as-child tooltip="Report an Issue">
              <a
                href="https://github.com/5stackgg/5stack-panel/issues"
                target="_blank"
                rel="noopener noreferrer"
                class="text-muted-foreground transition-colors hover:text-foreground"
              >
                <GithubLogoIcon class="w-5 h-5" />
                Report an Issue
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton as-child tooltip="Join our Discord">
              <a
                :href="inviteLink"
                target="_blank"
                rel="noopener noreferrer"
                class="text-muted-foreground transition-colors hover:text-foreground"
              >
                <DiscordLogoIcon class="w-5 h-5" />
                Join our Discord
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
                  <Avatar class="h-8 w-8" shape="square">
                    <AvatarImage :src="me.avatar_url" :alt="me.name" />
                    <AvatarFallback>
                      {{ me.name.slice(0, 2) }}
                    </AvatarFallback>
                  </Avatar>
                  <div class="grid flex-1 text-left text-sm leading-tight">
                    <span class="truncate font-semibold">{{ me.name }}</span>
                    <span class="truncate text-xs">{{ me.steam_id }}</span>
                  </div>

                  <ChevronsUpDownIcon class="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                :side="isMobile ? 'top' : 'right'"
                align="end"
                :side-offset="4"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel class="font-normal">
                    <PlayerDisplay :player="me" :show-online="false" />
                  </DropdownMenuLabel>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem class="flex gap-2 cursor-pointer" as-child>
                    <NuxtLink
                      :to="{ name: 'settings' }"
                      :class="{
                        'router-link-active': isRouteActive('settings'),
                      }"
                    >
                      <BadgeCheck class="size-4" />
                      My Account
                    </NuxtLink>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="flex gap-2"
                  @click="showLogoutModal = true"
                >
                  <LogOut class="size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>

    <SidebarInset class="bg-muted/40 overflow-hidden">
      <header
        class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 px-4"
      >
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" class="h-4" />
            <bread-crumbs></bread-crumbs>
          </div>

          <div class="flex gap-4">
            <MatchLobbies></MatchLobbies>

            <SystemUpdate v-if="isAdmin"></SystemUpdate>

            <Popover>
              <PopoverTrigger>
                <div
                  class="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <div class="relative inline-flex">
                    <span
                      class="absolute inline-flex h-2 w-2 rounded-full animate-ping"
                      :class="{
                        'bg-red-500': overalRegionStatus === 'Offline',
                        'bg-yellow-500': overalRegionStatus === 'Degraded',
                      }"
                      v-if="overalRegionStatus !== 'Online'"
                    ></span>
                    <span
                      class="relative inline-flex h-2 w-2 rounded-full"
                      :class="{
                        'bg-green-500': overalRegionStatus === 'Online',
                        'bg-red-500': overalRegionStatus === 'Offline',
                        'bg-yellow-500': overalRegionStatus === 'Degraded',
                      }"
                      :title="overalRegionStatus"
                    ></span>
                  </div>
                </div>
              </PopoverTrigger>
              <PopoverContent>
                <RegionStatuses></RegionStatuses>
              </PopoverContent>
            </Popover>

            <Popover v-model:open="showPlayersOnline">
              <PopoverTrigger>
                <div
                  class="flex items-center gap-4 text-sm text-muted-foreground"
                >
                  <Users class="h-4 w-4" />
                  <span>{{ playersOnline.length }}</span>
                </div>
              </PopoverTrigger>
              <PopoverContent>
                <ScrollArea class="max-h-[20vh] overflow-auto">
                  <template
                    :key="player.steam_id"
                    v-for="player of playersOnline"
                  >
                    <PlayerDisplay
                      @click="showPlayersOnline = false"
                      :player="player"
                      class="my-2"
                      :linkable="true"
                    ></PlayerDisplay>
                  </template>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <AppNotifications></AppNotifications>

            <div
              id="right-sidebar-trigger"
              class="flex items-center justify-center"
              v-show="isMobile"
            ></div>
          </div>
        </div>
      </header>
      <slot></slot>
    </SidebarInset>

    <div id="right-sidebar"></div>
  </SidebarProvider>

  <Teleport defer to="#right-sidebar">
    <SidebarProvider
      class="bg-muted/40"
      :open="rightSidebarOpen"
      :style="{
        '--sidebar-width': '24rem',
        '--sidebar-width-icon': '4.25rem',
      }"
      v-slot="{ isMobile }"
    >
      <Teleport defer to="#right-sidebar-trigger">
        <SidebarTrigger @click="rightSidebarOpen = true" v-show="isMobile">
          <BookUser
            style="width: 1.5rem; height: 1.5rem"
            :class="{ 'rotate-180': !rightSidebarOpen }"
          />
        </SidebarTrigger>
      </Teleport>

      <Sidebar
        variant="inset"
        collapsible="icon"
        side="right"
        @click="rightSidebarOpen = true"
        :class="{ 'cursor-pointer': !rightSidebarOpen }"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem
              class="flex items-center justify-center"
              v-if="!isMobile"
            >
              <SidebarMenuButton as-child>
                <Button
                  size="icon"
                  variant="outline"
                  @click.stop="rightSidebarOpen = !rightSidebarOpen"
                >
                  <ChevronsRight
                    style="width: 1.5rem; height: 1.5rem"
                    :class="{ 'rotate-180': !rightSidebarOpen }"
                  />
                </Button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup :class="{ 'overflow-hidden': !me.current_lobby_id }">
            <SidebarMenu :class="{ 'overflow-hidden': !me.current_lobby_id }">
              <MatchmakingLobby :mini="!rightSidebarOpen" />
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup v-if="me.current_lobby_id">
            <ChatLobby
              instance="matchmaking"
              :lobby-id="me.current_lobby_id"
              type="matchmaking"
              v-show="rightSidebarOpen"
            />
          </SidebarGroup>

          <SidebarGroup v-if="me.current_lobby_id" class="overflow-hidden">
            <SidebarSeparator class="my-4" />

            <FriendsList :mini="!rightSidebarOpen" />
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  </Teleport>

  <AlertDialog
    v-if="showLogoutModal"
    :open="showLogoutModal"
    @update:open="(open) => (showLogoutModal = open)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
        <AlertDialogDescription>
          This will log you out of your account. You will need to log back in to
          access your account again.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction @click="logout">Log out</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { getCountryForTimezone } from "countries-and-timezones";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useMediaQuery } from "@vueuse/core";

export default {
  data() {
    return {
      serversOpened: false,
      profileOpened: false,
      showLogoutModal: false,
      showPlayersOnline: false,
      rightSidebarOpen: false,
    };
  },
  watch: {
    isMedium: {
      immediate: true,
      handler() {
        this.rightSidebarOpen = !this.isMedium;
      },
    },
    detectedCountry: {
      immediate: true,
      async handler() {
        if (!this.me || this.me.country) {
          return;
        }

        await this.$apollo.mutate({
          mutation: generateMutation({
            update_players_by_pk: [
              {
                pk_columns: {
                  steam_id: this.me.steam_id,
                },
                _set: {
                  country: this.detectedCountry,
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });
      },
    },
  },
  methods: {
    async logout() {
      await this.$apollo.mutate({
        mutation: generateMutation({
          logout: [
            {},
            {
              success: true,
            },
          ],
        }),
      });

      // Redirect to home page or login page after successful logout
      navigateTo("/");

      window.location.reload();
    },
    isRouteActive(route: string) {
      return this.$route.path.startsWith(`/${route}`);
    },
  },
  computed: {
    inlobby() {
      return useAuthStore().me.current_lobby_id !== null;
    },
    isMedium() {
      return useMediaQuery("(max-width: 1400px)").value;
    },
    me() {
      return useAuthStore().me;
    },
    isAdmin() {
      return useAuthStore().isAdmin;
    },
    inviteLink() {
      return `https://${useRuntimeConfig().public.webDomain}/discord-invite`;
    },
    detectedCountry() {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const country = getCountryForTimezone(timezone);

      if (country) {
        return country.id;
      }
    },
    regions() {
      return useApplicationSettingsStore().availableRegions;
    },
    overalRegionStatus() {
      const statuses = this.regions?.map((region) => region.status);

      if (!statuses) {
        return;
      }

      if (statuses.every((status) => status === "Online")) {
        return "Online";
      } else if (statuses.every((status) => status === "Offline")) {
        return "Offline";
      } else {
        return "Degraded";
      }
    },
    playersOnline() {
      return useMatchmakingStore().playersOnline;
    },
  },
};
</script>
