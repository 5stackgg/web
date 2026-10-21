<script setup lang="ts">
import { computed } from "vue";
import { Hand, X } from "lucide-vue-next";
import VetoRewindTimeline from "~/components/match/veto/VetoRewindTimeline.vue";
import { Fold } from "~/components/ui/transitions";
import { e_sides_enum } from "~/generated/zeus";
import { DEMO_LINEUPS, DEMO_MAP_POOL } from "~/utilities/demoMatch";
import { type VetoStep } from "~/utilities/rewind";
import mapLabel from "~/utilities/mapLabel";

const props = defineProps<{
  steps: VetoStep[];
  done: number;
  current: VetoStep | null;
  clock: number;
}>();

const acting = defineModel<boolean>("acting", { default: false });

const emit = defineEmits<{
  choose: [string, e_sides_enum | undefined];
}>();

const team = (lineup: 1 | 2 | null) =>
  lineup ? DEMO_LINEUPS[lineup].name : "";

const taken = computed(() => {
  const byMap = new Map<string, VetoStep>();
  for (const step of props.steps.slice(0, props.done)) {
    if (step.type !== "Side") {
      byMap.set(step.map, step);
    }
  }
  return byMap;
});

const sideMap = computed(() =>
  props.current?.type === "Side" ? props.steps[props.done - 1]?.map : null,
);
</script>

<template>
  <div class="veto-board flex flex-col gap-4">
    <VetoRewindTimeline
      :best-of="3"
      :steps="steps"
      :done="done"
      :lineup1="DEMO_LINEUPS[1].name"
      :lineup2="DEMO_LINEUPS[2].name"
      :clock="clock"
    />

    <Fold :open="acting && !!current">
      <div
        class="flex flex-wrap items-center gap-3 rounded-md border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.08)] px-3 py-2 text-sm"
      >
        <Hand class="size-4 text-[hsl(var(--tac-amber))]" />
        <span>
          {{
            current?.type === "Side"
              ? $t("faq.demo.acting_side", {
                  team: team(current?.lineup ?? null),
                })
              : $t("faq.demo.acting_map", {
                  team: team(current?.lineup ?? null),
                })
          }}
        </span>
        <span class="flex-1" />
        <button
          type="button"
          class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          @click="acting = false"
        >
          <X class="size-3.5" />
          {{ $t("common.cancel") }}
        </button>
      </div>
    </Fold>

    <div
      v-if="current?.type === 'Side' && acting && sideMap"
      class="grid grid-cols-2 gap-3"
    >
      <button
        v-for="side in [e_sides_enum.CT, e_sides_enum.TERRORIST]"
        :key="side"
        type="button"
        class="rounded-lg border px-4 py-5 text-center font-bold transition-colors"
        :class="
          side === e_sides_enum.CT
            ? 'border-sky-400/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'
            : 'border-amber-400/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
        "
        @click="emit('choose', sideMap, side)"
      >
        {{ side === e_sides_enum.CT ? "CT" : "T" }}
        <span class="block text-xs font-normal text-muted-foreground">
          {{ mapLabel({ name: sideMap }) }}
        </span>
      </button>
    </div>

    <ul v-else class="map-pool grid grid-cols-2 gap-2.5">
      <li v-for="map in DEMO_MAP_POOL" :key="map">
        <button
          type="button"
          class="group relative block aspect-[4/3] w-full overflow-hidden rounded-lg border text-left transition-[border-color,opacity] duration-150 disabled:cursor-default"
          :class="[
            taken.get(map)?.type === 'Ban'
              ? 'border-destructive/30 opacity-45'
              : taken.get(map)
                ? 'border-success/50'
                : acting && current && current.type !== 'Side'
                  ? 'border-[hsl(var(--tac-amber)/0.6)] hover:border-[hsl(var(--tac-amber))]'
                  : 'border-border/60',
          ]"
          :disabled="
            !acting || !current || current.type === 'Side' || !!taken.get(map)
          "
          @click="emit('choose', map, undefined)"
        >
          <img
            :src="`/img/maps/screenshots/${map}.webp`"
            alt=""
            class="absolute inset-0 size-full object-cover"
            :class="taken.get(map)?.type === 'Ban' && 'grayscale'"
          />
          <span
            class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"
          />
          <span class="absolute inset-x-2 bottom-1.5 flex flex-col">
            <span class="text-sm font-bold">{{ mapLabel({ name: map }) }}</span>
            <span
              v-if="taken.get(map)"
              class="font-mono text-[0.55rem] font-bold uppercase tracking-[0.14em]"
              :class="
                taken.get(map)?.type === 'Ban'
                  ? 'text-destructive'
                  : 'text-success'
              "
            >
              {{
                taken.get(map)?.type === "Ban"
                  ? $t("faq.demo.banned_by", {
                      team: team(taken.get(map)?.lineup ?? null),
                    })
                  : taken.get(map)?.type === "Decider"
                    ? $t("match.veto_rewind.decider")
                    : $t("faq.demo.picked_by", {
                        team: team(taken.get(map)?.lineup ?? null),
                      })
              }}
            </span>
          </span>
        </button>
      </li>
    </ul>

    <p v-if="!current" class="text-sm text-muted-foreground">
      {{ $t("faq.demo.veto_complete") }}
    </p>
  </div>
</template>

<style scoped>
.veto-board {
  container-type: inline-size;
}

@container (min-width: 30rem) {
  .map-pool {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@container (min-width: 64rem) {
  .map-pool {
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
}
</style>
