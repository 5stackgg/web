<script setup lang="ts">
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InstallPWA from "~/components/InstallPWA.vue";
import { DiscordLogoIcon } from "@radix-icons/vue";
import { User, Settings, LogOut, ChevronsUpDown } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { useAuthStore } from "~/stores/AuthStore";
import Logout from "./Logout.vue";
import MatchLobbies from "./MatchLobbies.vue";
import SystemStatus from "./SystemStatus.vue";
import OnlinePlayers from "./OnlinePlayers.vue";
import AppNotifications from "./AppNotifications.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { NuxtImg } from "#components";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
const { isMobile } = useSidebar();
</script>

<template>
  <nav
    class="text-sm w-full bg-[#28282b] border-t border-[#3a3a3d] border-b-2 border-[#18181b] shadow-lg flex items-center justify-between px-4 py-2 z-50 relative"
  >
    <div class="flex items-center gap-2 relative">
      <NuxtLink
        to="/"
        class="flex items-center gap-2 select-none"
        v-if="!isMobile"
      >
        <NuxtImg class="rounded h-6 w-6" src="/favicon/64.png" />
        <span class="font-extrabold text-base tracking-widest text-[#f5c6a5]"
          >5Stack</span
        >
      </NuxtLink>
      <SystemStatus v-if="!isMobile" />
      <!-- Unified Play and Community menus for all screen sizes -->
      <NavigationMenu>
        <NavigationMenuList class="flex items-center">
          <!-- Play menu with hero card -->
          <NavigationMenuItem>
            <NavigationMenuTrigger
              class="uppercase font-bold px-4 py-2 transition-colors duration-150 border-none outline-none focus:ring-0 hover:text-green-300 rounded bg-transparent"
            >
              Play
            </NavigationMenuTrigger>
            <NavigationMenuContent
              class="bg-[#232326] border border-neutral-800 rounded-lg shadow-lg p-0 min-w-[350px] md:min-w-[500px] max-w-[95vw] flex mt-0"
            >
              <div class="flex w-full flex-row">
                <ul class="flex flex-col gap-2 p-6 flex-1">
                  <li>
                    <NavigationMenuLink as-child>
                      <NuxtLink
                        to="/play"
                        class="block w-full text-left px-4 py-2 uppercase font-bold text-sm transition-colors duration-150 border-none outline-none hover:text-green-300"
                      >
                        Find a Match
                      </NuxtLink>
                    </NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink as-child>
                      <NuxtLink
                        to="/tournaments"
                        class="block w-full text-left px-4 py-2 uppercase font-bold text-sm transition-colors duration-150 border-none outline-none hover:text-green-300"
                      >
                        Tournaments
                      </NuxtLink>
                    </NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink as-child>
                      <NuxtLink
                        to="/matches"
                        class="block w-full text-left px-4 py-2 uppercase font-bold text-sm transition-colors duration-150 border-none outline-none hover:text-green-300"
                      >
                        View Previous Matches
                      </NuxtLink>
                    </NavigationMenuLink>
                  </li>
                </ul>
                <div
                  class="flex flex-col items-center justify-center bg-[#18181b] rounded-t-lg md:rounded-l-lg md:rounded-tr-none p-6 min-w-[120px] max-w-[200px]"
                >
                  <div class="text-lg font-bold mb-1">Play & Compete</div>
                  <div class="text-xs text-neutral-400 text-center">
                    Join matches, tournaments, and view your match history.
                  </div>
                </div>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <!-- Community menu: multi-column grouped style, no icons in links -->
          <NavigationMenuItem>
            <NavigationMenuTrigger
              class="uppercase font-bold px-4 py-2 transition-colors duration-150 border-none outline-none focus:ring-0 hover:text-green-300 rounded bg-transparent"
            >
              Community
            </NavigationMenuTrigger>
            <NavigationMenuContent
              class="bg-[#232326] border border-neutral-800 rounded-lg shadow-lg p-0 min-w-[320px] md:min-w-[600px] max-w-[95vw] flex mt-0"
            >
              <div
                class="flex flex-col md:flex-row w-full p-4 md:p-6 gap-4 md:gap-8"
              >
                <div class="flex-1 min-w-[150px]">
                  <ul class="flex flex-col gap-2">
                    <div
                      class="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest"
                    ></div>
                    <li>
                      <NavigationMenuLink as-child>
                        <NuxtLink
                          to="/players"
                          class="flex flex-col px-2 py-2 rounded hover:text-green-300 transition-colors"
                        >
                          <span class="block font-bold">Players</span>
                          <span class="block text-xs text-neutral-400"
                            >Browse and search for players</span
                          >
                        </NuxtLink>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink as-child>
                        <NuxtLink
                          to="/teams"
                          class="flex flex-col px-2 py-2 rounded hover:text-green-300 transition-colors"
                        >
                          <span class="block font-bold">Teams</span>
                          <span class="block text-xs text-neutral-400"
                            >Find and manage teams</span
                          >
                        </NuxtLink>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </div>
                <!-- Social group -->
                <div class="flex-1 min-w-[150px]">
                  <div
                    class="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-widest"
                  >
                    Social
                  </div>
                  <ul class="flex flex-col gap-2">
                    <li>
                      <NavigationMenuLink as-child>
                        <a
                          :href="inviteLink"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex flex-col px-2 py-2 rounded hover:text-green-300 transition-colors"
                        >
                          <span class="block font-bold">Join our Discord</span>
                          <span class="block text-xs text-neutral-400"
                            >Chat, support, and announcements</span
                          >
                        </a>
                      </NavigationMenuLink>
                    </li>
                    <li>
                      <NavigationMenuLink as-child>
                        <a
                          href="https://github.com/5stackgg/5stack-panel"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="flex flex-col px-2 py-2 rounded hover:text-green-300 transition-colors"
                        >
                          <span class="block font-bold">
                            {{ $t("pages.login.powered_by") }} 5stack.gg
                          </span>
                          <span
                            class="block text-xs text-neutral-400 flex items-center gap-1"
                          >
                            View 5stack on GitHub
                          </span>
                        </a>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </div>
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
    <div class="flex items-center gap-4">
      <FiveStackToolTip v-if="!isMobile">
        <template #trigger>
          <a
            :href="inviteLink"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            <DiscordLogoIcon class="w-5 h-5" />
          </a>
        </template>
        Join our Discord
      </FiveStackToolTip>
      <InstallPWA v-if="!isMobile" :is-menu-item="false" />
      <MatchLobbies v-if="!isMobile" />
      <OnlinePlayers v-if="!isMobile" />
      <AppNotifications />

      <!-- Player Profile Dropdown -->
      <DropdownMenu v-model:open="profileMenuOpen">
        <DropdownMenuTrigger as-child>
          <button
            class="flex items-center gap-2 px-3 py-2 hover:text-green-300 transition-colors duration-150 rounded"
            type="button"
          >
            <PlayerDisplay
              :player="me"
              :show-online="false"
              :show-name="false"
              :show-elo="false"
              :show-flag="false"
              :show-role="false"
              size="sm"
            />
            <ChevronsUpDown class="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-56 bg-[#232326] border border-neutral-800 rounded-lg shadow-lg"
          align="end"
          :side-offset="4"
        >
          <DropdownMenuLabel class="font-normal p-3">
            <PlayerDisplay :player="me" :show-online="false" />
          </DropdownMenuLabel>
          <DropdownMenuSeparator class="bg-neutral-700" />
          <DropdownMenuGroup>
            <DropdownMenuItem class="flex gap-2 cursor-pointer p-3" as-child>
              <NuxtLink
                :to="{
                  name: 'players-id',
                  params: { id: me?.steam_id },
                }"
                class="flex items-center gap-2 hover:text-green-300 transition-colors"
              >
                <User class="w-4 h-4" />
                My Profile
              </NuxtLink>
            </DropdownMenuItem>
            <DropdownMenuItem class="flex gap-2 cursor-pointer p-3" as-child>
              <NuxtLink
                :to="{ name: 'settings' }"
                class="flex items-center gap-2 hover:text-green-300 transition-colors"
              >
                <Settings class="w-4 h-4" />
                My Account
              </NuxtLink>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator class="bg-neutral-700" />
          <DropdownMenuItem
            class="flex gap-2 cursor-pointer p-3 hover:text-green-300 transition-colors"
            @click="showLogoutModal = true"
          >
            <LogOut class="w-4 h-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div
        id="right-sidebar-trigger"
        class="flex items-center justify-center"
        v-show="isMobile"
      ></div>
    </div>
    <Logout v-if="showLogoutModal" @update:open="showLogoutModal = $event" />
  </nav>
</template>

<script lang="ts">
export default {
  data() {
    return {
      showLogoutModal: false,
      profileMenuOpen: false,
    };
  },
  computed: {
    inviteLink() {
      return `https://${useRuntimeConfig().public.webDomain}/discord-invite`;
    },
    me() {
      return useAuthStore().me;
    },
  },
};
</script>
