<script setup lang="ts">
import { computed } from "vue";
import { useTournamentDisplay } from "~/composables/useTournamentDisplay";

const props = defineProps<{
  tournament: any;
  event?: { id: string; name: string } | null;
}>();

const { state, registrationOpen, startDay, startTime, teamsLabel } =
  useTournamentDisplay(() => props.tournament);

// No location on a LAN means the organizer hasn't said where yet, not online.
const inPerson = computed(() =>
  (props.tournament.categories || []).some((category: any) =>
    ["LAN", "LocationEvent"].includes(category.category),
  ),
);

const startKey = computed(() =>
  state.value === "finished"
    ? "played"
    : state.value === "live"
      ? "started"
      : "starts",
);
</script>

<template>
  <dl class="m-0 grid grid-cols-2 gap-x-5 gap-y-3.5">
    <div v-if="startDay" class="grid min-w-0 gap-0.5">
      <dt class="text-xs text-muted-foreground">
        {{ $t(`pages.tournaments.facts.${startKey}`) }}
      </dt>
      <dd class="m-0 text-[0.8125rem] font-semibold">
        {{ startDay }}
        <span class="block text-xs font-medium text-foreground/70">
          {{ startTime }}
        </span>
      </dd>
    </div>
    <div v-if="tournament.location || !inPerson" class="grid min-w-0 gap-0.5">
      <dt class="text-xs text-muted-foreground">
        {{ $t("pages.tournaments.facts.where") }}
      </dt>
      <dd class="m-0 text-[0.8125rem] font-semibold">
        {{ tournament.location || $t("pages.tournaments.facts.online") }}
      </dd>
    </div>
    <div v-if="!registrationOpen" class="grid min-w-0 gap-0.5">
      <dt class="text-xs text-muted-foreground">
        {{ $t("pages.tournaments.facts.teams") }}
      </dt>
      <dd class="m-0 text-[0.8125rem] font-semibold tabular-nums">
        {{ teamsLabel }}
      </dd>
    </div>
    <div v-if="event" class="grid min-w-0 gap-0.5">
      <dt class="text-xs text-muted-foreground">
        {{ $t("pages.tournaments.facts.part_of") }}
      </dt>
      <dd class="m-0 text-[0.8125rem] font-semibold">
        <NuxtLink
          :to="`/events/${event.id}`"
          class="hover:underline hover:underline-offset-[3px]"
        >
          {{ event.name }}
        </NuxtLink>
      </dd>
    </div>
  </dl>
</template>
