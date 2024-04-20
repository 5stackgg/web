<script setup lang="ts">
import { Gamepad, PanelLeft, Bell } from "lucide-vue-next";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Button } from "~/components/ui/button";
import BreadCrumbs from "~/components/BreadCrumbs.vue";
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
      <template v-for="link of links">
        <nuxt-link
            :to="link.to"
            class="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
        >
          <component class="h-5 w-5" :is="link.icon"></component>
          <span class="sr-only">{{ link.title }}</span>
        </nuxt-link>
      </template>
    </nav>
    <nav class="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
      <Sheet>
        <SheetTrigger>
          <Bell class="h-5 w-5" />
          <span class="sr-only">Notifications</span>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription> // TODO </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>

      <nuxt-link
          href="/settings/profile"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
      >
        <Avatar>
          <AvatarImage
              :src="me.player.avatar_url"
              :alt="me.player.name"
          />
          <AvatarFallback>{{ me.player.name }}</AvatarFallback>
        </Avatar>

        <span class="sr-only">
                {{ me.player.name }}
              </span>
      </nuxt-link>
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
      <SheetContent side="left" class="sm:max-w-xs">
        <nav class="grid gap-6 text-lg font-medium">
          <nuxt-link
            to="/"
            class="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
          >
            <Gamepad class="h-5 w-5 transition-all group-hover:scale-110" />
            <span class="sr-only">5stack</span>
          </nuxt-link>

          <template v-for="link of links">
            <nuxt-link
              :to="link.to"
              class="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
            >
              <component :is="link.icon" class="h-5 w-5"></component>
              {{ link.title }}
            </nuxt-link>
          </template>
        </nav>
      </SheetContent>
    </Sheet>
    <bread-crumbs></bread-crumbs>
  </header>
</template>

<script lang="ts">
import { Swords, Server, Users, ShieldHalf } from "lucide-vue-next";

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
          to: "/servers",
          title: "Manage Servers",
          icon: Server,
        },
      ],
    };
  },
  computed: {
    me() {
      return useAuthStore().me!;
    },
  },
};
</script>
