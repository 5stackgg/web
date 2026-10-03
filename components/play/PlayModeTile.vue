<script setup lang="ts">
import { computed } from "vue";
import { Check, Lock } from "lucide-vue-next";
import PlaySeats from "~/components/play/PlaySeats.vue";

// One mode in the picker. Typographic on purpose: the format and who it seats
// carry the tile, not artwork.
const props = defineProps<{
  title: string;
  description: string;
  expected: number;
  // null for guests: they have no queue socket, so there is no count.
  inQueue: number | null;
  // 0 for guests.
  party: number;
  canQueue: boolean;
  selected: boolean;
  // A party member sees the picker but the leader chooses.
  locked: boolean;
}>();

defineEmits<{ (e: "select"): void }>();

const perSide = computed(() => Math.max(1, Math.floor(props.expected / 2)));
const blocked = computed(() => props.party > 0 && !props.canQueue);
const checked = computed(() => props.selected && !blocked.value);
</script>

<template>
  <button
    type="button"
    role="radio"
    :aria-checked="checked"
    :aria-disabled="blocked || locked || undefined"
    :tabindex="checked ? 0 : -1"
    class="group/tile relative flex min-h-[212px] flex-col gap-1.5 rounded-lg border p-4 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] focus-visible:ring-offset-2 focus-visible:ring-offset-background max-xl:min-h-[196px] max-sm:min-h-0 max-sm:gap-1 max-sm:p-3"
    :class="[
      checked
        ? 'border-[hsl(var(--tac-amber))] bg-[linear-gradient(180deg,hsl(var(--tac-amber)/0.1),hsl(var(--tac-amber)/0.025))] shadow-[inset_0_0_0_1px_hsl(var(--tac-amber))]'
        : 'border-border bg-[linear-gradient(180deg,hsl(var(--muted)/0.34),hsl(var(--muted)/0.14))]',
      blocked
        ? 'cursor-not-allowed'
        : locked
          ? 'cursor-default'
          : !checked && 'hover:border-foreground/25',
    ]"
    @click="!blocked && !locked && $emit('select')"
  >
    <span class="mb-2.5 flex items-center gap-3.5 max-sm:mb-1.5 max-sm:gap-2.5">
      <span
        aria-hidden="true"
        class="text-[30px] font-bold leading-none tabular-nums tracking-[-0.01em] max-sm:text-[22px]"
        :class="blocked ? 'text-foreground/50' : 'text-foreground/90'"
        >{{ perSide
        }}<i
          class="mx-[0.14em] align-[0.3em] text-[0.5em] font-semibold not-italic text-muted-foreground"
          >v</i
        >{{ perSide }}</span
      >
      <PlaySeats :expected="expected" :party="party" />
    </span>

    <span
      class="flex items-center gap-2 text-[19px] font-bold leading-tight max-sm:text-base"
      :class="blocked && 'text-foreground/50'"
    >
      {{ title }}
      <span
        v-if="checked"
        class="inline-grid size-5 place-items-center rounded-full bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] max-sm:size-[18px]"
      >
        <Check class="size-3" :stroke-width="3" />
      </span>
    </span>

    <span
      v-if="inQueue !== null"
      class="text-[12.5px] max-sm:text-xs"
      :class="
        inQueue && !blocked ? 'text-foreground/80' : 'text-muted-foreground'
      "
    >
      <template v-if="inQueue">
        <b class="font-bold tabular-nums text-foreground">{{ inQueue }}</b>
        {{ $t("matchmaking.in_queue") }}
      </template>
      <template v-else>{{
        $t("pages.play.matchmaking.nobody_queued")
      }}</template>
    </span>

    <span
      class="text-[13px] [text-wrap:pretty] max-sm:hidden"
      :class="blocked ? 'text-muted-foreground' : 'text-foreground/65'"
    >
      {{ description }}
    </span>

    <!-- Only a problem earns a line: the seats already show the party, and
         "it fits" repeated on every tile is noise. -->
    <span
      v-if="blocked"
      class="mt-auto flex items-start gap-1.5 pt-2 text-[12.5px] font-semibold text-destructive max-sm:pt-1.5 max-sm:text-xs"
    >
      <Lock class="mt-0.5 size-[13px] shrink-0" />
      {{ $t("pages.play.matchmaking.too_big", { count: party, mode: title }) }}
    </span>
  </button>
</template>
