<script setup lang="ts">
import { computed } from "vue";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import TimeAgo from "~/components/TimeAgo.vue";
import TimezoneFlag from "~/components/TimezoneFlag.vue";
import TeamsAwardShelf from "~/components/teams/TeamsAwardShelf.vue";
import type { TeamAwardEntry } from "~/components/teams/teamAwards";
import TeamsEmblem from "~/components/teams/TeamsEmblem.vue";
import TeamsFormStrip from "~/components/teams/TeamsFormStrip.vue";
import { resolveRosterImageUrl } from "~/utilities/rosterImage";
import { teamForm } from "~/utilities/teamResults";

const props = defineProps<{
  team: any;
  awards: TeamAwardEntry[];
  live: boolean;
}>();

const apiDomain = useRuntimeConfig().public.apiDomain as string;

const STATUS_ORDER: Record<string, number> = {
  Starter: 0,
  Substitute: 1,
  Benched: 2,
};

const roster = computed<any[]>(() => props.team.roster ?? []);

// The starting five first, so the faces are the ones that play.
const faces = computed(() =>
  [...roster.value]
    .sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) ||
        (a.player?.name ?? "").localeCompare(b.player?.name ?? ""),
    )
    .slice(0, 5),
);
const extraFaces = computed(() => Math.max(0, roster.value.length - 5));

const countries = computed(() => {
  const counts = new Map<string, number>();
  for (const member of roster.value) {
    const country = member.player?.country;
    if (country) counts.set(country, (counts.get(country) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([country]) => country);
});

const form = computed(() =>
  teamForm(props.team.recent_results ?? [], props.team.id),
);

const lastPlayedAt = computed<string | null>(
  () =>
    props.team.last_match_at ??
    props.team.recent_results?.[0]?.ended_at ??
    null,
);

const avgElo = computed(() => {
  const value = props.team.ranks?.avg_elo;
  return value != null && value > 0 ? Math.round(value) : null;
});

function faceSrc(member: any) {
  return (
    resolveRosterImageUrl(member, member.player, apiDomain) ??
    member.player?.avatar_url ??
    undefined
  );
}
</script>

<template>
  <div
    role="listitem"
    class="group relative grid items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors duration-150 [grid-template-areas:'em_id_aw'_'em_st_st'] [grid-template-columns:2.5rem_minmax(0,1fr)_auto] has-[a.team-link:focus-visible]:ring-2 has-[a.team-link:focus-visible]:ring-inset has-[a.team-link:focus-visible]:ring-[hsl(var(--tac-amber))] hover:bg-muted/25 lg:gap-x-4 lg:[grid-template-areas:'em_id_ro_elo_form_last_aw'] lg:[grid-template-columns:2.5rem_minmax(0,1.6fr)_8.5rem_5.5rem_6.5rem_8.5rem_minmax(0,9rem)]"
  >
    <TeamsEmblem
      :team="team"
      :size="40"
      class="self-start [grid-area:em] lg:self-center"
    />

    <div class="grid min-w-0 gap-0.5 [grid-area:id]">
      <div class="flex min-w-0 items-center gap-2">
        <NuxtLink
          :to="{ name: 'teams-id', params: { id: team.id } }"
          class="team-link min-w-0 truncate text-[14.5px] font-bold outline-none after:absolute after:inset-0 after:content-['']"
          >{{ team.name }}</NuxtLink
        >
        <span
          v-if="team.short_name"
          class="inline-flex h-5 shrink-0 items-center rounded-[5px] border border-border bg-muted/40 px-1.5 text-[11px] font-semibold tracking-[0.06em] text-foreground/80"
          >{{ team.short_name }}</span
        >
        <span
          v-if="team.is_organization"
          class="inline-flex h-5 shrink-0 items-center rounded-[5px] border border-border bg-muted/40 px-1.5 text-[11px] font-semibold text-foreground/80"
          >{{ $t("pages.teams.directory.org") }}</span
        >
      </div>
      <div
        class="flex min-w-0 items-center gap-2 whitespace-nowrap text-[12.5px] text-muted-foreground"
      >
        <span v-if="countries.length" class="flex items-center gap-1">
          <TimezoneFlag
            v-for="country in countries"
            :key="country"
            :country="country"
            class="h-3 w-4 shrink-0 leading-3"
          />
        </span>
        <span>{{
          roster.length
            ? $t("pages.teams.players", roster.length)
            : $t("team.table.no_roster")
        }}</span>
      </div>
    </div>

    <div class="hidden items-center [grid-area:ro] lg:flex">
      <div v-if="faces.length" class="flex -space-x-1.5">
        <Avatar
          v-for="member in faces"
          :key="member.player?.steam_id"
          class="size-6 rounded-full border-2 border-background"
          :title="member.player?.name"
        >
          <AvatarImage :src="faceSrc(member)" :alt="member.player?.name" />
          <AvatarFallback class="text-[10px]">
            {{ member.player?.name?.slice(0, 1) ?? "?" }}
          </AvatarFallback>
        </Avatar>
      </div>
      <span
        v-if="extraFaces"
        class="ml-1.5 text-xs tabular-nums text-muted-foreground"
        >+{{ extraFaces }}</span
      >
    </div>

    <div
      class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 [grid-area:st] lg:contents"
    >
      <span class="text-[13px] tabular-nums lg:[grid-area:elo]">
        <template v-if="avgElo !== null">
          <span class="font-semibold">{{ avgElo.toLocaleString() }}</span>
          <span class="text-muted-foreground lg:hidden">
            {{ $t("common.avg") }}</span
          >
        </template>
        <span v-else class="text-muted-foreground">—</span>
      </span>
      <TeamsFormStrip :form="form" class="lg:[grid-area:form]" />
      <span
        class="whitespace-nowrap text-[12.5px] max-lg:ml-auto lg:[grid-area:last]"
      >
        <span
          v-if="live"
          class="inline-flex items-center gap-1.5 font-semibold text-destructive"
        >
          <span class="relative inline-flex size-2 shrink-0" aria-hidden="true">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75 motion-reduce:animate-none"
            ></span>
            <span
              class="relative inline-flex size-2 rounded-full bg-destructive"
            ></span>
          </span>
          {{ $t("pages.teams.directory.playing_now") }}
        </span>
        <TimeAgo
          v-else-if="lastPlayedAt"
          :date="lastPlayedAt"
          hide-icon
          class="text-foreground/80"
        />
        <span v-else class="text-muted-foreground">{{
          $t("pages.teams.directory.never_played")
        }}</span>
      </span>
    </div>

    <div class="relative z-10 flex justify-end [grid-area:aw]">
      <TeamsAwardShelf :awards="awards" />
    </div>
  </div>
</template>
