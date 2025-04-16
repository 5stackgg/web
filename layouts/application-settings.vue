<script setup lang="ts">
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Default from "~/layouts/default.vue";
</script>

<template>
  <default>
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">
        {{ $t("layouts.application_settings.title") }}
      </h2>
      <p class="text-muted-foreground">
        {{ $t("layouts.application_settings.description") }}
      </p>
    </div>
    <Separator class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside>
        <nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
          <nuxt-link
            :to="item.to"
            v-for="item in sidebarNavItems"
            :key="item.key"
          >
            <Button variant="ghost" class="w-full text-left justify-start">
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

<script lang="ts">
export default {
  data() {
    return {
      sidebarNavItems: [
        {
          title: this.$t("pages.settings.application.matchmaking.title"),
          key: "matchmaking",
          to: "/settings/application",
        },
        {
          title: this.$t("pages.players.title"),
          key: "players",
          to: "/settings/application/players",
        },
        {
          title: this.$t("pages.settings.application.discord.title"),
          key: "discord",
          to: "/settings/application/discord",
        },
        {
          title: this.$t("pages.settings.application.game_type_configs.title"),
          key: "game_type_configs",
          to: "/settings/application/game-type-configs",
        },
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
