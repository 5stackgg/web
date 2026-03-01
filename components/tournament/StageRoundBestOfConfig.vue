<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { calculateRounds, type RoundInfo } from "~/utilities/tournamentRoundCalculator";
import { computed } from "vue";

const props = defineProps<{
  stageType: string;
  maxTeams: number;
  groups: number;
  defaultBestOf: string;
  modelValue: Record<string, string>;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: Record<string, string>];
}>();

const rounds = computed<RoundInfo[]>(() => {
  if (!props.stageType || !props.maxTeams) return [];
  return calculateRounds(props.stageType, props.maxTeams, props.groups);
});

const bestOfOptions = [
  { value: "1", display: "BO1" },
  { value: "3", display: "BO3" },
  { value: "5", display: "BO5" },
];

function getRoundValue(key: string): string {
  return props.modelValue?.[key] ?? props.defaultBestOf;
}

function updateRound(key: string, value: string) {
  const updated = { ...props.modelValue };
  if (value === props.defaultBestOf) {
    delete updated[key];
  } else {
    updated[key] = value;
  }
  emit("update:modelValue", updated);
}
</script>

<template>
  <div v-if="rounds.length > 0" class="space-y-3">
    <div class="text-sm font-medium text-muted-foreground">
      {{ $t("tournament.stage.per_round_best_of") }}
    </div>
    <div class="grid gap-2">
      <div
        v-for="round in rounds"
        :key="round.key"
        class="flex items-center justify-between gap-4"
      >
        <span class="text-sm min-w-[140px]">{{ $t(round.label.key, round.label.params) }}</span>
        <Select
          :model-value="getRoundValue(round.key)"
          @update:model-value="(val) => updateRound(round.key, val)"
        >
          <SelectTrigger class="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem
                v-for="option in bestOfOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.display }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
</template>
