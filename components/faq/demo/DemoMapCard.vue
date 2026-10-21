<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight, History } from "lucide-vue-next";
import RoundHistoryBar from "~/components/match/RoundHistoryBar.vue";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { DEMO_LINEUPS, type DemoMapSlot } from "~/utilities/demoMatch";
import mapLabel from "~/utilities/mapLabel";

const props = defineProps<{ slot: DemoMapSlot; canRestore?: boolean }>();

const emit = defineEmits<{ restore: [] }>();

const statusLabels: Record<DemoMapSlot["status"], string> = {
  Scheduled: "match.admin_bar.steps.warmup",
  Live: "match.admin_bar.steps.live",
  Paused: "match.admin_bar.steps.paused",
  Finished: "match.admin_bar.steps.finished",
};

const fakeMatch = computed(() => ({
  max_players_per_lineup: 5,
  lineup_1: { name: DEMO_LINEUPS[1].name, lineup_players: [] },
  lineup_2: { name: DEMO_LINEUPS[2].name, lineup_players: [] },
}));
</script>

<template>
  <div
    class="overflow-hidden rounded-xl border border-border/50 transition-colors"
    :class="slot.current && 'ring-2 ring-red-500'"
  >
    <div class="relative aspect-[16/5]">
      <img
        :src="`/img/maps/screenshots/${slot.map}.webp`"
        alt=""
        class="size-full object-cover brightness-50"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20"
      />
      <div class="absolute left-0 right-0 top-0 z-10 px-2 pt-2">
        <span
          class="text-[11px] font-bold uppercase tracking-widest text-white/90 drop-shadow-lg"
        >
          {{ mapLabel({ name: slot.map }) }}
        </span>
      </div>
      <div class="absolute inset-0 flex items-center justify-center">
        <img
          :src="`/img/maps/icons/${slot.map}.svg`"
          alt=""
          class="h-auto max-h-[60%] w-1/4 max-w-[72px] object-contain opacity-80 drop-shadow-2xl"
        />
      </div>
      <div class="absolute right-2 top-2 z-10 flex items-center gap-1.5">
        <Tooltip v-if="canRestore">
          <TooltipTrigger as-child>
            <button
              type="button"
              class="inline-flex size-6 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              :aria-label="$t('match.recovery.restore.title')"
              @click="emit('restore')"
            >
              <History class="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{{
            $t("match.recovery.restore.title")
          }}</TooltipContent>
        </Tooltip>
        <Badge
          v-if="slot.status !== 'Scheduled'"
          :variant="slot.current ? 'destructive' : 'secondary'"
          class="px-2 py-0.5 text-xs backdrop-blur-sm"
        >
          {{ $t(statusLabels[slot.status]) }}
        </Badge>
        <Badge
          v-else-if="!slot.pickedBy"
          variant="destructive"
          class="px-2 py-0.5 text-xs backdrop-blur-sm"
        >
          {{ $t("match.decider") }}
        </Badge>
      </div>
    </div>

    <div class="bg-muted/40">
      <div class="flex items-center justify-between gap-1 px-3 pb-2 pt-2.5">
        <div
          class="flex min-h-[2.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5"
        >
          <span class="max-w-full truncate text-[10px] text-muted-foreground">
            {{ DEMO_LINEUPS[1].name }}
          </span>
        </div>
        <Tooltip v-if="slot.pickedBy === 1">
          <TooltipTrigger as-child>
            <ChevronLeft class="size-4 shrink-0 text-emerald-500" />
          </TooltipTrigger>
          <TooltipContent>
            {{ DEMO_LINEUPS[1].name }} {{ $t("match.map_veto.pick") }}
          </TooltipContent>
        </Tooltip>
        <div
          class="flex items-center gap-1.5 rounded-lg bg-background/60 px-2 py-1"
        >
          <span class="text-lg font-bold tabular-nums">
            {{ slot.score ? slot.score[0] : "-" }}
          </span>
          <span class="text-xs text-muted-foreground">:</span>
          <span class="text-lg font-bold tabular-nums">
            {{ slot.score ? slot.score[1] : "-" }}
          </span>
        </div>
        <Tooltip v-if="slot.pickedBy === 2">
          <TooltipTrigger as-child>
            <ChevronRight class="size-4 shrink-0 text-emerald-500" />
          </TooltipTrigger>
          <TooltipContent>
            {{ DEMO_LINEUPS[2].name }} {{ $t("match.map_veto.pick") }}
          </TooltipContent>
        </Tooltip>
        <div
          class="flex min-h-[2.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5"
        >
          <span class="max-w-full truncate text-[10px] text-muted-foreground">
            {{ DEMO_LINEUPS[2].name }}
          </span>
        </div>
      </div>
      <div
        v-if="slot.rounds?.length"
        class="border-t border-border/40 bg-background/30 px-5 pb-5 pt-4"
      >
        <RoundHistoryBar
          :match="fakeMatch"
          :match-map="{ rounds: slot.rounds }"
          compact
          seamless
        />
      </div>
    </div>
  </div>
</template>
