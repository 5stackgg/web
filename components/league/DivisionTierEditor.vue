<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Plus, Trash2, GripVertical } from "lucide-vue-next";

export interface LeagueDivision {
  id: string;
  name: string;
  tier: number;
}

const props = defineProps<{
  divisions: LeagueDivision[];
}>();

const emit = defineEmits<{
  (e: "create", name: string, tier: number): void;
  (e: "delete", divisionId: string): void;
  (e: "reorder", orderedIds: string[]): void;
}>();

// Local, drag-reorderable copy so the list moves optimistically; the parent
// persists the new order and re-feeds the prop.
const items = ref<LeagueDivision[]>([...props.divisions]);
watch(
  () => props.divisions,
  (value) => {
    items.value = [...value];
  },
);

// ---- drag-and-drop ordering ----
const dragIndex = ref<number | null>(null);

function onDragStart(index: number) {
  dragIndex.value = index;
}

function onDrop(index: number) {
  const from = dragIndex.value;
  dragIndex.value = null;
  if (from === null || from === index) {
    return;
  }
  const next = [...items.value];
  const [moved] = next.splice(from, 1);
  next.splice(index, 0, moved);
  items.value = next;
  emit(
    "reorder",
    next.map((d) => d.id),
  );
}

// ---- create / delete ----
const newName = ref("");

function nextTier(): number {
  return items.value.reduce((max, d) => Math.max(max, d.tier), 0) + 1;
}

function create() {
  if (!newName.value.trim()) {
    return;
  }
  emit("create", newName.value.trim(), nextTier());
  newName.value = "";
}

const confirmDeleteId = ref<string | null>(null);
const confirmDeleteName = computed(
  () => items.value.find((d) => d.id === confirmDeleteId.value)?.name ?? "",
);

function confirmDelete() {
  if (confirmDeleteId.value) {
    emit("delete", confirmDeleteId.value);
  }
  confirmDeleteId.value = null;
}
</script>

<template>
  <div class="space-y-3">
    <ol class="space-y-2">
      <li
        v-for="(division, index) in items"
        :key="division.id"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragover.prevent
        @drop="onDrop(index)"
        class="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2"
        :class="{
          'border-[hsl(var(--tac-amber)/0.6)]': dragIndex === index,
        }"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <GripVertical
            class="h-4 w-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
          />
          <span
            class="flex h-7 w-7 items-center justify-center rounded-sm border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] font-mono text-xs font-bold text-[hsl(var(--tac-amber))]"
          >
            {{ index + 1 }}
          </span>
          <span class="truncate font-medium">{{ division.name }}</span>
        </div>
        <div class="flex shrink-0 items-center gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            class="h-7 w-7 text-muted-foreground hover:text-destructive"
            @click="confirmDeleteId = division.id"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </Button>
        </div>
      </li>
    </ol>

    <p v-if="!items.length" class="text-sm text-muted-foreground">
      {{ $t("league.divisions.empty") }}
    </p>

    <form class="flex items-center gap-2" @submit.prevent="create">
      <Input
        v-model="newName"
        :placeholder="$t('league.divisions.name_placeholder')"
        class="max-w-xs"
      />
      <Button type="submit" size="sm" variant="outline" class="gap-1">
        <Plus class="h-3.5 w-3.5" />
        {{ $t("league.divisions.add", { tier: items.length + 1 }) }}
      </Button>
    </form>
    <p class="text-xs text-muted-foreground">
      {{ $t("league.divisions.reorder_hint") }}
    </p>

    <AlertDialog
      :open="!!confirmDeleteId"
      @update:open="(open) => !open && (confirmDeleteId = null)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            $t("league.divisions.delete_title")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{
              $t("league.divisions.delete_description", {
                name: confirmDeleteName,
              })
            }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="confirmDeleteId = null">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmDelete"
          >
            {{ $t("common.delete") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
