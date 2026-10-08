<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Globe, Lock, Users } from "lucide-vue-next";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import Fold from "~/components/ui/transitions/Fold.vue";
import UtilityExecuteViewer3D from "~/components/utility/UtilityExecuteViewer3D.vue";
import UtilityThrowStrip from "~/components/utility/UtilityThrowStrip.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { useUtilityCardViews } from "~/composables/useUtilityCardViews";
import {
  UTILITY_CARRY_LIMITS,
  UTILITY_CARRY_TOTAL,
  utilityThrowButtonsKey,
} from "~/utilities/utilityDisplay";
import type {
  UtilityLineup,
  UtilityPlaybook,
  UtilityPlaybookStep,
  UtilityType,
} from "~/types/utility";

/** One step of an execute, resolved to everything a reader is shown. */
export type UtilityExecuteBeat = {
  key: string;
  /** 0-based: one less than the number the step wears. */
  index: number;
  step: UtilityPlaybookStep;
  /** Null when the step points at a lineup this viewer cannot see. */
  lineup: UtilityLineup | null;
  seconds: number;
  color: string;
  /** Only the first beat at a given second prints it. */
  showTime: boolean;
  /** The step, 1-based, this lineup was first thrown at. */
  repeatOf: number | null;
  /** Who throws it, by name. */
  who: string | null;
  mine: boolean;
};

/**
 * An execute, read rather than edited: when each throw goes, who throws it and
 * how. The timeline comes first because that is the question you open one
 * with; Mine cuts it down to your own steps with the throw at full size.
 */
const props = withDefaults(
  defineProps<{
    playbook: UtilityPlaybook;
    beats: UtilityExecuteBeat[];
    /** Whose it is, and the team it belongs to, by name. */
    owner?: string | null;
    team?: string | null;
    /** Seconds on the clock while it is being played back. */
    clock?: number | null;
    /** The `performance.now()` that run started at, for the scene. */
    startedAt?: number | null;
    // Play has been pressed on a map with a mesh, so the execute is thrown in
    // 3D. Off until then: a three.js scene per execute you open to read is
    // waste. Once on it stays, showing the run it last played.
    scene?: boolean;
    hoveredLineupId?: string | null;
    // Steps arrive before the lineups they point at; until those land, a
    // missing one is not yet a lineup you cannot see.
    lineupsLoading?: boolean;
  }>(),
  {
    owner: null,
    team: null,
    clock: null,
    startedAt: null,
    scene: false,
    hoveredLineupId: null,
    lineupsLoading: false,
  },
);

const emit = defineEmits<{
  (e: "step", index: number): void;
  (e: "hover", id: string | null): void;
  // The scene's camera has arrived: a run started now is one you can see.
  (e: "framed"): void;
  // Put the map back where the scene was.
  (e: "close-scene"): void;
}>();

const mine = defineModel<boolean>("mine", { default: false });

const { t, locale } = useI18n();

const STATUS_TONES = {
  Public: "bg-success/15 text-success",
  Team: "bg-[hsl(214_80%_62%/0.15)] text-[hsl(214_80%_68%)]",
  Private: "bg-muted/60 text-muted-foreground",
} as const;

const STATUS_ICONS = {
  Public: Globe,
  Team: Users,
  Private: Lock,
} as const;

const duration = computed(() =>
  Math.max(0, ...props.beats.map((beat) => beat.seconds)),
);

const players = computed(() => {
  const names = new Set<string>();
  for (const beat of props.beats) {
    if (beat.who) {
      names.add(beat.who);
    }
  }
  return [...names];
});

const mineBeats = computed(() =>
  props.beats.filter((beat) => beat.mine && beat.lineup),
);

// Only worth a switch when a step is yours.
const showMine = computed(() => mine.value && mineBeats.value.length > 0);

const whoseOptions = computed(() => [
  { key: "everyone", label: t("pages.utility.playbooks.everyone") },
  {
    key: "mine",
    label: t("pages.utility.playbooks.mine"),
    count: mineBeats.value.length,
  },
]);

const whoseModel = computed<string>({
  get: () => (showMine.value ? "mine" : "everyone"),
  set: (value) => (mine.value = value === "mine"),
});

const others = computed(() => {
  const names = new Set<string>();
  for (const beat of props.beats) {
    if (!beat.mine && beat.who) {
      names.add(beat.who);
    }
  }
  return [...names];
});

function listNames(names: string[]) {
  try {
    return new Intl.ListFormat(locale.value, {
      style: "long",
      type: "conjunction",
    }).format(names);
  } catch {
    return names.join(", ");
  }
}

const restLine = computed(() => {
  const count = props.beats.length - mineBeats.value.length;
  if (count <= 0) {
    return "";
  }
  return others.value.length
    ? t(
        "pages.utility.playbooks.more_steps_by",
        { count, players: listNames(others.value) },
        count,
      )
    : t("pages.utility.playbooks.more_steps", { count }, count);
});

/**
 * What is wrong with the execute as written: a step nobody here can read, and
 * a player handed more than a player carries. One list, so it reads as a
 * checklist rather than as a stack of alarms.
 */
const notices = computed(() => {
  const out: Array<{ key: string; text: string }> = [];

  if (!props.lineupsLoading) {
    for (const beat of props.beats) {
      if (!beat.lineup) {
        out.push({
          key: `unreadable-${beat.key}`,
          text: t("pages.utility.playbooks.step_unreadable", {
            step: beat.index + 1,
          }),
        });
      }
    }
  }

  type Tally = { name: string; total: number; byType: Map<UtilityType, number> };
  const tallies = new Map<string, Tally>();
  for (const beat of props.beats) {
    const steamId = beat.step.assigned_steam_id;
    if (!steamId || !beat.lineup) {
      continue;
    }
    const tally = tallies.get(String(steamId)) ?? {
      name: beat.who ?? String(steamId),
      total: 0,
      byType: new Map(),
    };
    const type = beat.lineup.utility_type;
    tally.total += 1;
    tally.byType.set(type, (tally.byType.get(type) ?? 0) + 1);
    tallies.set(String(steamId), tally);
  }

  for (const [steamId, tally] of tallies) {
    for (const [type, count] of tally.byType) {
      const limit = UTILITY_CARRY_LIMITS[type] ?? 1;
      if (count > limit) {
        out.push({
          key: `${steamId}-${type}`,
          text: t("pages.utility.playbooks.carry_over_type", {
            player: tally.name,
            count,
            type: t(`pages.utility.types.${type}`),
            limit,
          }),
        });
      }
    }
    if (tally.total > UTILITY_CARRY_TOTAL) {
      out.push({
        key: `${steamId}-total`,
        text: t("pages.utility.playbooks.carry_over_total", {
          player: tally.name,
          count: tally.total,
          limit: UTILITY_CARRY_TOTAL,
        }),
      });
    }
  }

  return out;
});

function waiting(beat: UtilityExecuteBeat) {
  return props.clock !== null && beat.seconds > props.clock;
}

function lit(beat: UtilityExecuteBeat) {
  return props.clock !== null && beat.seconds <= props.clock;
}

// What is said when it is thrown, and whether it is a second helping of a
// lineup the execute already spent: throwing the same smoke twice is a
// re-smoke, and the row owes you which step you first threw it at.
function call(beat: UtilityExecuteBeat) {
  const parts: string[] = [];
  if (beat.repeatOf) {
    parts.push(
      t("pages.utility.playbooks.again_from", { step: beat.repeatOf }),
    );
  }
  if (beat.step.note) {
    parts.push(`\u201c${beat.step.note}\u201d`);
  }
  return parts.join(" ");
}

function throwShort(lineup: UtilityLineup) {
  return t(
    `pages.utility.throw_buttons.${utilityThrowButtonsKey(lineup.throw_strength)}_short`,
  );
}

// The map's square, when the page has one beside the card.
const layers = useUtilityCardViews();
const { isMobile } = useSidebar();
const staged = computed(() => !!layers?.stage.value && !isMobile.value);

watch(
  () => staged.value && props.scene,
  (on) => {
    if (layers) {
      layers.staged.value = on;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (layers) {
    layers.staged.value = false;
  }
});
</script>

<template>
  <!-- Play throws the execute on the map's own square, the biggest thing on
       the page, in the map's place; the card keeps the timeline beside it.
       A phone has no square beside the card, so there it opens under the row
       it was pressed in. -->
  <Teleport v-if="staged && layers?.stage.value" :to="layers.stage.value">
    <Transition
      enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
      leave-active-class="transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
      enter-from-class="scale-[0.98] opacity-0"
      leave-to-class="scale-[0.98] opacity-0"
    >
      <div v-if="scene" class="pointer-events-auto absolute inset-0">
        <UtilityExecuteViewer3D
          :map-name="playbook.map_name"
          :beats="beats"
          :clock="clock"
          :started-at="startedAt"
          fill
          @framed="emit('framed')"
        />
        <button
          type="button"
          class="absolute left-3 top-3 z-[11] inline-flex h-8 items-center rounded-md border border-border/60 bg-black/60 px-3 text-xs font-semibold text-foreground backdrop-blur transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          @click="emit('close-scene')"
        >
          {{ $t("pages.utility.playbooks.show_map") }}
        </button>
      </div>
    </Transition>
  </Teleport>

  <!-- The gap under the scene rides inside the fold (the negative margin
       cancels the column's own), so it opens with the scene instead of
       snapping in. -->
  <div v-else class="-mb-3.5">
    <Fold :open="scene">
      <div class="pb-3.5">
        <UtilityExecuteViewer3D
          :map-name="playbook.map_name"
          :beats="beats"
          :clock="clock"
          :started-at="startedAt"
          @framed="emit('framed')"
        />
      </div>
    </Fold>
  </div>

  <div class="flex items-start gap-2">
    <h2
      class="min-w-0 flex-1 text-lg font-bold leading-tight [text-wrap:balance]"
    >
      {{ playbook.name }}
    </h2>
    <!-- Who can see it is worth a glyph, not a word's width. -->
    <FiveStackToolTip as-child :delay-duration="120">
      <template #trigger>
        <span
          class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md"
          :class="STATUS_TONES[playbook.visibility] ?? STATUS_TONES.Private"
          role="img"
          :aria-label="$t(`pages.utility.visibility.${playbook.visibility}`)"
        >
          <component
            :is="STATUS_ICONS[playbook.visibility] ?? STATUS_ICONS.Private"
            class="h-3.5 w-3.5"
          />
        </span>
      </template>
      {{ $t(`pages.utility.visibility.${playbook.visibility}`) }}
    </FiveStackToolTip>
  </div>

  <p
    v-if="playbook.description"
    class="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground"
  >
    {{ playbook.description }}
  </p>

  <div class="grid grid-cols-3 gap-2">
    <div class="min-w-0">
      <span class="block text-[1.375rem] font-bold leading-none tabular-nums">
        {{ beats.length }}
      </span>
      <span
        class="mt-1.5 block truncate font-mono text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70"
      >
        {{ $t("pages.utility.playbooks.step_word", beats.length) }}
      </span>
    </div>
    <div class="min-w-0">
      <span class="block text-[1.375rem] font-bold leading-none tabular-nums">
        {{
          $t("pages.utility.playbooks.duration", {
            seconds: duration.toFixed(1),
          })
        }}
      </span>
      <span
        class="mt-1.5 block truncate font-mono text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70"
      >
        {{ $t("pages.utility.playbooks.start_to_finish") }}
      </span>
    </div>
    <div class="min-w-0">
      <span class="block text-[1.375rem] font-bold leading-none tabular-nums">
        {{ players.length || $t("common.any") }}
      </span>
      <span
        class="mt-1.5 block truncate font-mono text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70"
      >
        {{ $t("pages.utility.playbooks.player_word", players.length || 2) }}
      </span>
    </div>
  </div>

  <div v-if="mineBeats.length" class="flex">
    <AnimatedFilters v-model="whoseModel" :options="whoseOptions" square />
  </div>

  <ul
    v-if="notices.length"
    class="flex flex-col gap-1 rounded-md border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] px-2.5 py-2 text-xs leading-snug text-[hsl(var(--tac-amber))]"
  >
    <li v-for="notice of notices" :key="notice.key" class="flex gap-2">
      <span
        aria-hidden="true"
        class="mt-[0.4rem] size-1 shrink-0 rounded-full bg-current"
      />
      <span class="min-w-0">{{ notice.text }}</span>
    </li>
  </ul>

  <!-- Your steps, with how each is thrown at the size you read it at between
       rounds. Everybody else's are one line under them. -->
  <template v-if="showMine">
    <div
      v-for="beat of mineBeats"
      :key="beat.key"
      class="flex flex-col gap-2"
    >
      <button
        type="button"
        class="-mx-1 flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors duration-200 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        :class="hoveredLineupId === beat.lineup?.id ? 'bg-white/[0.04]' : ''"
        @click="emit('step', beat.index)"
        @mouseenter="emit('hover', beat.lineup?.id ?? null)"
        @mouseleave="emit('hover', null)"
      >
        <span
          aria-hidden="true"
          class="grid h-[1.375rem] min-w-[1.375rem] shrink-0 place-items-center rounded-full px-1 text-[0.69rem] font-bold leading-none tabular-nums text-[#05070b]"
          :style="{ backgroundColor: beat.color }"
        >
          {{ beat.index + 1 }}
        </span>
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">
          {{ beat.lineup?.name }}
        </span>
        <span
          class="shrink-0 font-mono text-[0.69rem] font-semibold tabular-nums text-muted-foreground"
        >
          {{
            $t("pages.utility.playbooks.duration", {
              seconds: beat.seconds.toFixed(1),
            })
          }}
        </span>
      </button>
      <UtilityThrowStrip
        :technique="beat.lineup?.technique"
        :strength="beat.lineup?.throw_strength"
      />
      <p v-if="beat.step.note" class="text-xs italic text-muted-foreground">
        “{{ beat.step.note }}”
      </p>
    </div>
    <p v-if="restLine" class="text-xs leading-relaxed text-muted-foreground">
      {{ restLine }}
    </p>
  </template>

  <!-- Time runs down the gutter, because an execute is a clock. A second that
       repeats prints once, so four throws on one call read as one moment. -->
  <ol v-else class="flex flex-col">
    <li v-for="beat of beats" :key="beat.key">
      <component
        :is="beat.lineup ? 'button' : 'div'"
        :type="beat.lineup ? 'button' : undefined"
        class="grid w-full grid-cols-[2.375rem_1.375rem_minmax(0,1fr)] items-start gap-2 rounded-md px-1 py-[7px] text-left transition-[opacity,background-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 motion-reduce:transition-none"
        :class="[
          beat.lineup ? 'hover:bg-white/[0.04]' : '',
          waiting(beat) ? 'opacity-40' : '',
          lit(beat) || (beat.lineup && hoveredLineupId === beat.lineup.id)
            ? 'bg-white/[0.04]'
            : '',
        ]"
        @click="beat.lineup ? emit('step', beat.index) : undefined"
        @mouseenter="beat.lineup ? emit('hover', beat.lineup.id) : undefined"
        @mouseleave="beat.lineup ? emit('hover', null) : undefined"
      >
        <span
          class="pt-[5px] text-right font-mono text-[0.69rem] font-semibold leading-none tabular-nums"
          :class="beat.showTime ? 'text-muted-foreground' : 'text-transparent'"
          :aria-hidden="!beat.showTime"
        >
          {{
            $t("pages.utility.playbooks.duration", {
              seconds: beat.seconds.toFixed(1),
            })
          }}
        </span>
        <span
          aria-hidden="true"
          class="grid size-[1.375rem] place-items-center rounded-full text-[0.69rem] font-bold leading-none tabular-nums"
          :class="beat.lineup ? 'text-[#05070b]' : 'text-muted-foreground'"
          :style="{ backgroundColor: beat.lineup ? beat.color : '#3f3f46' }"
        >
          {{ beat.index + 1 }}
        </span>

        <span v-if="beat.lineup" class="flex min-w-0 flex-col gap-[3px]">
          <span class="truncate text-[0.84rem] font-semibold leading-tight">
            {{ beat.lineup.name }}
          </span>
          <span class="flex min-w-0 items-center gap-1.5">
            <span
              class="truncate font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.1em] text-muted-foreground"
            >
              {{ $t(`pages.utility.techniques.${beat.lineup.technique}`) }}
              <span aria-hidden="true" class="mx-1 text-border">/</span>
              {{ throwShort(beat.lineup) }}
            </span>
            <span
              v-if="beat.who"
              class="inline-flex h-4 max-w-[45%] shrink-0 items-center rounded-full border px-1.5 font-mono text-[0.56rem] font-semibold uppercase leading-none tracking-[0.08em]"
              :class="
                beat.mine
                  ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                  : 'border-border text-muted-foreground'
              "
            >
              <span class="truncate">{{ beat.who }}</span>
            </span>
          </span>
          <span
            v-if="call(beat)"
            class="truncate text-xs italic text-muted-foreground"
          >
            {{ call(beat) }}
          </span>
        </span>

        <span v-else class="flex min-w-0 flex-col gap-[3px]">
          <span
            class="truncate text-[0.84rem] font-semibold leading-tight text-muted-foreground"
          >
            {{
              lineupsLoading
                ? $t("pages.utility.playbooks.step_loading")
                : $t("pages.utility.playbooks.step_hidden")
            }}
          </span>
          <span
            v-if="!lineupsLoading"
            class="truncate text-xs italic text-muted-foreground"
          >
            {{ $t("pages.utility.playbooks.step_hidden_note") }}
          </span>
        </span>
      </component>
    </li>
  </ol>

  <!-- Whose it is and when it last changed are what you read last, if at
       all, so they sit at the foot of the panel. -->
  <div
    class="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/[0.06] pt-3 text-xs text-muted-foreground"
  >
    <span v-if="owner" class="min-w-0 truncate">{{ owner }}</span>
    <span v-if="owner && team" aria-hidden="true">·</span>
    <span v-if="team" class="min-w-0 truncate">{{ team }}</span>
    <span class="flex-1" />
    <span
      v-if="playbook.updated_at"
      class="inline-flex shrink-0 items-center gap-1"
    >
      {{ $t("pages.utility.playbooks.updated") }}
      <TimeAgo :date="playbook.updated_at" hide-icon />
    </span>
  </div>
</template>
