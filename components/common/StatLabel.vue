<script lang="ts" setup>
import { computed, inject, ref } from "vue";
import { Info } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { SORTABLE_HEADER_KEY } from "~/components/common/sortableHeader";

const props = withDefaults(
  defineProps<{
    stat: string;
    label?: string;
    side?: string;
    // Opt a column header into the touch info-icon treatment even when it
    // isn't a SortableTableHead (which provides this implicitly).
    header?: boolean;
  }>(),
  { side: "top" },
);

const { t, te } = useI18n();

const hasEntry = computed(() => te(`stat_glossary.${props.stat}.description`));
const title = computed(() =>
  hasEntry.value ? t(`stat_glossary.${props.stat}.label`) : (props.label ?? ""),
);
const description = computed(() =>
  hasEntry.value ? t(`stat_glossary.${props.stat}.description`) : "",
);
const text = computed(() => props.label ?? title.value ?? props.stat);

// Inside a sortable header on a touch device, the dotted-underline trigger
// would fill the cell and steal the tap meant for sorting. There we render the
// label as plain (sortable) text plus a dedicated info icon for the tooltip —
// big sort target, deliberate info tap. Desktop hover behaviour is untouched.
const inSortableHeader = inject(SORTABLE_HEADER_KEY, null);
const isTouch = ref(
  import.meta.client
    ? (window.matchMedia?.("(hover: none)").matches ?? false)
    : false,
);
const headerTouch = computed(
  () =>
    hasEntry.value &&
    isTouch.value &&
    (props.header || !!inSortableHeader?.value),
);
</script>

<template>
  <span v-if="headerTouch" class="inline-flex items-center gap-1">
    <FiveStackToolTip as-child :side="side" :delay-duration="120">
      <template #trigger>
        <button
          type="button"
          class="-m-1 inline-flex shrink-0 items-center justify-center p-2 text-muted-foreground/70 hover:text-foreground"
          :aria-label="title"
        >
          <Info class="h-3.5 w-3.5" />
        </button>
      </template>
      <div class="max-w-[220px] space-y-0.5">
        <div
          class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-foreground"
        >
          {{ title }}
        </div>
        <div class="text-xs leading-snug text-muted-foreground">
          {{ description }}
        </div>
      </div>
    </FiveStackToolTip>
    <slot>{{ text }}</slot>
  </span>

  <FiveStackToolTip
    v-else-if="hasEntry"
    as-child
    :side="side"
    :delay-duration="120"
  >
    <template #trigger>
      <span
        class="cursor-help underline decoration-dotted decoration-muted-foreground/70 underline-offset-[3px] transition-colors hover:decoration-foreground"
      >
        <slot>{{ text }}</slot>
      </span>
    </template>
    <div class="max-w-[220px] space-y-0.5">
      <div
        class="font-mono text-[0.62rem] font-bold uppercase tracking-[0.14em] text-foreground"
      >
        {{ title }}
      </div>
      <div class="text-xs leading-snug text-muted-foreground">
        {{ description }}
      </div>
    </div>
  </FiveStackToolTip>
  <span v-else><slot>{{ text }}</slot></span>
</template>
