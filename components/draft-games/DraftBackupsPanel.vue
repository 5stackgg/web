<script setup lang="ts">
import { computed, ref } from "vue";
import DraftPlayerCard from "~/components/draft-games/DraftPlayerCard.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    players: Array<any>;
    accent?: "amber" | "blue" | "neutral";
    matchType?: string | null;
    hostSteamId?: string;
    droppable?: boolean;
    dragSteamId?: string | null;
    emptyLabel?: string;
  }>(),
  {
    accent: "neutral",
    matchType: null,
    hostSteamId: undefined,
    droppable: false,
    dragSteamId: null,
    emptyLabel: "",
  },
);

const emit = defineEmits<{
  (event: "dragstart", steamId: string): void;
  (event: "dragend"): void;
  (event: "drop", steamId: string): void;
}>();

const accentVar = computed(() => {
  if (props.accent === "amber") {
    return "var(--tac-amber)";
  }
  if (props.accent === "blue") {
    return "200 90% 62%";
  }
  return "var(--muted-foreground)";
});

const dragOver = ref(false);

const onDragOver = (event: DragEvent) => {
  if (!props.droppable || !props.dragSteamId) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  dragOver.value = true;
};

const onDrop = () => {
  const steamId = props.dragSteamId;
  dragOver.value = false;
  if (!props.droppable || !steamId) {
    return;
  }
  emit("drop", steamId);
};
</script>

<template>
  <div
    class="draft-backups-panel flex h-full flex-col rounded-xl border p-5 [backdrop-filter:blur(8px)]"
    :class="dragOver ? 'is-drop-target' : ''"
    :style="{ '--accent': accentVar }"
    @dragover="onDragOver"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <div class="mb-3 flex h-5 items-center gap-2">
      <span class="backups-tick shrink-0"></span>
      <h3
        class="truncate font-sans text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground"
        :title="title"
      >
        {{ title }}
        <span class="ml-1 text-foreground/70">({{ players.length }})</span>
      </h3>
    </div>

    <TransitionGroup
      name="pool"
      tag="div"
      class="flex flex-1 flex-col gap-2"
    >
      <DraftPlayerCard
        v-for="player in players"
        :key="player.steam_id"
        :member="player"
        :accent="accent"
        :match-type="matchType"
        :is-host="!!hostSteamId && player.steam_id === hostSteamId"
        :draggable="true"
        :dragging="dragSteamId === player.steam_id"
        @dragstart="(steamId) => emit('dragstart', steamId)"
        @dragend="emit('dragend')"
      >
        <template #action>
          <slot name="action" :player="player"></slot>
        </template>
      </DraftPlayerCard>
    </TransitionGroup>

    <div
      v-if="players.length === 0"
      class="empty-drop grid min-h-[3.5rem] flex-1 place-items-center rounded-lg border border-dashed text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground/40"
    >
      {{ emptyLabel || $t("draft_games.room.drop_to_bench") }}
    </div>
  </div>
</template>

<style scoped>
.draft-backups-panel {
  border-color: hsl(var(--accent) / 0.22);
  background: linear-gradient(
    180deg,
    hsl(var(--accent) / 0.05) 0%,
    hsl(var(--card) / 0.4) 40%
  );
}
.draft-backups-panel.is-drop-target {
  border-color: hsl(var(--accent) / 0.8);
  box-shadow: inset 0 0 0 1px hsl(var(--accent) / 0.5);
}
.backups-tick {
  height: 12px;
  width: 3px;
  border-radius: 2px;
  background: hsl(var(--accent) / 0.8);
}
.empty-drop {
  border-color: hsl(var(--accent) / 0.18);
}
.pool-move,
.pool-enter-active,
.pool-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.pool-enter-from,
.pool-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
