<script setup lang="ts">
import { ref } from "vue";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-vue-next";
import { autoPlace, normalizePrize } from "~/utilities/prizes";

export interface PrizeRowDraft {
  id: string | number;
  // Empty means "auto" — the row takes its number from its position.
  place: string;
  prize: string;
}

const props = withDefaults(
  defineProps<{
    rows: PrizeRowDraft[];
    busyIds?: Array<string | number>;
    savedIds?: Array<string | number>;
    adding?: boolean;
  }>(),
  { busyIds: () => [], savedIds: () => [], adding: false },
);

const emit = defineEmits<{
  (e: "move", from: number, to: number): void;
  (e: "remove", row: PrizeRowDraft): void;
  (e: "commit", row: PrizeRowDraft): void;
  (e: "add", prize: string, place: string): void;
}>();

// Medal tints mirror the public podium (gold / silver / bronze) so the editor
// reads as the same ranking the viewer sees.
const MEDALS = [
  "border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]",
  "border-[hsl(220_9%_72%_/_0.45)] bg-[hsl(220_9%_72%_/_0.1)] text-[hsl(220_9%_72%)]",
  "border-[hsl(28_45%_52%_/_0.5)] bg-[hsl(28_45%_52%_/_0.12)] text-[hsl(28_45%_52%)]",
];
const MEDAL_FALLBACK = "border-border bg-muted/30 text-muted-foreground";

function medal(index: number) {
  return MEDALS[index] ?? MEDAL_FALLBACK;
}

const dragIndex = ref<number | null>(null);
const overIndex = ref<number | null>(null);

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    // Firefox refuses to start a drag without payload.
    event.dataTransfer.setData("text/plain", String(index));
  }
}

function onDragEnter(index: number) {
  if (dragIndex.value !== null) {
    overIndex.value = index;
  }
}

function onDrop(index: number) {
  const from = dragIndex.value;
  dragIndex.value = null;
  overIndex.value = null;
  if (from === null || from === index) {
    return;
  }
  emit("move", from, index);
}

function onDragEnd() {
  dragIndex.value = null;
  overIndex.value = null;
}

function move(index: number, delta: number) {
  const to = index + delta;
  if (to < 0 || to >= props.rows.length) {
    return;
  }
  emit("move", index, to);
}

function commit(row: PrizeRowDraft) {
  row.prize = normalizePrize(row.prize);
  row.place = row.place.trim();
  emit("commit", row);
}

const isBusy = (id: string | number) => props.busyIds.includes(id);
const isSaved = (id: string | number) => props.savedIds.includes(id);

// ---- add row ----
const newPrize = ref("");
const newPlace = ref("");

function submitNew() {
  const prize = normalizePrize(newPrize.value);
  if (!prize) {
    return;
  }
  emit("add", prize, newPlace.value.trim());
  newPrize.value = "";
  newPlace.value = "";
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <ol class="flex flex-col gap-2">
      <li
        v-for="(row, index) in rows"
        :key="row.id"
        draggable="true"
        @dragstart="onDragStart(index, $event)"
        @dragenter="onDragEnter(index)"
        @dragover.prevent
        @drop.prevent="onDrop(index)"
        @dragend="onDragEnd"
        :class="[
          'flex flex-wrap items-center gap-2 rounded-sm border border-border/60 bg-background/40 p-2 transition-[opacity,border-color,box-shadow]',
          dragIndex === index ? 'opacity-40' : '',
          overIndex === index && dragIndex !== index
            ? 'border-[hsl(var(--tac-amber)/0.7)] shadow-[0_0_0_1px_hsl(var(--tac-amber)/0.35)]'
            : '',
        ]"
      >
        <GripVertical
          class="hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing sm:block"
        />
        <div class="flex shrink-0 flex-col sm:hidden">
          <button
            type="button"
            class="flex h-4 w-5 items-center justify-center text-muted-foreground/70 disabled:opacity-25"
            :disabled="index === 0"
            :aria-label="$t('tournament.prizes.move_up')"
            @click="move(index, -1)"
          >
            <ChevronUp class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            class="flex h-4 w-5 items-center justify-center text-muted-foreground/70 disabled:opacity-25"
            :disabled="index === rows.length - 1"
            :aria-label="$t('tournament.prizes.move_down')"
            @click="move(index, 1)"
          >
            <ChevronDown class="h-3.5 w-3.5" />
          </button>
        </div>

        <span
          :class="[
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border font-mono text-xs font-bold tabular-nums',
            medal(index),
          ]"
        >
          {{ index + 1 }}
        </span>

        <Input
          v-model="row.prize"
          :placeholder="$t('tournament.prizes.prize_placeholder')"
          maxlength="120"
          class="h-8 min-w-[7rem] flex-1 text-xs"
          @blur="commit(row)"
          @keyup.enter="commit(row)"
        />

        <Input
          v-model="row.place"
          :placeholder="autoPlace(index)"
          maxlength="40"
          class="h-8 w-20 font-mono text-xs sm:w-28"
          @blur="commit(row)"
          @keyup.enter="commit(row)"
        />

        <span class="flex w-4 shrink-0 justify-center">
          <Loader2
            v-if="isBusy(row.id)"
            class="h-3.5 w-3.5 animate-spin text-muted-foreground"
          />
          <Check
            v-else-if="isSaved(row.id)"
            class="h-3.5 w-3.5 text-[hsl(var(--tac-amber))]"
          />
        </span>

        <Button
          size="icon"
          variant="ghost"
          class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          :disabled="isBusy(row.id)"
          :aria-label="$t('common.delete')"
          @click="emit('remove', row)"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </li>
    </ol>

    <div
      class="flex flex-wrap items-center gap-2 rounded-sm border border-dashed border-border/60 bg-background/20 p-2"
    >
      <span class="hidden h-4 w-4 shrink-0 sm:block"></span>
      <span class="w-5 shrink-0 sm:hidden"></span>
      <span
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-dashed border-border font-mono text-xs font-bold tabular-nums text-muted-foreground/70"
      >
        {{ rows.length + 1 }}
      </span>
      <Input
        v-model="newPrize"
        :placeholder="$t('tournament.prizes.prize_placeholder')"
        maxlength="120"
        class="h-8 min-w-[7rem] flex-1 text-xs"
        @keyup.enter="submitNew"
      />
      <Input
        v-model="newPlace"
        :placeholder="autoPlace(rows.length)"
        maxlength="40"
        class="h-8 w-20 font-mono text-xs sm:w-28"
        @keyup.enter="submitNew"
      />
      <span class="w-4 shrink-0"></span>
      <Button
        size="icon"
        type="button"
        variant="outline"
        class="h-8 w-8 shrink-0 border-[hsl(var(--tac-amber)/0.4)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.12)] hover:text-[hsl(var(--tac-amber))]"
        :loading="adding"
        :disabled="adding || !newPrize.trim()"
        :aria-label="$t('tournament.prizes.add')"
        :title="$t('tournament.prizes.add')"
        @click="submitNew"
      >
        <Plus class="h-4 w-4" />
      </Button>
    </div>

    <p
      class="px-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground/60"
    >
      {{ $t("tournament.prizes.reorder_hint") }}
    </p>
  </div>
</template>
