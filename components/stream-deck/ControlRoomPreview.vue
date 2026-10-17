<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Lock, Server, ServerOff } from "lucide-vue-next";
import mapLabel from "~/utilities/mapLabel";
import StatusDot from "~/components/admin/StatusDot.vue";
import { TONE_TEXT, type Tone } from "~/components/admin/tone";
import {
  currentMapFor,
  matchReadiness,
  type ControlRoomMatch,
} from "~/utilities/controlRoom";

// One preview monitor: the map behind a small lower third, the match's state
// and server under it, and in plain words why it can't go on air yet. Only
// the on-air match has a picture, and that one is on the program monitor --
// a second player here would double the stream for nothing.
type PreviewMatch = ControlRoomMatch & {
  is_in_lineup?: boolean | null;
  is_coach?: boolean | null;
  server_region?: string | null;
  lineup_1?: { name: string | null } | null;
  lineup_2?: { name: string | null } | null;
  options?: { best_of?: number | null } | null;
  tournament_brackets?: Array<{
    stage?: { tournament?: { name?: string | null } | null } | null;
  }> | null;
};

const props = defineProps<{
  match: PreviewMatch;
  selected: boolean;
  // How this match is on air, if it is.
  onAir: "live" | "starting" | "stopped" | null;
}>();

const emit = defineEmits<{ (e: "select"): void }>();

const { t } = useI18n();

const current = computed(() => currentMapFor(props.match));
const poster = computed(
  () =>
    current.value?.map?.poster ??
    props.match.match_maps?.[0]?.map?.poster ??
    null,
);
const isLive = computed(() => props.match.status === "Live");
const reason = computed(() => matchReadiness(props.match));
const playing = computed(
  () => !!(props.match.is_in_lineup || props.match.is_coach),
);

const score = computed(() =>
  isLive.value && current.value
    ? {
        l: current.value.lineup_1_score ?? 0,
        r: current.value.lineup_2_score ?? 0,
      }
    : null,
);

const meta = computed(() => {
  const m = props.match;
  if (m.status === "Veto") return t("match.stream.card.veto");
  if (m.status === "WaitingForServer")
    return t("match.stream.card.waiting_for_server");
  if (m.status === "WaitingForCheckIn") return t("match.stream.card.check_in");
  const parts: string[] = [];
  const label = mapLabel(current.value?.map);
  if (label) parts.push(label);
  if (current.value) {
    parts.push(
      t("match.stream.card.round", {
        round:
          (current.value.lineup_1_score ?? 0) +
          (current.value.lineup_2_score ?? 0) +
          1,
      }),
    );
  }
  const maps = m.match_maps ?? [];
  const bestOf = m.options?.best_of ?? 1;
  const idx = current.value
    ? maps.findIndex((x) => x.id === current.value!.id)
    : -1;
  if (bestOf > 1 && idx >= 0) {
    parts.push(
      t("match.stream.card.map_of", { current: idx + 1, total: bestOf }),
    );
  }
  return parts.join(" · ");
});

const eventName = computed(
  () => props.match.tournament_brackets?.[0]?.stage?.tournament?.name ?? null,
);

const statusLabel = computed(() => {
  const s = props.match.status;
  if (s === "Live") return t("common.live");
  if (s === "Veto") return t("pages.control_room.status.veto");
  if (s === "WaitingForServer")
    return t("pages.control_room.status.spinning_up");
  if (s === "WaitingForCheckIn") return t("pages.control_room.status.check_in");
  return s;
});

// Veto is the match setting up, not a warning; only a live match pings.
const statusTone = computed<Tone>(() => {
  const s = props.match.status;
  if (s === "Live") return "ok";
  if (s === "Veto") return "info";
  if (s === "WaitingForServer") return "warn";
  return "off";
});

const server = computed(() => {
  const m = props.match;
  if (!m.server_id)
    return { text: t("stream_deck.no_server"), tone: TONE_TEXT.bad };
  const region = m.server_region || t("stream_deck.server_assigned");
  return m.is_server_online
    ? { text: region, tone: TONE_TEXT.off }
    : {
        text: `${region} · ${t("stream_deck.offline")}`,
        tone: TONE_TEXT.warn,
      };
});
</script>

<template>
  <button
    type="button"
    class="group grid w-full gap-1.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    :aria-pressed="selected"
    @click="emit('select')"
  >
    <div
      class="relative aspect-video w-full overflow-hidden rounded-lg border bg-black transition-[border-color,box-shadow,opacity] duration-150"
      :class="[
        selected
          ? 'border-[hsl(var(--tac-amber))] shadow-[0_0_0_1px_hsl(var(--tac-amber))]'
          : onAir
            ? 'border-destructive/60'
            : 'border-border group-hover:border-muted-foreground/40',
        !onAir && reason ? 'opacity-60' : '',
      ]"
    >
      <div
        v-if="poster"
        aria-hidden="true"
        class="absolute -inset-[4%] bg-cover bg-center blur-[10px] brightness-[.42] saturate-[.85]"
        :style="{ backgroundImage: `url(${poster})` }"
      />
      <div
        aria-hidden="true"
        class="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgba(0,0,0,0.55))]"
      />

      <span
        v-if="onAir"
        class="absolute left-2 top-2 rounded-[2px] px-1.5 py-1 text-[0.625rem] font-bold leading-none"
        :class="
          onAir === 'live'
            ? 'bg-destructive uppercase tracking-[0.12em] text-destructive-foreground'
            : 'bg-muted text-muted-foreground'
        "
      >
        {{
          onAir === "live"
            ? $t("common.live")
            : onAir === "starting"
              ? $t("pages.control_room.starting")
              : $t("match.stream.stopped")
        }}
      </span>

      <div
        class="absolute bottom-2 left-2 w-[min(15rem,calc(100%-1rem))] overflow-hidden rounded-[3px] bg-background/90 px-2.5 py-1.5 shadow-[0_12px_28px_-14px_rgba(0,0,0,0.85)]"
      >
        <div
          v-for="(side, i) in [
            {
              name: match.lineup_1?.name ?? $t('common.team_a'),
              score: score?.l,
            },
            {
              name: match.lineup_2?.name ?? $t('common.team_b'),
              score: score?.r,
            },
          ]"
          :key="i"
          class="flex items-center justify-between gap-2 text-[0.8rem] font-semibold leading-tight"
          :class="
            score && side.score! < (i === 0 ? score.r : score.l)
              ? 'text-muted-foreground'
              : 'text-foreground'
          "
        >
          <span class="truncate">{{ side.name }}</span>
          <span v-if="score" class="min-w-5 text-right tabular-nums">{{
            side.score
          }}</span>
        </div>
        <p class="mt-0.5 truncate text-[0.68rem] text-muted-foreground">
          <template v-if="eventName">{{ eventName }} · </template>{{ meta }}
        </p>
      </div>
    </div>

    <div
      class="flex min-w-0 items-center gap-1.5 px-0.5 text-xs text-muted-foreground"
    >
      <StatusDot :tone="statusTone" :live="isLive" size="sm" />
      <span class="shrink-0">{{ statusLabel }}</span>
      <span class="text-muted-foreground/40">·</span>
      <component
        :is="match.server_id ? Server : ServerOff"
        class="size-3 shrink-0"
        :class="server.tone"
      />
      <span class="min-w-0 truncate" :class="server.tone">{{
        server.text
      }}</span>
      <Lock
        v-if="playing"
        class="size-3 shrink-0"
        :aria-label="$t('pages.control_room.you_are_playing')"
      />
      <span class="ml-auto shrink-0 whitespace-nowrap">
        <span v-if="onAir" class="font-medium text-destructive">{{
          $t("pages.control_room.on_air")
        }}</span>
        <span v-else-if="!reason" class="text-success">{{
          $t("pages.control_room.ready")
        }}</span>
        <span v-else class="text-muted-foreground/70">{{
          $t("pages.control_room.not_ready")
        }}</span>
      </span>
    </div>
    <p
      v-if="!onAir && reason"
      class="px-0.5 text-xs leading-snug text-muted-foreground/80"
    >
      {{ $t(`pages.control_room.reasons.${reason}`) }}
    </p>
  </button>
</template>
