<script setup lang="ts">
import { MailPlus } from "lucide-vue-next";
import MatchInvites from "~/components/matchmaking-lobby/MatchInvites.vue";
import LobbyInvites from "~/components/matchmaking-lobby/LobbyInvites.vue";
import { SidebarSeparator } from "~/components/ui/sidebar";
import { useInvites } from "@/composables/useInvites";

const { hasInvites, totalCount } = useInvites();
</script>

<template>
  <template v-if="hasInvites">
    <div class="flex flex-col gap-4 mt-4">
      <h3 class="text-lg font-semibold flex items-center gap-2">
        <div class="relative">
          <MailPlus class="h-5 w-5" />
          <div
            class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"
          ></div>
        </div>
        {{ $t("matchmaking.invites") }}
        <span class="text-sm text-muted-foreground">({{ totalCount }})</span>
      </h3>

      <MatchInvites />
      <LobbyInvites />
    </div>
    <SidebarSeparator class="my-4" />
  </template>
</template>
