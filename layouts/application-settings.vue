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
      <aside class="w-full lg:w-auto">
        <nav
          class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 overflow-y-auto max-h-[300px] lg:max-h-none"
        >
          <nuxt-link to="/settings/application/players">
            <Button variant="ghost" class="w-full text-left justify-start">
              {{ $t("pages.players.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application">
            <Button variant="ghost" class="w-full text-left justify-start">
              {{ $t("pages.settings.application.matchmaking.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/streaming">
            <Button variant="ghost" class="w-full text-left justify-start">
              {{ $t("pages.settings.application.streaming.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/game-type-configs">
            <Button variant="ghost" class="w-full text-left justify-start">
              {{ $t("pages.settings.application.game_type_configs.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/demo-settings">
            <Button variant="ghost" class="w-full text-left justify-start">
              {{ $t("pages.settings.application.demo_settings.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/servers">
            <Button variant="ghost" class="w-full text-left justify-start">
              {{ $t("pages.settings.application.servers.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/discord">
            <Button variant="ghost" class="w-full text-left justify-start">
              {{ $t("pages.settings.application.discord.title") }}
            </Button>
          </nuxt-link>
          <nuxt-link to="/settings/application/telemetry">
            <Button variant="ghost" class="w-full text-left justify-start">
              {{ $t("pages.settings.application.telemetry.title") }}
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
export default {};
</script>

<style lang="postcss">
.router-link-exact-active {
  @apply bg-muted hover:bg-muted rounded-md;
}
</style>
