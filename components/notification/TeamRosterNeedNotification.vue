<script setup lang="ts">
import { UserPlus, Users, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { dismissRosterNeed } from "~/composables/useRosterNeedDismissals";
import type { TeamRosterNeed } from "~/stores/NotificationStore";

defineProps<{ need: TeamRosterNeed }>();

const actionClasses = "h-7 shrink-0 gap-1.5 px-2.5 text-[0.7rem] font-medium";
</script>

<template>
  <div
    class="space-y-2 rounded-md border border-[hsl(var(--tac-amber)/0.35)] bg-card/70 p-3"
  >
    <div class="min-w-0">
      <div
        class="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
      >
        <Users class="h-3 w-3 shrink-0" />
        <span class="truncate">{{ need.name }}</span>
      </div>
      <div class="mt-1 text-sm font-semibold leading-tight">
        {{ $t("team.pulse.needs.roster_title", { count: need.starters }) }}
      </div>
      <div class="mt-0.5 text-xs text-muted-foreground">
        {{ $t("team.pulse.needs.roster_meta") }}
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-1.5">
      <Button as-child size="sm" :class="['tac-amber-cta', actionClasses]">
        <NuxtLink
          :to="{ path: `/teams/${need.teamId}`, query: { invite: '1' } }"
        >
          <UserPlus class="h-3.5 w-3.5" />
          {{ $t("team.members.invite_player") }}
        </NuxtLink>
      </Button>
      <!-- A short roster can be on purpose (a wingman duo). -->
      <Button
        size="sm"
        variant="outline"
        :class="[actionClasses, 'text-muted-foreground']"
        @click="dismissRosterNeed(need.teamId, need.starters)"
      >
        <X class="h-3.5 w-3.5" />
        {{ $t("layouts.notifications.dismiss") }}
      </Button>
    </div>
  </div>
</template>
