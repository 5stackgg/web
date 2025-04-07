<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Default from "~/layouts/default.vue";
</script>

<template>
  <default>
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">{{ $t('layouts.application_settings.title') }}</h2>
      <p class="text-muted-foreground">{{ $t('layouts.application_settings.description') }}</p>
    </div>
    <Separator class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside>
        <nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
          <nuxt-link
            :to="item.to"
            v-for="item in sidebarNavItems"
            :key="item.title"
          >
            <Button variant="ghost" class="w-full text-left justify-start">
              {{ item.key }}
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

<script lang="ts">
export default {
  data() {
    return {
      sidebarNavItems: [
        { title: "Matchmaking", key: "matchmaking", to: "/settings/application" },
        { title: "Players", key: "players", to: "/settings/application/players" },
        { title: "Discord", key: "discord", to: "/settings/application/discord" },
      ],
    };
  },
};
</script>

<style lang="postcss">
.router-link-exact-active {
  @apply bg-muted hover:bg-muted rounded-md;
}
</style>
