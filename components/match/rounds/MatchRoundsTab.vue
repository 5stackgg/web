<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { e_sides_enum } from "~/generated/zeus";
import RewindBar from "~/components/match/rounds/RewindBar.vue";
import RoundSnapshotTable from "~/components/match/rounds/RoundSnapshotTable.vue";
import RoundsList from "~/components/match/rounds/RoundsList.vue";
import RoundsRewindStrip from "~/components/match/rounds/RoundsRewindStrip.vue";
import RoundsUndoneTray from "~/components/match/rounds/RoundsUndoneTray.vue";
import AnimatedStat from "~/components/AnimatedStat.vue";
import { FadeSwap, Fold, HeightSwap } from "~/components/ui/transitions";
import {
  defaultRestoreRound,
  playersAtStartOf,
  rewindSummary,
  scoreBefore,
  sidesIn,
  type RewindRounds,
} from "~/utilities/rewind";
import mapLabel from "~/utilities/mapLabel";

const props = defineProps<{
  data: RewindRounds;
  lineup1: string;
  lineup2: string;
  mapNumber?: number;
  canRewind?: boolean;
  blockedReason?: string | null;
  paused?: boolean;
  finished?: boolean;
  liveKills?: number;
  liveDamage?: number;
  restoring?: boolean;
}>();

const rewinding = defineModel<boolean>("rewinding", { default: false });
const target = defineModel<number | null>("target", { default: null });

const emit = defineEmits<{ restore: [number] }>();

const { t, locale } = useI18n();

const live = computed(() => props.data.live_round);
const shownRound = computed(() =>
  rewinding.value && target.value ? target.value : live.value,
);
const shownScore = computed(() => scoreBefore(props.data, shownRound.value));

const undone = computed(() =>
  props.data.rounds.filter((row) => row.undone).map((row) => row.round),
);

const sides = computed(() => sidesIn(props.data, shownRound.value));

const shownPlayers = computed(() =>
  playersAtStartOf(props.data, shownRound.value),
);
const livePlayers = computed(() => playersAtStartOf(props.data, live.value));

const number = (value: number) => value.toLocaleString(locale.value);

const summary = computed(() =>
  target.value
    ? rewindSummary(props.data, target.value, props.liveKills, props.liveDamage)
    : null,
);

function span(from: number, to: number) {
  return from === to
    ? t("match.rewind.round_n", { round: from })
    : t("match.rewind.rounds_range", { from, to });
}

const bar = computed(() => {
  const value = summary.value;
  if (!value || !target.value) {
    return null;
  }
  const stats =
    value.kills || value.damage
      ? [
          t("match.rewind.kills_count", { count: number(value.kills) }),
          t("match.rewind.damage_count", { count: number(value.damage) }),
        ]
      : [];
  const eyebrow = t("match.rewind.preview_chip", { round: target.value });
  if (value.direction === "replay") {
    return {
      eyebrow,
      stats,
      headline: t("match.rewind.replay_headline", { round: target.value }),
      detail: t("match.rewind.replay_detail"),
      confirm: t("match.rewind.replay_confirm", { round: target.value }),
    };
  }
  if (value.direction === "back") {
    return {
      eyebrow,
      stats,
      headline: t("match.rewind.back_headline", { round: target.value }),
      detail: t("match.rewind.back_detail", {
        span: span(value.from, value.to),
      }),
      confirm: t("match.rewind.restore_confirm", { round: target.value }),
    };
  }
  return {
    eyebrow,
    stats,
    headline: t("match.rewind.forward_headline", { round: target.value }),
    detail: t("match.rewind.forward_detail", {
      span: span(value.from, value.to),
    }),
    confirm: t("match.rewind.restore_confirm", { round: target.value }),
  };
});

const waiting = computed(() =>
  props.data.connected_players < props.data.expected_players
    ? {
        connected: props.data.connected_players,
        expected: props.data.expected_players,
        names: props.data.disconnected,
      }
    : null,
);

function start(round?: number) {
  target.value = round ?? defaultRestoreRound(props.data) ?? live.value;
  rewinding.value = true;
}

function cancel() {
  rewinding.value = false;
  target.value = null;
}

function onKeydown(event: KeyboardEvent) {
  if (
    event.key !== "Escape" ||
    !rewinding.value ||
    event.defaultPrevented ||
    document.querySelector('[role="dialog"], [role="alertdialog"]')
  ) {
    return;
  }
  cancel();
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

function confirm() {
  if (target.value) {
    emit("restore", target.value);
  }
}

const sideChip = (side: e_sides_enum) =>
  side === e_sides_enum.CT
    ? "bg-sky-500/15 text-sky-300"
    : "bg-amber-500/15 text-amber-300";

defineExpose({ start, cancel });
</script>

<template>
  <div class="rounds-tab flex flex-col gap-4">
    <div
      class="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/30 p-4"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          class="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{ mapLabel({ name: data.map_name }) }}
          <template v-if="mapNumber">
            · {{ $t("match.map_number", { count: mapNumber }) }}
          </template>
        </span>
        <FadeSwap>
          <span
            v-if="rewinding && target"
            key="preview"
            class="inline-flex items-center rounded border border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
          >
            {{ $t("match.rewind.preview_chip", { round: target }) }}
          </span>
          <span
            v-else-if="finished"
            key="finished"
            class="inline-flex items-center rounded border border-border px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted-foreground"
          >
            {{ $t("match.admin_bar.steps.finished") }}
          </span>
          <span
            v-else-if="paused"
            key="paused"
            class="inline-flex items-center rounded border border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.12)] px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
          >
            {{ $t("match.admin_bar.steps.paused") }}
          </span>
          <span
            v-else
            key="live"
            class="inline-flex items-center gap-1.5 rounded border border-destructive/45 px-1.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-[0.14em] text-destructive"
          >
            <span class="size-1.5 rounded-full bg-destructive" />
            {{ $t("match.admin_bar.steps.live") }}
          </span>
        </FadeSwap>
        <span class="flex-1" />
        <slot name="aside" />
        <span
          class="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{
            finished
              ? $t("match.rewind.rounds_played", {
                  count: data.rounds.filter((row) => !row.undone).length,
                })
              : $t("match.rewind.round_in_progress", { round: live })
          }}
        </span>
      </div>

      <div class="flex items-center justify-center gap-5 sm:gap-7">
        <div class="flex min-w-0 items-center gap-2.5">
          <span
            class="rounded px-1.5 py-0.5 font-mono text-[0.6rem] font-bold"
            :class="sideChip(sides.lineup1)"
          >
            {{ sides.lineup1 === e_sides_enum.CT ? "CT" : "T" }}
          </span>
          <span class="truncate text-lg font-bold">{{ lineup1 }}</span>
        </div>
        <div class="flex flex-col items-center">
          <span
            class="text-4xl font-extrabold tabular-nums transition-colors duration-300 ease-out motion-reduce:transition-none"
            :class="rewinding && 'text-[hsl(var(--tac-amber))]'"
          >
            <AnimatedStat :value="shownScore[0]" /><span
              class="px-3 text-muted-foreground/40"
              >:</span
            ><AnimatedStat :value="shownScore[1]" />
          </span>
        </div>
        <div class="flex min-w-0 items-center gap-2.5">
          <span class="truncate text-lg font-bold">{{ lineup2 }}</span>
          <span
            class="rounded px-1.5 py-0.5 font-mono text-[0.6rem] font-bold"
            :class="sideChip(sides.lineup2)"
          >
            {{ sides.lineup2 === e_sides_enum.CT ? "CT" : "T" }}
          </span>
        </div>
      </div>

      <RoundsRewindStrip
        :data="data"
        :lineup1="lineup1"
        :lineup2="lineup2"
        :rewinding="rewinding"
        :target="target"
        :can-rewind="canRewind"
        @update:target="start($event)"
      />

      <FadeSwap v-if="canRewind || rewinding" class="min-h-[1.25rem]">
        <p
          v-if="!rewinding || !summary"
          key="hint"
          class="truncate pt-0.5 text-xs text-muted-foreground"
        >
          {{ $t("match.rewind.click_hint") }}
        </p>
        <div
          v-else
          key="legend"
          class="flex items-center gap-x-4 pt-0.5 text-xs"
        >
          <span class="flex min-w-0 flex-1 items-center gap-2">
            <span
              v-if="summary?.direction !== 'forward'"
              class="rewind-swatch size-3.5 shrink-0 rounded-[3px]"
              aria-hidden="true"
            />
            <span v-if="summary" class="truncate">
              {{
                summary.direction === "forward"
                  ? $t("match.rewind.legend_forward", {
                      span: span(summary.from, summary.to),
                    })
                  : summary.direction === "replay"
                    ? $t("match.rewind.legend_replay")
                    : $t("match.rewind.legend_back", {
                        span: span(summary.from, summary.to),
                      })
              }}
            </span>
          </span>
          <span
            class="legend-rules min-w-0 max-w-[45%] shrink truncate text-muted-foreground"
            :title="$t('match.rewind.legend_rules')"
          >
            {{ $t("match.rewind.legend_rules") }}
          </span>
        </div>
      </FadeSwap>

      <Fold :open="undone.length > 0">
        <RoundsUndoneTray
          :rounds="undone"
          :live-round="live"
          :can-bring-back="canRewind && !rewinding"
          @bring-back="start((undone.at(-1) ?? live) + 1)"
        />
      </Fold>

      <p
        v-if="!canRewind && blockedReason"
        class="text-xs text-muted-foreground"
      >
        {{ blockedReason }}
      </p>
    </div>

    <HeightSwap>
      <div
        v-if="rewinding && target"
        key="snapshot"
        class="flex flex-col gap-3"
      >
        <div class="snapshot-grid grid gap-3">
          <RoundSnapshotTable
            :name="lineup1"
            :side="sides.lineup1"
            :players="shownPlayers.filter((player) => player.lineup === 1)"
            :now="livePlayers.filter((player) => player.lineup === 1)"
            :round="target"
            :offline="data.disconnected"
          />
          <RoundSnapshotTable
            :name="lineup2"
            :side="sides.lineup2"
            :players="shownPlayers.filter((player) => player.lineup === 2)"
            :now="livePlayers.filter((player) => player.lineup === 2)"
            :round="target"
            :offline="data.disconnected"
          />
        </div>
        <p class="text-xs text-muted-foreground">
          {{
            data.economy_hidden
              ? $t("match.recovery.restore.economy_hidden")
              : $t("match.rewind.amber_hint")
          }}
        </p>
      </div>
      <RoundsList
        v-else
        key="list"
        :data="data"
        :lineup1="lineup1"
        :lineup2="lineup2"
        :can-rewind="canRewind"
        @rewind-to="start($event)"
      />
    </HeightSwap>

    <Transition
      enter-active-class="transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition-[opacity,transform] duration-150 ease-in motion-reduce:transition-none"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div v-if="rewinding && bar" class="sticky bottom-2 z-30">
        <RewindBar
          :eyebrow="bar.eyebrow"
          :headline="bar.headline"
          :detail="bar.detail"
          :stats="bar.stats"
          :confirm-label="bar.confirm"
          :footnote="
            waiting
              ? $t('match.rewind.unlocks_when', {
                  names: waiting.names.join(', '),
                })
              : $t('match.rewind.pauses_after')
          "
          :waiting="waiting"
          :ready="!waiting"
          :busy="restoring"
          @cancel="cancel"
          @confirm="confirm"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.rounds-tab {
  container-type: inline-size;
}

@container (max-width: 40rem) {
  .legend-rules {
    display: none;
  }
}

@container (min-width: 54rem) {
  .snapshot-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.rewind-swatch {
  background-color: hsl(var(--background) / 0.55);
  background-image: repeating-linear-gradient(
    -45deg,
    hsl(var(--tac-amber) / 0.4) 0 2px,
    transparent 2px 6px
  );
  box-shadow: inset 0 0 0 1px hsl(var(--tac-amber) / 0.4);
}
</style>
