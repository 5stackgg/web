<script setup lang="ts">
import {
  BadgeCheck,
  ChevronRight,
  ChevronsUpDownIcon,
  Cog,
  LogOut,
} from "lucide-vue-next";
import { Swords, Server, ServerCog, ShieldHalf, Trophy } from "lucide-vue-next";
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
</script>

<template>
  <SidebarProvider class="bg-muted/40">
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton as-child>
              <nuxt-link to="/">
                <NuxtImg class="rounded" src="/favicon/64.png" />
                <span>5Stack</span>
              </nuxt-link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem tooltip="Matches">
              <SidebarMenuButton as-child tooltip="Matches">
                <NuxtLink to="/matches">
                  <Swords />

                  Matches
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton as-child tooltip="Tournaments">
                <NuxtLink to="/tournaments">
                  <Trophy />

                  Tournaments
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton as-child tooltip="Teams">
                <NuxtLink to="/teams">
                  <ShieldHalf />
                  Teams
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton as-child tooltip="Players">
                <NuxtLink to="/players">
                  <Users />

                  Players
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup v-if="me?.role === e_player_roles_enum.administrator">
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            <Collapsible as-child :default-open="true" v-slot="{ open }">
              <SidebarMenuItem>
                <CollapsibleTrigger as-child>
                  <SidebarMenuButton tooltip="Servers">
                    <ServerCog />
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
                        <NuxtLink to="/dedicated-servers">
                          Dedicated Servers
                        </NuxtLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>

                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        as-child
                        tooltip="Game Server Nodes"
                      >
                        <NuxtLink to="/game-server-nodes">
                          Game Server Nodes
                        </NuxtLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>

            <SidebarMenuItem tooltip="App Settings">
              <SidebarMenuButton as-child tooltip="App Settings">
                <NuxtLink to="/settings/application">
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

          <SidebarMenuItem>
            <DropdownMenu v-model:open="profileOpened">
              <DropdownMenuTrigger as-child>
                <SidebarMenuButton
                  size="lg"
                  :class="{
                    'bg-accent text-accent-foreground': profileOpened,
                  }"
                >
                  <Avatar class="h-8 w-8 rounded">
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
                side="bottom"
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
                    <NuxtLink to="/settings">
                      <BadgeCheck />
                      Settings
                    </NuxtLink>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="flex gap-2"
                  @click="showLogoutModal = true"
                >
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
    <SidebarInset>
      <header
        class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
      >
        <div class="flex items-center justify-between px-4 w-full">
          <div class="flex items-center">
            <SidebarTrigger class="-ml-1" />
            <Separator orientation="vertical" class="mr-2 h-4" />
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
                  class="flex items-center gap-2 text-sm text-muted-foreground"
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
          </div>
        </div>
      </header>
      <slot></slot>
    </SidebarInset>
  </SidebarProvider>

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
export default {
  data() {
    return {
      profileOpened: false,
      showLogoutModal: false,
      showPlayersOnline: false,
    };
  },
  watch: {
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
  },
  computed: {
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
      return useMatchMakingStore().playersOnline;
    },
  },
};
</script>
