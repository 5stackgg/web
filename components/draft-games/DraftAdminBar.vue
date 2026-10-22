<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { XCircle } from "lucide-vue-next";
import MatchAdminDock from "~/components/match/MatchAdminDock.vue";
import MatchDockLabel from "~/components/match/MatchDockLabel.vue";
import { dockDanger } from "~/components/match/matchDockClasses";

// The admin dock while the room drafts, before there is a match for
// MatchAdminBottomBar to run; it hands over to that one once the match exists.
const props = defineProps<{
  room: Record<string, any>;
}>();

const emit = defineEmits<{
  (event: "cancel"): void;
}>();

// What the steps read before the match exists: whether it will run a veto.
const upcomingMatch = computed(() => ({
  options: {
    map_veto: !!props.room.options?.map_veto,
    region_veto: (props.room.regions || []).length !== 1,
  },
}));

// Same wait as MatchAdminBottomBar: the Teleport target can mount after us.
const dockReady = ref(false);
let dockRaf = 0;

onMounted(() => {
  const waitForDock = () => {
    if (document.getElementById("main-bottom-dock")) {
      dockReady.value = true;
    } else {
      dockRaf = requestAnimationFrame(waitForDock);
    }
  };
  waitForDock();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(dockRaf);
});
</script>

<template>
  <Teleport v-if="dockReady" to="#main-bottom-dock">
    <MatchAdminDock :match="upcomingMatch" draft drafting>
      <template #actions="{ compact }">
        <button type="button" :class="dockDanger" @click="emit('cancel')">
          <MatchDockLabel
            :label="$t('draft_games.room.cancel_draft')"
            :compact="compact"
          >
            <XCircle class="h-3 w-3 shrink-0" />
          </MatchDockLabel>
        </button>
      </template>
    </MatchAdminDock>
  </Teleport>
</template>
