<script setup lang="ts">
import { computed } from "vue";
import { Swords } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import PlayWayCard from "~/components/play/PlayWayCard.vue";
import TeamsEmblem from "~/components/teams/TeamsEmblem.vue";
import {
  scrimWindowLabel,
  type ScrimTeamToday,
} from "~/utilities/playMoreWays";

export type PlayWaysScrims = {
  teamsToday: number;
  // Today's teams, earliest window first.
  teams: ScrimTeamToday[];
  // null for guests: "manages a team" only means something signed in.
  managesTeam: boolean | null;
};

const props = withDefaults(
  defineProps<{
    scrims: PlayWaysScrims;
    layout?: "featured" | "peek";
  }>(),
  { layout: "featured" },
);

// Scrims have no map of their own, so the big card borrows one.
const ART = "de_inferno";

const shown = computed(() =>
  props.scrims.teams.slice(0, props.layout === "featured" ? 3 : 2),
);

const touchTarget =
  "relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] [@media(pointer:fine)]:after:hidden";
</script>

<template>
  <PlayWayCard
    :layout="layout"
    :title="$t('pages.play.more_ways.scrims.title')"
    :icon="Swords"
    :art="ART"
  >
    <template v-if="layout === 'featured' && scrims.teamsToday > 0" #kicker>
      <Swords class="size-3.5 shrink-0" aria-hidden="true" />
      <span>
        <b class="tabular-nums">{{ scrims.teamsToday }}</b>
        {{ $t("pages.play.more_ways.scrims.teams_today", scrims.teamsToday) }}
      </span>
    </template>

    <template v-if="layout === 'featured'">
      {{
        scrims.managesTeam === false
          ? $t("pages.play.more_ways.scrims.needs_team")
          : $t("pages.play.more_ways.scrims.post_hint")
      }}
    </template>
    <template v-else-if="scrims.teamsToday > 0">
      <b class="font-semibold tabular-nums text-foreground">{{
        scrims.teamsToday
      }}</b>
      {{ $t("pages.play.more_ways.scrims.teams_today", scrims.teamsToday) }}
    </template>
    <template v-else>
      {{
        scrims.managesTeam === false
          ? $t("pages.play.more_ways.scrims.needs_team")
          : $t("pages.play.more_ways.scrims.none_today")
      }}
    </template>

    <template #preview>
      <ul
        v-if="shown.length"
        :class="[
          'm-0 grid list-none gap-1 p-0',
          layout === 'featured' && 'mt-1 max-w-80',
        ]"
      >
        <li
          v-for="team in shown"
          :key="team.id"
          class="flex min-w-0 items-center gap-2.5 text-[13px]"
        >
          <TeamsEmblem
            :team="{ name: team.name, avatar_url: team.avatarUrl }"
            :size="24"
          />
          <b class="min-w-0 flex-1 truncate font-semibold">{{ team.name }}</b>
          <span
            :class="[
              'shrink-0 text-xs tabular-nums',
              layout === 'featured'
                ? 'text-foreground/70'
                : 'text-muted-foreground',
            ]"
          >
            {{ scrimWindowLabel(team) }}
          </span>
        </li>
      </ul>
      <p
        v-else-if="layout === 'peek'"
        class="m-0 rounded-md border border-dashed border-border px-2.5 py-2 text-[12.5px] text-muted-foreground [text-wrap:pretty]"
      >
        {{ $t("pages.play.more_ways.scrims.post_hint") }}
      </p>
    </template>

    <template #actions>
      <Button
        as-child
        size="sm"
        :variant="layout === 'featured' ? 'default' : 'outline'"
        :class="[
          'h-8',
          touchTarget,
          layout === 'featured' &&
            'bg-[hsl(var(--tac-amber))] font-semibold text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)] max-md:flex-1',
        ]"
      >
        <NuxtLink to="/scrims">
          {{
            scrims.teamsToday > 0
              ? $t("pages.play.more_ways.scrims.find")
              : $t("pages.play.more_ways.scrims.post")
          }}
        </NuxtLink>
      </Button>
    </template>
  </PlayWayCard>
</template>
