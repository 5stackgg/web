<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import ServiceLogSheet from "~/components/game-server-nodes/ServiceLogSheet.vue";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

// A game update's log. The api keeps each update job for a week, so this is
// the last week's update or nothing.
const game = defineModel<"cs2" | "csgo" | null>("game", { required: true });

const props = defineProps<{
  node: { id: string; label?: string | null } & Record<string, any>;
}>();

const { t } = useI18n();

const open = computed({
  get: () => game.value !== null,
  set: (value) => {
    if (!value) {
      game.value = null;
    }
  },
});

const running = computed(
  () =>
    !!(game.value === "csgo"
      ? props.node.csgo_update_status
      : props.node.update_status),
);
</script>

<template>
  <ServiceLogSheet
    v-model:open="open"
    :title="
      game === 'csgo'
        ? t(`${INSPECTOR}.log.title_csgo`)
        : t(`${INSPECTOR}.log.title_cs2`)
    "
    :node="node"
    :service="`${game === 'csgo' ? 'csgo' : 'cs'}-update:${node.id}`"
    :running="running"
    :note="t(`${INSPECTOR}.log.kept`)"
  />
</template>
