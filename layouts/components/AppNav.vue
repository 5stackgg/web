<script setup lang="ts">
import { PanelLeft } from "lucide-vue-next";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import BreadCrumbs from "~/components/BreadCrumbs.vue";
import { Users } from "lucide-vue-next";
import RegionStatuses from "~/components/RegionStatuses.vue";
import AppNavFooter from "./AppNavFooter.vue";
import AppNotifications from "./AppNotifications.vue";
import ScrollArea from "~/components/ui/scroll-area/ScrollArea.vue";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import MatchLobbies from "./MatchLobbies.vue";
</script>

<template>
  <aside
    class="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex"
  >
    <nav class="flex flex-col items-center gap-4 px-2 sm:py-5">
      <nuxt-link
        to="/"
        class="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
      >
        <NuxtImg class="rounded" src="/favicon/64.png" />
        <span class="sr-only">5Stack</span>
      </nuxt-link>
      <template v-for="link of links" :key="link.to">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <nuxt-link
                :to="link.to"
                class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
                v-if="!link.role || link.role === me?.role"
              >
                <component :is="link.icon" class="h-5 w-5"></component>
                <span class="sr-only">{{ link.title }}</span>
              </nuxt-link>
            </TooltipTrigger>
            <TooltipContent side="right">
              {{ link.title }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </template>
    </nav>
    <nav class="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
      <AppNavFooter />
    </nav>
  </aside>

  <header
    class="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6"
  >
    <Sheet>
      <SheetTrigger as-child>
        <Button size="icon" variant="outline" class="sm:hidden">
          <PanelLeft class="h-5 w-5" />
          <span class="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" class="flex flex-col sm:max-w-xs">
        <SheetClose as-child>
          <nav class="grid gap-6 text-lg font-medium">
            <nuxt-link
              to="/"
              class="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full text-lg font-semibold text-primary-foreground md:text-base"
            >
              <NuxtImg class="rounded" src="/favicon/64.png" />
              <span class="sr-only">5stack</span>
            </nuxt-link>

            <template v-for="link of links" :key="link.to">
              <nuxt-link
                :to="link.to"
                class="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
                v-if="!link.role || link.role === me?.role"
              >
                <component :is="link.icon" class="h-5 w-5"></component>
                {{ link.title }}
              </nuxt-link>
            </template>
          </nav>
        </SheetClose>
        <nav class="mt-auto">
          <AppNavFooter :mobile="true" />
        </nav>
      </SheetContent>
    </Sheet>
    <div class="flex justify-between items-center w-full">
      <div>
        <bread-crumbs></bread-crumbs>
      </div>

      <div class="flex gap-4">
        <MatchLobbies></MatchLobbies>

        <Popover>
          <PopoverTrigger>
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
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

        <Popover>
          <PopoverTrigger>
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <Users class="h-4 w-4" />
              <span>{{ playersOnline.length }}</span>
            </div>
          </PopoverTrigger>
          <PopoverContent>
            <ScrollArea class="max-h-[20vh] overflow-auto">
              <template :key="player.steam_id" v-for="player of playersOnline">
                <PlayerDisplay
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
</template>

<script lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";
import { Swords, Server, ServerCog, ShieldHalf, Trophy } from "lucide-vue-next";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

export default {
  data() {
    return {
      links: [
        {
          to: "/matches",
          title: "Matches",
          icon: Swords,
        },
        {
          to: "/tournaments",
          title: "Tournaments",
          icon: Trophy,
        },
        {
          to: "/teams",
          title: "Teams",
          icon: ShieldHalf,
        },
        {
          to: "/players",
          title: "Players",
          icon: Users,
        },
        {
          to: "/dedicated-servers",
          title: "Dedicated Servers",
          icon: Server,
          role: e_player_roles_enum.administrator,
        },
        {
          to: "/game-server-nodes",
          title: "Game Server Nodes",
          icon: ServerCog,
          role: e_player_roles_enum.administrator,
        },
      ],
    };
  },
  computed: {
    me() {
      return useAuthStore().me;
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
