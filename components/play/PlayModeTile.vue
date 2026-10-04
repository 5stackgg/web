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
  // The tile Tab lands on: the checked one, or the first pickable one.
  tabStop?: boolean;
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
    :tabindex="tabStop ? 0 : -1"
    class="group/tile relative isolate flex min-h-[212px] flex-col gap-1.5 rounded-lg border border-border bg-[linear-gradient(180deg,hsl(var(--muted)/0.34),hsl(var(--muted)/0.14))] p-4 text-left transition-[border-color,transform] [transition-duration:110ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--tac-amber))] focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none max-xl:min-h-[196px] max-sm:min-h-0 max-sm:gap-1 max-sm:p-3"
    :class="[
      blocked
        ? 'cursor-not-allowed'
        : locked
          ? 'cursor-default'
          : [
              'active:scale-[0.985] motion-reduce:active:scale-100',
              !checked && 'hover:border-foreground/25',
            ],
    ]"
    @click="!blocked && !locked && $emit('select')"
  >
    <!-- The selected wash fades in under the content; the amber frame itself
         is one element in the grid that glides between tiles. -->
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-[linear-gradient(180deg,hsl(var(--tac-amber)/0.1),hsl(var(--tac-amber)/0.025))] transition-opacity [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      :class="checked ? 'opacity-100' : 'opacity-0'"
    ></span>
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
      <Transition
        enter-active-class="transition-[transform,opacity] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        enter-from-class="scale-50 opacity-0"
        leave-active-class="transition-[transform,opacity] [transition-duration:110ms] [transition-timing-function:ease-in] motion-reduce:transition-none"
        leave-to-class="scale-75 opacity-0"
      >
        <span
          v-if="checked"
          class="inline-grid size-5 place-items-center rounded-full bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] max-sm:size-[18px]"
        >
          <Check class="size-3" :stroke-width="3" />
        </span>
      </Transition>
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
