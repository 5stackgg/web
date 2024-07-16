<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Default from "~/layouts/default.vue";

interface Item {
  to: string;
  title: string;
}

const $route = useRoute();

const sidebarNavItems: Item[] = [
  {
    title: "Profile",
    to: "/settings",
  },
  {
    title: "Appearance",
    to: "/settings/appearance",
  },
];
</script>

<template>
  <default>
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
      <p class="text-muted-foreground">Manage your account settings.</p>
    </div>
    <Separator class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside class="-mx-4 lg:w-1/5">
        <nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
          <nuxt-link
            :to="item.to"
            v-for="item in sidebarNavItems"
            :key="item.title"
          >
            <Button
              variant="ghost"
              :class="
                cn(
                  'w-full text-left justify-start',
                  $route.path === `${item.href}.html` &&
                    'bg-muted hover:bg-muted'
                )
              "
            >
              {{ item.title }}
            </Button>
          </nuxt-link>
        </nav>
      </aside>
      <div class="flex-1 lg:max-w-2xl">
        <div class="space-y-6">
          <slot />
        </div>
      </div>
    </div>
  </default>
</template>
