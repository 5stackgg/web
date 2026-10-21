<script setup lang="ts">
import { computed } from "vue";
import { Pause, Play } from "lucide-vue-next";
import MatchAdminDock from "~/components/match/MatchAdminDock.vue";
import MatchDockLabel from "~/components/match/MatchDockLabel.vue";
import MatchFixProblemButton from "~/components/match/MatchFixProblemButton.vue";
import MatchVetoOverrideToggle from "~/components/match/MatchVetoOverrideToggle.vue";
import { dockPrimary } from "~/components/match/matchDockClasses";
import { e_match_map_status_enum, e_match_status_enum } from "~/generated/zeus";
import { faqHotClasses } from "~/utilities/faqClasses";
import type { FixProblemMenu } from "~/utilities/fixProblem";

// The match page's admin dock with the demo's controls in it. A FAQ figure
// shows it frozen: drawn, but nothing in it does anything.
const props = defineProps<{
  match: Record<string, any>;
  items: FixProblemMenu;
  hot?: "fix" | "pause";
  frozen?: boolean;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{ select: [string]; pause: [] }>();

const mapStatus = computed(
  () => props.match.match_maps?.find((map: any) => map.is_current_map)?.status,
);

// The dock's main action while a map is played, as on a real match.
const canPause = computed(
  () =>
    props.match.status === e_match_status_enum.Live &&
    [
      e_match_map_status_enum.Live,
      e_match_map_status_enum.Overtime,
      e_match_map_status_enum.Paused,
    ].includes(mapStatus.value),
);
const paused = computed(
  () => mapStatus.value === e_match_map_status_enum.Paused,
);

const fixOpen = computed({
  get: () => !props.frozen && open.value,
  set: (value: boolean) => {
    if (!props.frozen) {
      open.value = value;
    }
  },
});
</script>

<template>
  <MatchAdminDock :match="match" controllable :inert="frozen || undefined">
    <template #actions="{ compact }">
      <MatchVetoOverrideToggle
        v-if="match.status === e_match_status_enum.Veto"
        :match-id="match.id"
        :compact="compact"
      />
      <button
        v-if="canPause"
        type="button"
        :class="[dockPrimary, hot === 'pause' && faqHotClasses]"
        @click="emit('pause')"
      >
        <MatchDockLabel
          :label="
            paused ? $t('match.actions.resume') : $t('match.actions.pause')
          "
          :compact="compact"
        >
          <component :is="paused ? Play : Pause" class="h-3 w-3 shrink-0" />
        </MatchDockLabel>
      </button>
      <MatchFixProblemButton
        v-model:open="fixOpen"
        :menu="items"
        :compact="compact"
        :hot="hot === 'fix'"
        @select="emit('select', $event)"
      />
    </template>

    <template #console>
      <div
        class="flex h-full items-center justify-center p-6 text-sm text-muted-foreground"
      >
        {{ $t("faq.demo.not_in_demo") }}
      </div>
    </template>
  </MatchAdminDock>
</template>
