<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Check } from "lucide-vue-next";
import type {
  TickerCellModel,
  TickerPlayer,
} from "~/components/watch/watchTicker";
import { streamPlatformMeta } from "~/components/watch/streamPlatform";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useAuthStore } from "~/stores/AuthStore";
import { resolveAvatarUrl } from "~/utilities/avatarUrl";

const MAX_FACES = 5;

const props = defineProps<{
  model: TickerCellModel;
  // The live match currently on the /watch stage.
  staged?: boolean;
}>();

const { t } = useI18n();

const platform = computed(() => streamPlatformMeta(props.model.streams[0]));
const mySteamId = computed(() => useAuthStore().me?.steam_id);

// Team and player avatars are stored as paths on the API host.
const apiDomain = useRuntimeConfig().public.apiDomain;
function avatarSrc(path: string) {
  return resolveAvatarUrl(path, apiDomain, 64) ?? undefined;
}

// Before it goes live the step is the status ("Check-in", "Map veto"); a
// final carries how it ended ("Final · Forfeit").
const statusText = computed(() => {
  const { text, detail } = props.model.status;
  if (props.model.kind === "pre") return detail ?? text;
  return detail ? `${text} · ${detail}` : text;
});

function faces(players: TickerPlayer[]) {
  return players.slice(0, MAX_FACES);
}

function seats(players: TickerPlayer[], open: number) {
  return Math.max(0, Math.min(open, MAX_FACES - players.length));
}

function names(players: TickerPlayer[]) {
  return players.map((player) => player.name).join(", ");
}

const ariaLabel = computed(() =>
  [
    `${props.model.teams[0].name} – ${props.model.teams[1].name}`,
    statusText.value,
    props.model.checkIn
      ? t("pages.watch.ticker.check_in", props.model.checkIn)
      : null,
    props.model.teams[0].score !== null
      ? `${props.model.teams[0].score}–${props.model.teams[1].score}`
      : null,
    props.model.tag,
  ]
    .filter(Boolean)
    .join(", "),
);

const cellClasses = computed(() => [
  "group relative flex h-[5.5rem] w-56 shrink-0 snap-start flex-col gap-1.5 rounded-lg border px-3 pb-2.5 pt-2 text-left transition-[background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  props.staged
    ? "border-[hsl(var(--tac-amber))] bg-muted/30 shadow-[inset_0_0_0_1px_hsl(var(--tac-amber))]"
    : props.model.kind === "pre"
      ? "border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.06)] hover:border-[hsl(var(--tac-amber)/0.7)] hover:bg-[hsl(var(--tac-amber)/0.1)]"
      : "border-border bg-muted/20 hover:border-foreground/20 hover:bg-muted/40",
]);

const checkInWidth = computed(() =>
  props.model.checkIn
    ? `${(props.model.checkIn.checked / props.model.checkIn.total) * 100}%`
    : "0%",
);
</script>

<template>
  <NuxtLink
    :to="{ name: 'matches-id', params: { id: model.id } }"
    :class="cellClasses"
    :aria-label="ariaLabel"
    :aria-current="staged ? 'true' : undefined"
  >
    <span
      class="flex h-4 items-center justify-between gap-2 text-xs text-muted-foreground"
    >
      <span
        class="inline-flex min-w-0 max-w-[70%] shrink-0 items-center gap-1.5 tabular-nums"
        :class="{
          'font-semibold text-foreground':
            model.kind === 'live' || model.kind === 'upcoming',
          'font-bold text-[hsl(var(--tac-amber))]': model.kind === 'pre',
        }"
      >
        <span
          v-if="model.status.dot"
          class="relative inline-flex size-2 shrink-0"
        >
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 motion-reduce:animate-none"
            :class="
              model.status.dot === 'live'
                ? 'bg-destructive'
                : 'bg-[hsl(var(--tac-amber))]'
            "
          ></span>
          <span
            class="relative inline-flex size-2 rounded-full"
            :class="
              model.status.dot === 'live'
                ? 'bg-destructive'
                : 'bg-[hsl(var(--tac-amber))]'
            "
          ></span>
        </span>
        <span class="truncate">{{ statusText }}</span>
      </span>
      <span class="inline-flex min-w-0 items-center justify-end gap-1.5">
        <span v-if="staged" class="font-semibold text-[hsl(var(--tac-amber))]">
          {{ $t("pages.watch.ticker.on_stage") }}
        </span>
        <template v-else>
          <span v-if="model.tag" class="min-w-0 truncate" :title="model.tag">
            {{ model.tag }}
          </span>
          <component
            :is="platform.icon"
            v-if="platform"
            class="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </template>
        <span
          v-if="model.you"
          class="inline-flex shrink-0 items-center gap-1 font-semibold text-[hsl(var(--tac-amber))]"
        >
          <span class="size-1.5 rounded-full bg-[hsl(var(--tac-amber))]"></span>
          {{ $t("pages.watch.ticker.you") }}
        </span>
      </span>
    </span>

    <span
      v-for="(team, i) in model.teams"
      :key="i"
      class="flex h-5 min-w-0 items-center gap-2 text-[13px] font-semibold"
      :class="
        team.emphasis === 'trail' ||
        (model.kind === 'result' && team.emphasis !== 'win')
          ? 'text-muted-foreground'
          : 'text-foreground'
      "
    >
      <img
        v-if="team.avatar"
        :src="avatarSrc(team.avatar)"
        alt=""
        class="size-5 shrink-0 rounded-[4px] object-cover"
        loading="lazy"
      />
      <span
        v-else
        aria-hidden="true"
        class="inline-grid size-5 shrink-0 place-items-center rounded-[4px] bg-muted text-[0.6rem] font-extrabold tracking-wide text-foreground/80"
        >{{ team.monogram }}</span
      >
      <Tooltip v-if="team.players" :delay-duration="120">
        <TooltipTrigger as-child>
          <span class="flex min-w-0 flex-1 items-center">
            <span
              class="flex shrink-0 items-center -space-x-[5px] group-hover:-space-x-px [&>*]:transition-[margin] [&>*]:duration-150 [&>*]:ease-out motion-reduce:[&>*]:transition-none"
            >
              <template
                v-for="player in faces(team.players)"
                :key="player.steamId"
              >
                <img
                  v-if="player.avatar"
                  :src="avatarSrc(player.avatar)"
                  alt=""
                  class="size-[18px] shrink-0 rounded-full object-cover ring-2"
                  :class="[
                    player.steamId === mySteamId
                      ? 'ring-[hsl(var(--tac-amber))]'
                      : 'ring-background',
                    { 'opacity-40 grayscale': player.waiting },
                  ]"
                  loading="lazy"
                />
                <span
                  v-else
                  class="inline-grid size-[18px] shrink-0 place-items-center rounded-full bg-muted text-[0.55rem] font-bold uppercase text-foreground/80 ring-2 ring-background"
                  :class="{ 'opacity-40': player.waiting }"
                  >{{ player.name.slice(0, 1) }}</span
                >
              </template>
              <span
                v-for="n in seats(team.players, team.openSeats)"
                :key="`seat-${n}`"
                class="size-[18px] shrink-0 rounded-full border border-dashed border-muted-foreground/50 bg-background"
              ></span>
            </span>
            <span
              v-if="team.players.length <= 2"
              class="ml-2 min-w-0 truncate"
              :class="{ 'font-bold': team.emphasis === 'win' }"
              >{{ names(team.players) }}</span
            >
            <span
              v-else-if="team.players.length > MAX_FACES"
              class="ml-1.5 text-[11px] font-medium text-muted-foreground"
              >+{{ team.players.length - MAX_FACES }}</span
            >
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          {{ team.players.map((player) => player.name).join(" · ") }}
        </TooltipContent>
      </Tooltip>
      <span
        v-else
        class="min-w-0 flex-1 truncate"
        :class="{ 'font-bold': team.emphasis === 'win' }"
        :title="team.name"
        >{{ team.name }}</span
      >
      <span v-if="team.pips" class="inline-flex shrink-0 gap-[3px]">
        <i
          v-for="p in team.pips.total"
          :key="p"
          class="size-1.5 rounded-[1px]"
          :class="
            p <= team.pips.won
              ? 'bg-[hsl(var(--tac-amber))]'
              : 'bg-muted-foreground/30'
          "
        ></i>
      </span>
      <span
        v-if="team.score !== null"
        class="min-w-[1.125rem] text-right text-sm tabular-nums"
        :class="{ 'font-bold': team.emphasis !== 'trail' }"
        >{{ team.score }}</span
      >
      <span
        v-else-if="team.checkIn"
        class="inline-flex shrink-0 items-center gap-[3px] text-xs tabular-nums"
        :class="
          team.checkIn.checked >= team.checkIn.total
            ? 'font-bold text-[hsl(var(--tac-amber))]'
            : 'text-muted-foreground'
        "
      >
        <Check
          v-if="team.checkIn.checked >= team.checkIn.total"
          class="size-3"
          :stroke-width="3"
          aria-hidden="true"
        />
        {{ team.checkIn.checked }}/{{ team.checkIn.total }}
      </span>
    </span>

    <span
      v-if="model.checkIn"
      aria-hidden="true"
      class="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden rounded-b-[7px] bg-muted-foreground/20"
    >
      <span
        class="block h-full bg-[hsl(var(--tac-amber))] transition-[width] duration-300 motion-reduce:transition-none"
        :style="{ width: checkInWidth }"
      ></span>
    </span>
  </NuxtLink>
</template>
