<script setup lang="ts">
/**
 * One submission in the review queue, judged from the tile: what it is, where
 * it lands, who sent it and why, and the two answers on its right edge.
 * Declining asks for the reason in place, and the reason is what the author
 * reads on their own list.
 */
import { computed, ref } from "vue";
import { Check, MessageSquareQuote, X } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import TimeAgo from "~/components/TimeAgo.vue";
import UtilityRadarThumb from "~/components/utility/UtilityRadarThumb.vue";
import { useMapCallouts } from "~/composables/useMapCallouts";
import { humanizeCallout } from "~/utilities/mapCallouts";
import { UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";
import type { UtilityLineup } from "~/types/utility";

const props = defineProps<{
  lineup: UtilityLineup;
}>();

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "review", id: string, approve: boolean, reason: string | null): void;
}>();

const REASONS = ["no_land", "duplicate", "bad_name", "needs_clip"] as const;

const asking = ref(false);

const color = computed(
  () => UTILITY_TYPE_COLORS[props.lineup.utility_type] ?? "#ffffff",
);

const landing = computed(() =>
  props.lineup.land_x == null || props.lineup.land_y == null
    ? null
    : {
        x: props.lineup.land_x,
        y: props.lineup.land_y,
        z: props.lineup.land_z ?? 0,
      },
);

const origin = computed(() => ({
  x: props.lineup.origin_x,
  y: props.lineup.origin_y,
  z: props.lineup.origin_z,
}));

const { calloutAt } = useMapCallouts(() => props.lineup.map_name);
const lands = computed(() => humanizeCallout(calloutAt(landing.value)));

const airTime = computed(() => {
  const ms = Number(props.lineup.flight_time_ms ?? 0);
  return ms > 0 ? (ms / 1000).toFixed(1) : null;
});

const failedShot = ref(false);
const shot = computed(() => {
  if (failedShot.value) {
    return null;
  }
  const still = props.lineup.preview_stills_url?.landing;
  return typeof still === "string" && still.length > 0
    ? still
    : (props.lineup.preview_thumbnail_url ?? null);
});

// The rail runs the tile's full height, so it spans the note row when there
// is one.
const twoRows = computed(() => asking.value || !!props.lineup.description);

function decline(reason: string) {
  asking.value = false;
  emit("review", props.lineup.id, false, reason);
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    data-review-tile
    class="grid cursor-pointer grid-cols-[4.75rem_minmax(0,1fr)_2.75rem] gap-x-3 gap-y-2 rounded-md border border-l-2 border-border bg-card/40 p-2.5 text-left transition-colors duration-150 hover:bg-card/60"
    :style="{ borderLeftColor: color }"
    @click="emit('select', lineup.id)"
    @keydown.enter="emit('select', lineup.id)"
  >
    <span class="relative block size-[4.75rem] overflow-hidden rounded-md">
      <img
        v-if="shot"
        :src="shot"
        alt=""
        loading="lazy"
        decoding="async"
        class="size-full object-cover"
        @error="failedShot = true"
      />
      <UtilityRadarThumb
        v-else
        :map-name="lineup.map_name"
        :origin="origin"
        :landing="landing"
        :color="color"
        :size="76"
      />
      <span
        class="absolute bottom-1 left-1 rounded-sm bg-black/85 px-1 font-mono text-[0.5rem] font-bold uppercase tracking-[0.1em]"
        :style="{ color }"
      >
        {{ $t(`pages.utility.types.${lineup.utility_type}`) }}
      </span>
    </span>

    <div class="flex min-w-0 flex-col gap-1">
      <span class="truncate text-sm font-semibold leading-tight">
        {{ lineup.name }}
      </span>
      <span
        class="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground"
      >
        <span v-if="lands">
          {{ $t("pages.utility.review.lands") }}
          <b class="font-semibold text-foreground/80">{{ lands }}</b>
        </span>
        <span v-if="airTime">
          {{ $t("pages.utility.card.stat_flight") }}
          <b class="font-semibold tabular-nums text-foreground/80">
            {{ $t("pages.utility.playbooks.duration", { seconds: airTime }) }}
          </b>
        </span>
      </span>
      <span class="flex min-w-0 items-center gap-1.5 text-xs">
        <PlayerDisplay
          v-if="lineup.author"
          data-submitter
          :player="lineup.author"
          size="xs"
          compact
          truncate-name
          :show-elo="false"
          :show-role="false"
          :show-online="false"
          :context-menu="false"
          class="min-w-0"
        />
        <span
          v-if="lineup.public_requested_at"
          class="flex shrink-0 items-center gap-1 text-muted-foreground"
        >
          <span aria-hidden="true">·</span>
          <TimeAgo :date="lineup.public_requested_at" hide-icon />
        </span>
      </span>
    </div>

    <div
      data-verdict
      class="grid grid-rows-2 gap-1.5 self-stretch"
      :class="twoRows ? 'row-span-2' : ''"
      @click.stop
    >
      <Button
        variant="tactical"
        data-approve
        class="h-full w-full px-0"
        :aria-label="$t('pages.utility.publish.approve')"
        :title="$t('pages.utility.publish.approve')"
        @click="emit('review', lineup.id, true, null)"
      >
        <Check />
      </Button>
      <Button
        variant="outline"
        data-decline
        class="h-full w-full px-0"
        :aria-pressed="asking"
        :aria-label="$t('pages.utility.publish.reject')"
        :title="$t('pages.utility.publish.reject')"
        @click="asking = !asking"
      >
        <X class="text-destructive" />
      </Button>
    </div>

    <div
      v-if="asking"
      data-reasons
      class="col-span-2 flex flex-wrap items-center gap-1.5"
      @click.stop
    >
      <span
        class="mr-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-destructive"
      >
        {{ $t("pages.utility.review.reject_because") }}
      </span>
      <Button
        v-for="reason of REASONS"
        :key="reason"
        variant="outline"
        size="xs"
        :data-reason="reason"
        @click="decline($t(`pages.utility.review.reasons.${reason}`))"
      >
        {{ $t(`pages.utility.review.reasons.${reason}`) }}
      </Button>
    </div>
    <p
      v-else-if="lineup.description"
      class="col-span-2 flex gap-1.5 text-xs text-muted-foreground"
    >
      <MessageSquareQuote class="mt-px h-3.5 w-3.5 shrink-0 opacity-60" />
      <span class="line-clamp-2">“{{ lineup.description }}”</span>
    </p>
  </div>
</template>
