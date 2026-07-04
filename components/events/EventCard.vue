<script setup lang="ts">
import { Trophy } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import {
  formatEventDate,
  statusBadgeVariant,
  statusLabelKey,
} from "~/utilities/eventDisplay";

defineProps<{ event: any }>();
</script>

<template>
  <NuxtLink
    :to="{ name: 'events-eventId', params: { eventId: event.id } }"
    class="group/event relative isolate block overflow-hidden rounded-md border border-border/70 bg-[linear-gradient(135deg,hsl(var(--card)/0.68)_0%,hsl(var(--card)/0.44)_54%,hsl(var(--muted)/0.16)_100%)] p-4 transition-[border-color,background,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-border hover:bg-[linear-gradient(135deg,hsl(var(--card)/0.78)_0%,hsl(var(--card)/0.5)_50%,hsl(var(--muted)/0.24)_100%)] sm:p-5"
  >
    <div
      class="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap"
    >
      <div class="min-w-0 flex-1 space-y-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <Badge :variant="statusBadgeVariant(event.status)">
            {{ $t(statusLabelKey(event.status)) }}
          </Badge>
          <span
            v-if="event.is_organizer"
            class="inline-flex items-center rounded border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[hsl(var(--tac-amber))]"
          >
            {{ $t("event.card.organizing") }}
          </span>
          <span class="text-xs text-muted-foreground">
            {{
              formatEventDate(event.starts_at) ||
              $t("pages.events.date_tbd")
            }}
            <template v-if="formatEventDate(event.ends_at)">
              &nbsp;-&nbsp;{{ formatEventDate(event.ends_at) }}
            </template>
          </span>
        </div>

        <h3
          class="truncate font-sans text-lg font-bold leading-tight text-foreground"
        >
          {{ event.name }}
        </h3>

        <p
          v-if="event.description"
          class="line-clamp-2 text-sm text-muted-foreground"
        >
          {{ event.description }}
        </p>
      </div>

      <div
        class="flex shrink-0 flex-col items-start gap-2 sm:items-end sm:text-right"
      >
        <div
          class="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Trophy class="h-3.5 w-3.5" />
          <span>{{ $t("event.card.tournaments") }}:</span>
          <span class="font-semibold text-foreground">{{
            event.tournaments_aggregate?.aggregate?.count ?? 0
          }}</span>
        </div>

        <div v-if="event.organizer" class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground">{{
            $t("event.card.organized_by")
          }}</span>
          <PlayerDisplay
            :player="event.organizer"
            size="xs"
            compact
            :show-flag="false"
            :show-role="false"
            :show-elo="false"
            :tooltip="false"
          />
        </div>
      </div>
    </div>
  </NuxtLink>
</template>
