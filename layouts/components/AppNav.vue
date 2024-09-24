<script setup lang="ts">
import { Gamepad, PanelLeft } from "lucide-vue-next";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import BreadCrumbs from "~/components/BreadCrumbs.vue";
import { Users } from "lucide-vue-next";
import RegionStatuses from "~/components/RegionStatuses.vue";
import AppNavFooter from "./AppNavFooter.vue";
</script>

<template>
  <aside
    class="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex"
  >
    <nav class="flex flex-col items-center gap-4 px-2 sm:py-5">
      <nuxt-link
        to="/"
        class="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
      >
        <Gamepad class="h-4 w-4 transition-all group-hover:scale-110" />
        <span class="sr-only">5Stack</span>
      </nuxt-link>
      <template v-for="link of links" :key="link.to">
        <nuxt-link
          :to="link.to"
          class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
          v-if="!link.role || link.role === me?.role"
        >
          <component :is="link.icon" class="h-5 w-5"></component>
          <span class="sr-only">{{ link.title }}</span>
        </nuxt-link>
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
              class="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
            >
              <Gamepad class="h-5 w-5 transition-all group-hover:scale-110" />
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

      <div>
        <Popover>
          <PopoverTrigger>
            <div class="flex items-center">
              <small class="text-muted-foreground ml-4">
                <span class="flex items-center gap-3">
                  <span class="flex items-center gap-1">
                    <span
                      class="inline-block w-2 h-2 rounded-full"
                      :class="{
                        'bg-green-600': overalRegionStatus === 'Online',
                        'bg-red-600': overalRegionStatus === 'Offline',
                        'bg-yellow-600': overalRegionStatus === 'Degraded',
                      }"
                    ></span>
                  </span>
                  <Users /> {{ playersOnline }}
                </span>
              </small>
            </div>
          </PopoverTrigger>
          <PopoverContent>
            <RegionStatuses></RegionStatuses>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  </header>
</template>

<script lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";
import { Swords, Server, ServerCog, ShieldHalf, Trophy } from "lucide-vue-next";

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
          title: "Manage Servers",
          icon: Server,
        },
        {
          to: "/game-server-nodes",
          title: "Manage Game Server Nodes",
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
    playersOnline() {
      return useMatchMakingStore().playersOnline;
    },
    regions() {
      return useMatchMakingStore().regions;
    },
    overalRegionStatus() {
      const statuses = this.regions.map((region) => region.status);
      if (statuses.every((status) => status === "Online")) {
        return "Online";
      } else if (statuses.every((status) => status === "Offline")) {
        return "Offline";
      } else {
        return "Degraded";
      }
    },
  },
};
</script>
