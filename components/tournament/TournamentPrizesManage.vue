<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $ } from "~/generated/zeus";
import { toast } from "@/components/ui/toast";
import ManageSection from "~/components/common/ManageSection.vue";
import PrizeRowsEditor from "~/components/tournament/PrizeRowsEditor.vue";
import type { PrizeRowDraft } from "~/components/tournament/PrizeRowsEditor.vue";
import { effectivePlace, placeLabel } from "~/utilities/prizes";
import { formatPrizePool } from "~/utilities/prizePool";

const props = defineProps<{ tournament: Record<string, any> }>();

const { t } = useI18n();
const { client: apolloClient } = useApolloClient();

const isOrganizer = computed(() => !!props.tournament.is_organizer);

const drafts = ref<PrizeRowDraft[]>([]);
const busyIds = ref<Array<string | number>>([]);
const savedIds = ref<Array<string | number>>([]);
const adding = ref(false);

const pool = computed(() =>
  formatPrizePool(
    drafts.value.map((row) => {
      return { prize: row.prize };
    }),
  ),
);

function serverRows(): PrizeRowDraft[] {
  return (props.tournament.prizes || []).map((prize: any) => {
    return {
      id: prize.id,
      place: placeLabel(prize.place),
      prize: prize.prize,
    };
  });
}

// Last values seen from the server, per row — a draft that has drifted from its
// snapshot is being typed into right now and must survive the next frame.
const snapshots = new Map<string | number, { place: string; prize: string }>();
// A drag persists in the background; until the server catches up its frames
// still carry the old order, which would yank the row back under the cursor.
const reordering = ref(false);

watch(
  () => props.tournament.prizes,
  () => {
    const server = serverRows();
    const byId = new Map(drafts.value.map((draft) => [draft.id, draft]));

    const next = server.map((row) => {
      const draft = byId.get(row.id);
      if (!draft) {
        return row;
      }
      const snapshot = snapshots.get(row.id);
      const edited =
        snapshot &&
        (draft.place !== snapshot.place || draft.prize !== snapshot.prize);
      // Keep object identity so focused inputs don't lose their cursor.
      return edited ? draft : Object.assign(draft, row);
    });

    const settled =
      next.length === drafts.value.length &&
      next.every((row, index) => drafts.value[index]?.id === row.id);
    if (reordering.value && settled) {
      reordering.value = false;
    }
    if (reordering.value) {
      const local = new Map(
        drafts.value.map((draft, index) => [draft.id, index]),
      );
      next.sort(
        (a, b) =>
          (local.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (local.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
    }

    drafts.value = next;
    snapshots.clear();
    server.forEach((row) =>
      snapshots.set(row.id, { place: row.place, prize: row.prize }),
    );
  },
  { immediate: true, deep: true },
);

const savedTimers = new Map<string | number, ReturnType<typeof setTimeout>>();

function markSaved(id: string | number) {
  savedIds.value = [...new Set([...savedIds.value, id])];
  clearTimeout(savedTimers.get(id));
  savedTimers.set(
    id,
    setTimeout(() => {
      savedIds.value = savedIds.value.filter((entry) => entry !== id);
      savedTimers.delete(id);
    }, 1400),
  );
}

onBeforeUnmount(() => {
  savedTimers.forEach((timer) => clearTimeout(timer));
});

function setBusy(id: string | number, busy: boolean) {
  busyIds.value = busy
    ? [...new Set([...busyIds.value, id])]
    : busyIds.value.filter((entry) => entry !== id);
}

function onError(error: any) {
  toast({
    variant: "destructive",
    title: t("common.error"),
    description: error?.message,
  });
}

async function commitRow(row: PrizeRowDraft) {
  const index = drafts.value.indexOf(row);
  const place = effectivePlace(row.place, index);
  const prize = row.prize.trim();
  const existing = (props.tournament.prizes || []).find(
    (entry: any) => entry.id === row.id,
  );
  if (!prize || (existing?.place === place && existing?.prize === prize)) {
    return;
  }

  setBusy(row.id, true);
  try {
    await apolloClient.mutate({
      mutation: typedGql("mutation")({
        update_tournament_prizes_by_pk: [
          {
            pk_columns: { id: $("id", "uuid!") },
            _set: {
              place: $("place", "String!"),
              prize: $("prize", "String!"),
            },
          },
          { id: true },
        ],
      }),
      variables: { id: row.id, place, prize },
    });
    row.prize = prize;
    markSaved(row.id);
  } catch (error) {
    onError(error);
  } finally {
    setBusy(row.id, false);
  }
}

// Order is a plain sort index, and auto-numbered places follow it — so any move
// rewrites both for every row below the change.
async function persistOrder() {
  const updates = drafts.value.map((row, index) => {
    return {
      where: { id: { _eq: row.id } },
      _set: { order: index, place: effectivePlace(row.place, index) },
    };
  });
  if (updates.length === 0) {
    return;
  }
  try {
    await apolloClient.mutate({
      mutation: typedGql("mutation")({
        update_tournament_prizes_many: [
          { updates: $("updates", "[tournament_prizes_updates!]!") },
          { affected_rows: true },
        ],
      }),
      variables: { updates },
    });
  } catch (error) {
    onError(error);
  }
}

function onMove(from: number, to: number) {
  const next = [...drafts.value];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  drafts.value = next;
  reordering.value = true;
  void persistOrder();
}

async function onRemove(row: PrizeRowDraft) {
  setBusy(row.id, true);
  try {
    await apolloClient.mutate({
      mutation: typedGql("mutation")({
        delete_tournament_prizes_by_pk: [
          { id: $("id", "uuid!") },
          { id: true },
        ],
      }),
      variables: { id: row.id },
    });
    drafts.value = drafts.value.filter((entry) => entry.id !== row.id);
    await persistOrder();
  } catch (error) {
    onError(error);
  } finally {
    setBusy(row.id, false);
  }
}

async function onAdd(prize: string, place: string) {
  adding.value = true;
  try {
    const index = drafts.value.length;
    await apolloClient.mutate({
      mutation: typedGql("mutation")({
        insert_tournament_prizes_one: [
          {
            object: {
              tournament_id: $("tournament_id", "uuid!"),
              place: $("place", "String!"),
              prize: $("prize", "String!"),
              order: $("order", "Int!"),
            },
          },
          { id: true },
        ],
      }),
      variables: {
        tournament_id: props.tournament.id,
        place: effectivePlace(place, index),
        prize,
        order: index,
      },
    });
  } catch (error) {
    onError(error);
  } finally {
    adding.value = false;
  }
}
</script>

<template>
  <div class="mx-auto grid max-w-3xl gap-8">
    <ManageSection :hint="$t('tournament.prizes.manage_hint')">
      <template #action>
        <div v-if="pool" class="text-right">
          <div
            class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-muted-foreground/70"
          >
            {{ $t("tournament.stats.prize_pool") }}
          </div>
          <div
            class="font-sans text-lg font-bold leading-tight tabular-nums text-[hsl(var(--tac-amber))]"
          >
            {{ pool }}
          </div>
        </div>
      </template>

      <div
        v-if="!isOrganizer"
        class="rounded-sm border border-dashed border-border px-4 py-6 text-center font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground"
      >
        {{ $t("tournament.prizes.organizer_access_required") }}
      </div>

      <PrizeRowsEditor
        v-else
        :rows="drafts"
        :busy-ids="busyIds"
        :saved-ids="savedIds"
        :adding="adding"
        @move="onMove"
        @commit="commitRow"
        @remove="onRemove"
        @add="onAdd"
      />
    </ManageSection>
  </div>
</template>
