<script setup lang="ts">
import { computed, ref } from "vue";
import { MapPin, X } from "lucide-vue-next";
import { UTILITY_TYPE_COLORS } from "~/utilities/utilityDisplay";
import type { UtilitySpot } from "~/utilities/utilitySpots";

const props = defineProps<{
  spots: UtilitySpot[];
}>();

const selectedKey = defineModel<string | null>({ required: true });

// Enough to cover the sites and the usual chokes on every map without the
// picker taking over the column; the long tail is one click away.
const COLLAPSED = 8;
const expanded = ref(false);

const selected = computed(
  () => props.spots.find((spot) => spot.key === selectedKey.value) ?? null,
);

// The chosen spot stays in the short list even when it is a small one, or
// picking from "more" would make the chip you just pressed disappear.
const visible = computed(() => {
  if (expanded.value || props.spots.length <= COLLAPSED) {
    return props.spots;
  }
  const head = props.spots.slice(0, COLLAPSED);
  if (selected.value && !head.includes(selected.value)) {
    head.push(selected.value);
  }
  return head;
});

const hidden = computed(() => props.spots.length - visible.value.length);

function pick(key: string) {
  selectedKey.value = selectedKey.value === key ? null : key;
}
</script>

<template>
  <section
    v-if="spots.length"
    class="flex flex-col gap-2"
    :aria-label="$t('pages.utility.spots.title')"
  >
    <div class="flex items-center gap-2">
      <MapPin class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span
        class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.utility.spots.title") }}
      </span>
      <button
        v-if="selected"
        type="button"
        class="ml-auto inline-flex h-6 items-center gap-1 rounded px-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        @click="selectedKey = null"
      >
        <X class="h-3 w-3" />
        {{ $t("pages.utility.spots.all") }}
      </button>
    </div>

    <div class="flex flex-wrap gap-1.5">
      <!-- Not FilterChip, for the same reason the type chips are not: the
           swatches carry the colours the board draws each grenade in, so a
           spot says what reaches it before you open it. -->
      <button
        v-for="spot of visible"
        :key="spot.key"
        type="button"
        :aria-pressed="selectedKey === spot.key"
        class="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-2.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--tac-amber)/0.6)]"
        :class="
          selectedKey === spot.key
            ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-foreground'
            : 'border-border/70 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground'
        "
        @click="pick(spot.key)"
      >
        <span class="font-medium">{{ spot.label }}</span>
        <span aria-hidden="true" class="flex gap-0.5">
          <span
            v-for="type of spot.types"
            :key="type"
            class="h-1.5 w-1.5 rounded-[1px]"
            :style="{ backgroundColor: UTILITY_TYPE_COLORS[type] }"
          />
        </span>
        <span class="font-mono text-[0.65rem] tabular-nums opacity-70">
          {{ spot.ids.length }}
        </span>
      </button>

      <button
        v-if="hidden > 0 || expanded"
        type="button"
        class="inline-flex h-8 shrink-0 items-center rounded-md px-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{
          expanded
            ? $t("pages.utility.spots.fewer")
            : $t("pages.utility.spots.more", { count: hidden })
        }}
      </button>
    </div>
  </section>
</template>
