<script lang="ts">
import { Slider } from "@/components/ui/slider";
import { ELO_MAX, ELO_STEP } from "~/utilities/scrimElo";

export default {
  components: { Slider },
  props: {
    modelValue: {
      type: Array as () => number[],
      required: true,
    },
    label: {
      type: String,
      default: "",
    },
  },
  emits: ["update:modelValue"],
  data() {
    return {
      ELO_MAX,
      ELO_STEP,
      fieldLabel:
        "text-[0.7rem] font-medium uppercase tracking-[0.12em] text-muted-foreground",
    };
  },
  computed: {
    range: {
      get(): number[] {
        return this.modelValue;
      },
      set(value: number[]) {
        this.$emit("update:modelValue", value);
      },
    },
  },
};
</script>

<template>
  <div class="space-y-1.5">
    <div class="flex items-center justify-between">
      <span :class="fieldLabel">{{ label || $t("scrim.elo_range") }}</span>
      <span class="text-sm tabular-nums text-muted-foreground">
        {{ range[0] === 0 ? $t("common.any") : range[0] }} –
        {{ range[1] >= ELO_MAX ? $t("common.any") : range[1] }}
      </span>
    </div>
    <Slider v-model="range" :min="0" :max="ELO_MAX" :step="ELO_STEP" />
  </div>
</template>
