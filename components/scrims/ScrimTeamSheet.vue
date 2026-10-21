<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { AlertTriangle, Check, ExternalLink, Info, Lock, Plus, X } from "lucide-vue-next";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import { signInWithSteam } from "~/utilities/loginLinks";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "~/components/ui/sheet";
import ScrimRequestCard from "~/components/scrims/ScrimRequestCard.vue";
import ScrimRequestForm from "~/components/scrims/ScrimRequestForm.vue";
import {
  scrimOpponent,
  useMyScrimTeams,
  useScrimClock,
  useScrimMaps,
  useScrimTeamRequests,
} from "~/composables/useScrimFinder";
import { useAuthStore } from "~/stores/AuthStore";
import teamAvatarSrc from "~/utilities/teamAvatar";
import mapLabel from "~/utilities/mapLabel";
import { dayLabel, numberLabel, rangeLabel, timeLabel } from "~/utilities/scrimFormat";
import { openIntervals } from "~/utilities/scrimSchedule";
import { mineSide, postingView } from "~/utilities/scrimPosting";

const open = defineModel<boolean>("open", { required: true });
const props = defineProps<{ posting: any | null; at?: number | null }>();
const emit = defineEmits<{ (e: "edit-listing"): void }>();

const { t } = useI18n();
const auth = useAuthStore();
const now = useScrimClock();
const { mapsById } = useScrimMaps();
const { teams, memberTeamIds, activeTeam, setActiveTeam } = useMyScrimTeams();
const { requests, booked } = useScrimTeamRequests(() => activeTeam.value?.id);

const team = computed(() => props.posting?.team ?? {});
const isMember = computed(() => memberTeamIds.value.includes(props.posting?.team_id));
const fromTeams = computed(() => teams.value.filter((item) => item.id !== props.posting?.team_id));
const mine = computed(() =>
  activeTeam.value && activeTeam.value.id !== props.posting?.team_id
    ? activeTeam.value
    : fromTeams.value[0] ?? null,
);
const view = computed(() =>
  props.posting
    ? postingView(
        props.posting,
        mineSide(mine.value, now.value),
        mine.value?.id ?? null,
        mine.value?.id === activeTeam.value?.id ? requests.value : [],
        now.value,
      )
    : null,
);
const fit = computed(() => view.value?.fit ?? null);
const request = computed(() => view.value?.request ?? null);
const reputation = computed(() => team.value.reputation ?? null);
const maps = computed(() =>
  (props.posting?.map_ids ?? []).map((id: string) => mapsById.value[id]).filter(Boolean),
);
const hours = computed(() =>
  openIntervals(team.value.scrim_availability, now.value).slice(0, 8),
);

const rangeText = (min: number | null | undefined, max: number | null | undefined) => {
  if (min == null && max == null) return t("scrims.sheet.any_elo");
  if (min == null) return t("scrims.sheet.up_to", { elo: numberLabel(max) });
  if (max == null) return t("scrims.sheet.and_up", { elo: numberLabel(min) });
  return `${numberLabel(min)}–${numberLabel(max)}`;
};
const theirRange = computed(() => rangeText(props.posting?.elo_min, props.posting?.elo_max));
const ourRange = computed(() =>
  rangeText(mine.value?.scrim_settings?.elo_min, mine.value?.scrim_settings?.elo_max),
);

// Why the ranges don't fit, whichever side says no.
const eloProblem = computed(() => {
  const value = fit.value;
  if (!value || !mine.value || (value.theyAccept && value.weAccept)) return "";
  const myElo = mine.value.ranks?.avg_elo ?? null;
  const theirElo = team.value.ranks?.avg_elo ?? null;
  const names = { them: team.value.name, team: mine.value.name };
  if (!value.theyAccept) {
    if (myElo == null) return t("scrims.fit.their_range_no_elo", { ...names, range: theirRange.value });
    return t(
      myElo < (props.posting.elo_min ?? -Infinity) ? "scrims.fit.their_range_below" : "scrims.fit.their_range_above",
      { ...names, range: theirRange.value, elo: numberLabel(myElo) },
    );
  }
  if (theirElo == null) return t("scrims.fit.our_range_no_elo", { ...names, range: ourRange.value });
  return t(
    theirElo < (mine.value.scrim_settings?.elo_min ?? -Infinity) ? "scrims.fit.our_range_below" : "scrims.fit.our_range_above",
    { ...names, range: ourRange.value, elo: numberLabel(theirElo) },
  );
});

const blockText = computed(() => {
  if (fit.value?.block === "booked" && mine.value) {
    return t("scrims.fit.booked", {
      team: mine.value.name,
      opponent: booked.value ? scrimOpponent(booked.value, mine.value.id)?.name : "",
    });
  }
  return eloProblem.value;
});

const fitLines = computed(() => {
  const value = fit.value;
  if (!value || !mine.value) return [];
  const lines: Array<{ tone: "ok" | "info" | "bad"; text: string }> = [];
  lines.push(
    value.theyAccept && value.weAccept
      ? { tone: "ok", text: t("scrims.fit.elo_ok", { team: mine.value.name, elo: numberLabel(mine.value.ranks?.avg_elo) }) }
      : { tone: "bad", text: eloProblem.value },
  );
  const theirRegions = props.posting.regions ?? [];
  const myRegions = mine.value.scrim_settings?.regions ?? [];
  if (!theirRegions.length || !myRegions.length) {
    lines.push({ tone: "ok", text: t("scrims.fit.region_any") });
  } else if (value.regions.length) {
    lines.push({ tone: "ok", text: t("scrims.fit.region_shared", { regions: value.regions.join(", ") }) });
  } else {
    lines.push({ tone: "info", text: t("scrims.fit.region_none", { theirs: theirRegions.join(", "), yours: myRegions.join(", ") }) });
  }
  if (value.shared) {
    lines.push({
      tone: "ok",
      text: t("scrims.fit.time_shared", {
        day: dayLabel(value.shared.start, now.value, { inline: true }),
        range: rangeLabel(value.shared.start, value.shared.end),
      }),
    });
  } else {
    lines.push({
      tone: "info",
      text: props.posting.allow_outside_availability ? t("scrims.fit.time_none_outside") : t("scrims.fit.time_none"),
    });
  }
  if (!(props.posting.map_ids ?? []).length) {
    lines.push({ tone: "ok", text: t("scrims.fit.maps_any") });
  } else if (value.mapsShared.length) {
    lines.push({
      tone: "ok",
      text: t(
        "scrims.fit.maps_shared",
        {
          count: value.mapsShared.length,
          maps: value.mapsShared.map((id) => mapLabel(mapsById.value[id])).filter(Boolean).join(", "),
        },
        value.mapsShared.length,
      ),
    });
  } else {
    lines.push({ tone: "info", text: t("scrims.fit.maps_none") });
  }
  return lines;
});

function chooseTeam(id: string) {
  setActiveTeam(id);
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
      <SheetTitle class="sr-only">{{ team.name }}</SheetTitle>
      <SheetDescription class="sr-only">{{ $t("scrims.sheet.description") }}</SheetDescription>
      <div v-if="posting" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-0 pt-5">
        <div class="grid gap-5 pb-5">
          <div class="flex items-start gap-3 pr-8">
            <Avatar shape="square" class="h-12 w-12 shrink-0 rounded-lg">
              <AvatarImage v-if="teamAvatarSrc(team)" :src="teamAvatarSrc(team)!" :alt="team.name" />
              <AvatarFallback class="rounded-lg text-sm font-semibold uppercase">
                {{ (team.name || "?").slice(0, 2) }}
              </AvatarFallback>
            </Avatar>
            <div class="grid min-w-0 gap-1">
              <h2 class="text-lg font-semibold leading-tight [text-wrap:balance]">{{ team.name }}</h2>
              <span class="text-sm text-muted-foreground">
                {{ posting.regions?.length ? posting.regions.join(", ") : $t("scrims.board.any_region") }}
                <template v-if="team.ranks?.roster_size">
                  · {{ $t("scrims.sheet.players", { count: team.ranks.roster_size }, team.ranks.roster_size) }}
                </template>
              </span>
              <NuxtLink
                :to="`/teams/${posting.team_id}`"
                class="inline-flex w-fit items-center gap-1 text-sm text-[hsl(var(--tac-amber))] hover:underline"
              >
                {{ $t("scrims.sheet.team_page") }}
                <ExternalLink class="h-3 w-3" />
              </NuxtLink>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
            <div class="grid min-w-0 gap-0.5 bg-card px-3 py-2.5">
              <span class="text-xs text-muted-foreground">{{ $t("scrims.sheet.elo") }}</span>
              <span class="text-base font-semibold tabular-nums">{{ numberLabel(team.ranks?.avg_elo) }}</span>
              <span class="text-xs text-muted-foreground/80">{{ $t("scrims.sheet.takes", { range: theirRange }) }}</span>
            </div>
            <div class="grid min-w-0 gap-0.5 bg-card px-3 py-2.5">
              <span class="text-xs text-muted-foreground">{{ $t("scrims.sheet.reliability") }}</span>
              <span class="text-base font-semibold tabular-nums">
                {{ reputation?.reliability_pct != null ? `${reputation.reliability_pct}%` : $t("scrims.sheet.new") }}
              </span>
              <span class="text-xs text-muted-foreground/80">
                <template v-if="reputation?.reliability_pct != null">
                  {{ $t("scrims.board.played", { count: reputation.scrims_completed ?? 0 }) }}<template v-if="reputation.no_shows"> · {{ $t("scrims.sheet.no_shows", { count: reputation.no_shows }, reputation.no_shows) }}</template><template v-if="reputation.late_cancels"> · {{ $t("scrims.sheet.late_cancels", { count: reputation.late_cancels }, reputation.late_cancels) }}</template>
                </template>
                <template v-else>{{ $t("scrims.sheet.no_scrims") }}</template>
              </span>
            </div>
            <div class="grid min-w-0 gap-0.5 bg-card px-3 py-2.5">
              <span class="text-xs text-muted-foreground">{{ $t("scrims.sheet.premier_faceit") }}</span>
              <span class="text-base font-semibold tabular-nums">{{ numberLabel(team.ranks?.avg_premier) }}</span>
              <span class="text-xs text-muted-foreground/80">
                {{
                  team.ranks?.avg_faceit_level
                    ? $t("scrims.sheet.faceit_level", { level: Math.round(team.ranks.avg_faceit_level) })
                    : $t("scrims.sheet.not_linked")
                }}
              </span>
            </div>
          </div>

          <blockquote
            v-if="posting.notes"
            class="border-l-2 border-border py-1 pl-3 text-sm text-muted-foreground [text-wrap:pretty]"
          >
            {{ posting.notes }}
          </blockquote>

          <section v-if="fitLines.length" class="grid gap-2">
            <h3 class="text-xs font-medium text-muted-foreground">{{ $t("scrims.sheet.how_you_fit") }}</h3>
            <ul class="grid gap-2 text-sm">
              <li v-for="(line, index) in fitLines" :key="index" class="flex items-start gap-2.5">
                <Check v-if="line.tone === 'ok'" class="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                <Info v-else-if="line.tone === 'info'" class="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]" />
                <X v-else class="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span class="min-w-0 [text-wrap:pretty]">{{ line.text }}</span>
              </li>
            </ul>
          </section>

          <section class="grid gap-2">
            <h3 class="text-xs font-medium text-muted-foreground">{{ $t("scrims.sheet.maps") }}</h3>
            <div v-if="maps.length" class="flex flex-wrap gap-1.5">
              <span
                v-for="map in maps"
                :key="map.id"
                class="inline-flex h-7 items-center gap-1.5 rounded-md border pl-1 pr-2.5 text-xs"
                :class="
                  mine?.scrim_settings?.map_ids?.includes(map.id)
                    ? 'border-border text-foreground'
                    : 'border-border/60 text-muted-foreground'
                "
              >
                <img v-if="map.patch" :src="map.patch" :alt="mapLabel(map)" class="h-5 w-5 object-contain" />
                {{ mapLabel(map) }}
              </span>
            </div>
            <p v-else class="text-sm text-muted-foreground">{{ $t("scrims.sheet.any_map") }}</p>
          </section>

          <section v-if="!mine" class="grid gap-2">
            <h3 class="text-xs font-medium text-muted-foreground">{{ $t("scrims.sheet.open_hours") }}</h3>
            <div v-if="hours.length" class="grid gap-1 text-sm">
              <div v-for="interval in hours" :key="interval.start" class="flex gap-3">
                <span class="w-24 shrink-0 text-muted-foreground">
                  {{ interval.start <= now.getTime() ? $t("scrims.board.now") : dayLabel(interval.start, now) }}
                </span>
                <span class="tabular-nums">
                  {{
                    interval.start <= now.getTime()
                      ? $t("scrims.board.until", { time: timeLabel(interval.end) })
                      : rangeLabel(interval.start, interval.end)
                  }}
                </span>
              </div>
            </div>
            <p v-else class="text-sm text-muted-foreground">{{ $t("scrims.sheet.no_hours") }}</p>
          </section>

          <div v-if="!auth.me" class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 p-3.5">
            <p class="min-w-[12rem] flex-1 text-sm text-muted-foreground">{{ $t("scrims.cta.guest") }}</p>
            <Button size="sm" class="tac-amber-cta gap-1.5" @click="signInWithSteam">
              <SteamIcon class="h-3.5 w-3.5" />
              {{ $t("scrims.cta.sign_in") }}
            </Button>
          </div>

          <p v-else-if="isMember" class="rounded-lg border border-border bg-card/40 p-3.5 text-sm text-muted-foreground">
            {{ $t("scrims.sheet.your_team") }}
          </p>

          <div v-else-if="!mine" class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 p-3.5">
            <p class="min-w-[12rem] flex-1 text-sm text-muted-foreground">{{ $t("scrims.cta.player") }}</p>
            <Button as-child size="sm" variant="outline" class="gap-1.5">
              <NuxtLink to="/teams/create"><Plus class="h-3.5 w-3.5" />{{ $t("scrims.cta.create_team") }}</NuxtLink>
            </Button>
          </div>

          <template v-else>
            <div v-if="fromTeams.length > 1" class="grid gap-1.5">
              <label for="scrim-from-team" class="text-xs font-medium text-muted-foreground">
                {{ $t("scrims.sheet.send_from") }}
              </label>
              <select
                id="scrim-from-team"
                class="h-8 rounded-md border border-input bg-background px-2 text-sm"
                :value="mine.id"
                @change="chooseTeam(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="item in fromTeams" :key="item.id" :value="item.id">{{ item.name }}</option>
              </select>
            </div>

            <section v-if="request" class="grid gap-2">
              <h3 class="text-xs font-medium text-muted-foreground">{{ $t("scrims.sheet.your_scrim") }}</h3>
              <ScrimRequestCard
                :request="request"
                :team-id="mine.id"
                :team-name="mine.name"
                :now="now"
                :mine="openIntervals(mine.scrim_availability, now)"
                :locked-by="booked && booked.id !== request.id ? scrimOpponent(booked, mine.id)?.name : null"
                show-status
                urgent
              />
            </section>

            <div
              v-else-if="fit?.block"
              class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/40 p-3.5 text-sm"
            >
              <Lock v-if="fit.block === 'booked'" class="h-4 w-4 shrink-0 text-muted-foreground" />
              <AlertTriangle v-else class="h-4 w-4 shrink-0 text-red-400" />
              <span class="min-w-[12rem] flex-1 [text-wrap:pretty]">{{ blockText }}</span>
              <Button
                v-if="fit.block === 'our_range'"
                size="sm"
                variant="outline"
                @click="emit('edit-listing'); open = false"
              >
                {{ $t("scrims.sheet.widen") }}
              </Button>
            </div>

            <section v-else class="grid gap-3">
              <h3 class="text-xs font-medium text-muted-foreground">{{ $t("scrims.sheet.request_title") }}</h3>
              <ScrimRequestForm :posting="posting" :team="mine" :now="now" :initial-at="at" />
            </section>
          </template>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>
