<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import RewindBar from "~/components/match/rounds/RewindBar.vue";
import VetoRewindTimeline from "~/components/match/veto/VetoRewindTimeline.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { VetoStep } from "~/utilities/rewind";
import mapLabel from "~/utilities/mapLabel";

const props = defineProps<{
  steps: VetoStep[];
  done: number;
  lineup1: string;
  lineup2: string;
  initialStep: number;
  bestOf: number;
  busy?: boolean;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{ confirm: [number] }>();

const { t } = useI18n();

const target = ref<number | null>(null);

watch(
  () => [open.value, props.initialStep] as const,
  ([isOpen, step]) => {
    if (isOpen) {
      const clamped = Math.min(Math.max(step, 1), Math.max(props.done, 1));
      target.value =
        props.steps[clamped - 1]?.type === "Decider" ? clamped - 1 : clamped;
    }
  },
  { immediate: true },
);

const team = (lineup: 1 | 2 | null) =>
  lineup === 1 ? props.lineup1 : lineup === 2 ? props.lineup2 : "";

function again(step: VetoStep) {
  switch (step.type) {
    case "Ban":
      return t("match.veto_rewind.again_ban", { team: team(step.lineup) });
    case "Pick":
      return t("match.veto_rewind.again_pick", { team: team(step.lineup) });
    case "Side":
      return t("match.veto_rewind.again_side", { team: team(step.lineup) });
    default:
      return t("match.veto_rewind.again_decider");
  }
}

function cleared(step: VetoStep) {
  const values = {
    team: team(step.lineup),
    map: mapLabel({ name: step.map }),
  };
  switch (step.type) {
    case "Ban":
      return t("match.veto_rewind.cleared_ban", values);
    case "Pick":
      return t("match.veto_rewind.cleared_pick", values);
    case "Side":
      return t("match.veto_rewind.cleared_side", values);
    default:
      return t("match.veto_rewind.cleared_decider", values);
  }
}

const bar = computed(() => {
  const step = target.value ? props.steps[target.value - 1] : null;
  if (!step || !target.value) {
    return null;
  }
  return {
    eyebrow: t("match.veto_rewind.eyebrow", { step: target.value }),
    headline: t("match.veto_rewind.bar_headline", {
      step: target.value,
      again: again(step),
    }),
    detail: t("match.veto_rewind.bar_detail", {
      list: props.steps
        .slice(target.value - 1, props.done)
        .map(cleared)
        .join(", "),
    }),
  };
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-4xl gap-4">
      <DialogHeader class="text-left">
        <DialogTitle>{{ $t("match.veto_rewind.dialog_title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("match.veto_rewind.dialog_description") }}
        </DialogDescription>
      </DialogHeader>
      <VetoRewindTimeline
        :steps="steps"
        :done="done"
        :lineup1="lineup1"
        :lineup2="lineup2"
        :best-of="bestOf"
        rewinding
        can-rewind
        :target="target"
        @update:target="target = $event"
      />
      <RewindBar
        v-if="bar"
        :eyebrow="bar.eyebrow"
        :headline="bar.headline"
        :detail="bar.detail"
        :confirm-label="$t('match.veto_rewind.confirm')"
        :footnote="$t('match.veto_rewind.footnote')"
        :busy="busy"
        @cancel="open = false"
        @confirm="target && emit('confirm', target)"
      />
    </DialogContent>
  </Dialog>
</template>
