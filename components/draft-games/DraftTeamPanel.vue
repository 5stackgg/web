<script setup lang="ts">
import { computed, ref } from "vue";
import { X } from "lucide-vue-next";
import DraftPlayerCard from "~/components/draft-games/DraftPlayerCard.vue";
import DraftOpenSlot from "~/components/draft-games/DraftOpenSlot.vue";

const props = defineProps<{
  title: string;
  players: Array<any>;
  perTeam: number;
  accent: "amber" | "blue";
  active?: boolean;
  removable?: boolean;
  selfSteamId?: string;
  addable?: boolean;
  excludeSteamIds?: Array<string>;
  hostSteamId?: string;
  checkInBySteamId?: Record<string, boolean> | null;
  draggable?: boolean;
  droppable?: boolean;
  dragSteamId?: string | null;
}>();

const emit = defineEmits<{
  (event: "remove", steamId: string): void;
  (event: "add", steamId: string, player?: { steam_id: string }): void;
  (event: "dragstart", steamId: string): void;
  (event: "dragend"): void;
  (event: "drop", steamId: string): void;
}>();

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

const accentVar = computed(() =>
  props.accent === "amber" ? "var(--tac-amber)" : "200 90% 62%",
);

const avgElo = computed(() => {
  if (props.players.length === 0) {
    return 0;
  }
  const total = props.players.reduce(
    (sum, player) => sum + (player.elo_snapshot || 0),
    0,
  );
  return Math.round(total / props.players.length);
});

const captainSteamId = computed(() => {
  return [...props.players].sort(
    (a, b) => (a.pick_order ?? 99) - (b.pick_order ?? 99),
  )[0]?.steam_id;
});

const slots = computed(() => {
  return Array.from({ length: props.perTeam }, (_, index) => {
    return index < props.players.length;
  });
});
</script>

<template>
  <div
    class="draft-team-panel relative flex h-full flex-col rounded-xl border p-4 transition-all duration-300"
    :class="[active ? 'is-active' : '', dragOver ? 'is-drop-target' : '']"
    :style="{ '--accent': accentVar }"
    @dragover="onDragOver"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <!-- Fixed height so a team whose name wraps to two lines does not push its
         roster down and desync the two panels side by side. -->
    <div class="mb-3 flex h-9 items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <span class="team-tick shrink-0"></span>
        <h3
          class="truncate font-sans text-sm font-bold uppercase tracking-[0.18em]"
          :title="title"
        >
          {{ title }}
        </h3>
      </div>
      <div
        v-if="avgElo > 0"
        class="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("draft_games.room.avg") }}
        <span class="ml-1 font-bold text-foreground">{{ avgElo }}</span>
      </div>
    </div>

    <div class="mb-3 flex items-center gap-1.5">
      <span
        v-for="(filled, index) in slots"
        :key="index"
        class="slot-pip"
        :class="filled ? 'filled' : ''"
      ></span>
    </div>

    <TransitionGroup name="roster" tag="div" class="flex flex-1 flex-col gap-2">
      <DraftPlayerCard
        v-for="player in players"
        :key="player.steam_id"
        :member="player"
        :accent="accent"
        :is-captain="player.steam_id === captainSteamId"
        :is-host="!!hostSteamId && player.steam_id === hostSteamId"
        :show-pick-order="true"
        :checked-in="
          checkInBySteamId == null
            ? null
            : !!checkInBySteamId[player.steam_id]
        "
        :draggable="draggable"
        :dragging="dragSteamId === player.steam_id"
        @dragstart="(steamId) => emit('dragstart', steamId)"
        @dragend="emit('dragend')"
      >
        <!-- Fades out rather than vanishing when the lobby locks for check-in. -->
        <template #action>
          <Transition name="action">
            <button
              v-if="removable || player.steam_id === selfSteamId"
              class="remove-btn grid h-6 w-6 place-items-center rounded transition-colors"
              @click="emit('remove', player.steam_id)"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </Transition>
        </template>
      </DraftPlayerCard>
      <template v-if="addable">
        <DraftOpenSlot
          v-for="index in Math.max(0, perTeam - players.length)"
          :key="`add-${index}`"
          :exclude="excludeSteamIds || []"
          @selected="(steamId, player) => emit('add', steamId, player)"
        />
      </template>
      <template v-else>
        <div
          v-for="index in Math.max(0, perTeam - players.length)"
          :key="`empty-${index}`"
          class="empty-slot grid min-h-[3.5rem] place-items-center rounded-lg border border-dashed text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground/40"
        >
          {{ $t("draft_games.room.open_slot") }}
        </div>
      </template>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.draft-team-panel {
  border-color: hsl(var(--accent) / 0.25);
  background: linear-gradient(
    180deg,
    hsl(var(--accent) / 0.06) 0%,
    hsl(var(--card) / 0.4) 40%
  );
}
.draft-team-panel.is-drop-target {
  border-color: hsl(var(--accent) / 0.8);
  box-shadow: inset 0 0 0 1px hsl(var(--accent) / 0.5);
}
.draft-team-panel.is-active {
  border-color: hsl(var(--accent) / 0.7);
  box-shadow:
    0 0 0 1px hsl(var(--accent) / 0.4),
    0 0 30px hsl(var(--accent) / 0.18);
}
.team-tick {
  height: 14px;
  width: 4px;
  border-radius: 2px;
  background: hsl(var(--accent));
  box-shadow: 0 0 8px hsl(var(--accent) / 0.6);
}
.slot-pip {
  height: 6px;
  flex: 1;
  border-radius: 2px;
  background: hsl(var(--border));
  transition: background 0.3s ease;
}
.slot-pip.filled {
  background: hsl(var(--accent));
  box-shadow: 0 0 6px hsl(var(--accent) / 0.5);
}
.empty-slot {
  border-color: hsl(var(--accent) / 0.18);
}
.remove-btn {
  color: hsl(var(--muted-foreground));
}
.remove-btn:hover {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 0.12);
}
.action-enter-active,
.action-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.action-enter-from,
.action-leave-to {
  opacity: 0;
  transform: scale(0.7);
}
.roster-move,
.roster-enter-active,
.roster-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.roster-enter-from,
.roster-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
.roster-leave-active {
  position: absolute;
  width: 100%;
}
</style>
