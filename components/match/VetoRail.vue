<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import VetoCrest from "~/components/match/VetoCrest.vue";
import type {
  VetoBoardItem,
  VetoBoardLineup,
  VetoBoardStep,
} from "~/utilities/vetoOrder";

// The order of play: every step of the veto, made or to come. A rail across
// the board, and on a phone a ledger with a row per lineup. The veto board
// sits it on top; the match header keeps it once the veto is over.
const props = withDefaults(
  defineProps<{
    kind: "map" | "region";
    items: VetoBoardItem[];
    steps: VetoBoardStep[];
    lineups: [VetoBoardLineup, VetoBoardLineup];
    // The lineup the viewer plays on; their moves sit a step brighter.
    viewer?: 1 | 2 | null;
    // The step in play is the viewer's to make.
    yourTurn?: boolean;
  }>(),
  {
    viewer: null,
    yourTurn: false,
  },
);

const emit = defineEmits<{
  echo: [itemId: string | null];
}>();

const { t } = useI18n();

const isRegion = computed(() => props.kind === "region");
const cursor = computed(() => props.steps.findIndex((step) => !step.record));

const label = (id: string | null | undefined) =>
  props.items.find((item) => item.id === id)?.label ?? "";
const lineupName = (lineup: 1 | 2 | null | undefined) =>
  lineup ? props.lineups[lineup - 1].name : "";
const sideShort = (side: string | null | undefined) =>
  side === "CT" ? "CT" : "T";
const sideIcon = (side: string | null | undefined) =>
  side === "CT" ? "/img/teams/ct_logo.svg" : "/img/teams/t_logo.svg";

const railSteps = computed(() =>
  props.steps.map((s, index) => {
    const state = s.record ? "done" : index === cursor.value ? "now" : "next";
    const you = state === "now" && props.yourTurn;
    const lineup = s.type === "Decider" ? null : (s.record?.lineup ?? s.lineup);
    const typeLabel =
      s.type === "Decider" && isRegion.value
        ? t("match.veto.steps.Region")
        : t(`match.veto.steps.${s.type}`);
    let what = you ? t(`match.veto.yours.${s.type}`) : typeLabel;
    let side: string | null = null;
    if (s.record) {
      if (s.type === "Side") {
        side = s.record.side ?? null;
        what = sideShort(side);
      } else {
        what = label(s.record.itemId);
      }
    }
    const detail = s.record
      ? s.type === "Side"
        ? `${sideShort(side)} · ${label(s.record.itemId)}`
        : label(s.record.itemId)
      : "";
    return {
      key: index,
      type: s.type,
      state,
      you,
      lineup,
      mine: !!lineup && lineup === props.viewer,
      typeLabel,
      tag: lineup && !you ? props.lineups[lineup - 1].monogram : "",
      what,
      side,
      itemId: s.record?.itemId ?? null,
      title: [
        `${index + 1}. ${typeLabel}`,
        lineupName(lineup),
        detail,
        s.record?.auto ? t("match.picks.auto_picked") : "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }),
);

// On a phone the order of play is a ledger: one row per lineup, its moves in
// order, and the decider under them.
const ledgerRows = computed(() =>
  ([1, 2] as const)
    .map((lineup) => ({
      lineup,
      mine: lineup === props.viewer,
      steps: railSteps.value.filter(
        (s) => s.type !== "Decider" && s.lineup === lineup,
      ),
    }))
    .filter((row) => row.steps.length),
);
const ledgerDecider = computed(
  () => railSteps.value.find((s) => s.type === "Decider") ?? null,
);
</script>

<template>
  <div class="vr" @pointerleave="emit('echo', null)">
    <ol class="vb-rail" :aria-label="t('match.veto.order')">
      <li
        v-for="s in railSteps"
        :key="s.key"
        class="vb-railstep"
        :data-type="s.type"
        :data-state="s.state"
        :class="{ 'is-you': s.you, 'is-mine': s.mine }"
        :title="s.title"
        @pointerenter="emit('echo', s.itemId)"
      >
        <img v-if="s.side" class="sd" :src="sideIcon(s.side)" alt="" />
        <span class="what"
          ><span class="lbl">{{ s.what }}</span></span
        >
        <span v-if="s.tag" class="who">{{ s.tag }}</span>
      </li>
    </ol>

    <div class="vb-ledger" :aria-label="t('match.veto.order')">
      <div
        v-for="row in ledgerRows"
        :key="row.lineup"
        class="vb-lrow"
        :style="{ '--n': row.steps.length }"
      >
        <span
          class="vb-lwho"
          :class="{ 'is-mine': row.mine }"
          :title="lineupName(row.lineup)"
        >
          <VetoCrest :lineup="lineups[row.lineup - 1]" :size="24" />
        </span>
        <span
          v-for="s in row.steps"
          :key="s.key"
          class="vb-tok"
          :data-type="s.type"
          :data-state="s.state"
          :class="{ 'is-you': s.you, 'is-mine': s.mine }"
          :title="s.title"
          @pointerenter="emit('echo', s.itemId)"
        >
          <span class="n">{{ s.key + 1 }}</span>
          <span
            class="lbl"
            :class="s.side ? (s.side === 'CT' ? 'is-ct' : 'is-t') : ''"
            >{{ s.what }}</span
          >
        </span>
      </div>
      <div v-if="ledgerDecider" class="vb-ldec">
        <span
          class="vb-tok"
          data-type="Decider"
          :data-state="ledgerDecider.state"
          :title="ledgerDecider.title"
          @pointerenter="emit('echo', ledgerDecider.itemId)"
        >
          <span class="n">{{ ledgerDecider.key + 1 }}</span>
          <span class="lbl">{{
            ledgerDecider.state === "done"
              ? `${ledgerDecider.typeLabel} · ${ledgerDecider.what}`
              : ledgerDecider.typeLabel
          }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vr {
  --vb-surface: hsl(var(--popover));
  --vb-surface-2: hsl(240 4% 13%);
  --vb-line-2: hsl(var(--muted-foreground) / 0.28);
  --vb-muted: hsl(var(--muted-foreground));
  --vb-faint: hsl(var(--muted-foreground) / 0.65);
  --vb-amber: hsl(var(--tac-amber));
  --vb-ban: hsl(var(--destructive));
  --vb-pick: hsl(var(--success));
  --vb-decider: hsl(48 96% 62%);
  --vb-ct: hsl(212 70% 70%);
  --vb-t: hsl(38 85% 62%);
  --vb-ease: cubic-bezier(0.16, 1, 0.3, 1);
  container-type: inline-size;
  min-width: 0;
}

.vb-rail {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 4px;
}
.vb-railstep {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
  height: 32px;
  padding: 0 9px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background: var(--vb-surface);
  color: var(--vb-faint);
  overflow: hidden;
  transition:
    color 240ms var(--vb-ease),
    background-color 240ms var(--vb-ease),
    box-shadow 240ms var(--vb-ease);
}
.vb-railstep .what {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vb-railstep .who {
  flex: none;
  font-size: 11px;
  opacity: 0.8;
}
.vb-railstep .sd {
  width: 14px;
  height: 14px;
  flex: none;
}
/* What a step was (ban, pick, side, decider) is a short line under its name,
   drawn in as the step lands. */
.vb-railstep .lbl,
.vb-tok .lbl {
  --mark: var(--vb-line-2);
  display: inline-block;
  max-width: 100%;
  padding-bottom: 3px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
  background: linear-gradient(var(--mark), var(--mark)) left bottom / 0 2px
    no-repeat;
  transition: background-size 240ms var(--vb-ease);
}
[data-type="Ban"] > .lbl,
[data-type="Ban"] > .what > .lbl {
  --mark: var(--vb-ban);
}
[data-type="Pick"] > .lbl,
[data-type="Pick"] > .what > .lbl {
  --mark: var(--vb-pick);
}
[data-type="Side"] > .lbl,
[data-type="Side"] > .what > .lbl {
  --mark: var(--vb-muted);
}
[data-type="Decider"] > .lbl,
[data-type="Decider"] > .what > .lbl {
  --mark: var(--vb-decider);
}
.vb-railstep[data-state="done"] .lbl,
.vb-tok[data-state="done"] .lbl {
  background-size: 100% 2px;
}
.vb-railstep[data-state="done"] {
  color: hsl(var(--foreground));
  background: var(--vb-surface-2);
}
.vb-railstep[data-state="done"][data-type="Ban"] .what {
  color: var(--vb-muted);
}
.vb-railstep[data-state="now"] {
  color: hsl(var(--foreground));
  box-shadow: inset 0 0 0 1px var(--vb-muted);
}
.vb-railstep[data-state="now"].is-you {
  box-shadow: inset 0 0 0 1px var(--vb-amber);
}
.vb-railstep[data-state="now"].is-you .what {
  color: var(--vb-amber);
  font-weight: 600;
}
/* Your moves sit a step brighter; your tag is amber. */
.vb-railstep.is-mine[data-state="done"] {
  background: hsl(240 4% 19%);
}
.vb-railstep.is-mine .who {
  color: var(--vb-amber);
  opacity: 1;
}

/* ---------- order of play on a phone: the ledger ---------- */
.vb-ledger {
  display: none;
  gap: 6px;
}
.vb-lrow {
  display: grid;
  grid-template-columns: 26px repeat(var(--n), minmax(0, 1fr));
  gap: 4px;
  align-items: center;
}
.vb-lwho {
  display: grid;
  place-items: center;
  border-radius: 7px;
}
.vb-lwho.is-mine {
  box-shadow: 0 0 0 2px var(--vb-amber);
}
.vb-ldec {
  padding-left: 30px;
}
.vb-tok {
  position: relative;
  height: 30px;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  color: hsl(var(--foreground));
  background: var(--vb-surface-2);
}
.vb-tok .n {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 8px;
  line-height: 1;
  color: var(--vb-faint);
}
.vb-tok[data-state="done"][data-type="Ban"] .lbl {
  color: var(--vb-muted);
}
.vb-tok .lbl.is-ct {
  color: var(--vb-ct);
  font-weight: 700;
}
.vb-tok .lbl.is-t {
  color: var(--vb-t);
  font-weight: 700;
}
.vb-tok.is-mine[data-state="done"] {
  background: hsl(240 4% 19%);
}
.vb-tok[data-state="next"] {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--vb-line-2);
  color: var(--vb-faint);
  font-weight: 500;
}
.vb-tok[data-state="now"] {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--vb-muted);
}
.vb-tok[data-state="now"].is-you {
  box-shadow: inset 0 0 0 1.5px var(--vb-amber);
  color: var(--vb-amber);
}

@container (max-width: 560px) {
  .vb-rail {
    display: none;
  }
  .vb-ledger {
    display: grid;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vr *,
  .vr *::before,
  .vr *::after {
    transition-duration: 1ms !important;
  }
}
</style>
