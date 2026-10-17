<script setup lang="ts">
import { computed } from "vue";
import { RotateCcw } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import { useSeasonBackfill } from "~/composables/useSeasonBackfill";

// One rebuild runs at a time: hidden while this season rebuilds (its progress
// shows instead), disabled with a reason while another one does.
const props = withDefaults(
  defineProps<{
    seasonId: string;
    label: string;
    iconOnly?: boolean;
    variant?: "outline" | "ghost";
    size?: "sm" | "xs" | "icon-sm";
  }>(),
  { iconOnly: false, variant: "outline", size: "sm" },
);

defineEmits<{ (e: "rebuild"): void }>();

const backfill = useSeasonBackfill();
const self = computed(() => backfill.isRebuilding(props.seasonId));
const blocked = computed(() => backfill.running.value && !self.value);
</script>

<template>
  <FiveStackToolTip
    v-if="!self"
    as-child
    :disabled="!blocked && !iconOnly"
    :tap-toggle="blocked"
  >
    <template #trigger>
      <span class="inline-flex" :tabindex="blocked ? 0 : undefined">
        <Button
          type="button"
          :variant="variant"
          :size="size"
          :disabled="blocked"
          :aria-label="iconOnly ? label : undefined"
          @click="$emit('rebuild')"
        >
          <RotateCcw />
          <template v-if="!iconOnly">{{ label }}</template>
        </Button>
      </span>
    </template>
    {{ blocked ? $t("pages.seasons.hero.one_rebuild") : label }}
  </FiveStackToolTip>
</template>
