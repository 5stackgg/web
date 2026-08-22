<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Lock, MapPin, Pencil, Plus, Rocket, Users } from "lucide-vue-next";
import HeightSwap from "~/components/ui/transitions/HeightSwap.vue";
import { Button } from "~/components/ui/button";
import UtilityEmpty from "~/components/utility/UtilityEmpty.vue";
import UtilitySkeletonList from "~/components/utility/UtilitySkeletonList.vue";
import UtilityPlaybookEditor from "~/components/utility/UtilityPlaybookEditor.vue";
import StartPracticeDialog from "~/components/utility/StartPracticeDialog.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { useDeferredLoading } from "~/composables/useDeferredLoading";
import {
  utilityLineupsQuery,
  utilityPlaybookStepsQuery,
  utilityPlaybooksQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import {
  UTILITY_TYPE_COLORS,
  formatUtilityOffset,
  utilityOrigin,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBoardMarker,
  UtilityPanelBoard,
} from "~/utilities/utilityDisplay";
import type {
  UtilityLineup,
  UtilityPlaybook,
  UtilityPlaybookStep,
} from "~/types/utility";

const emit = defineEmits<{
  (e: "board", state: UtilityPanelBoard | null): void;
  // The page puts an add button under whichever panel is showing; while this
  // one is empty it makes the offer itself, and two of the same button one
  // above the other is the page arguing with the panel.
  (e: "empty", value: boolean): void;
}>();

const props = withDefaults(
  defineProps<{
    mapName: string;
    // The page offers "New Playbook" as the tab's own action, so the panel
    // must not offer a second one beside it.
    hideCreate?: boolean;
  }>(),
  { hideCreate: false },
);

const playbooks = ref<UtilityPlaybook[]>([]);
const steps = ref<UtilityPlaybookStep[]>([]);
const lineupsById = ref<Record<string, UtilityLineup>>({});
const loading = ref(true);

// Saving or deleting an execute reloads the list. That is a refetch over
// something you are still looking at, so it dims rather than emptying out. A
// change of map is not: none of those executes belong to the map you are now
// on, so that one goes back to shapes.
const { skeleton, refreshing, reset } = useDeferredLoading(() => loading.value);

const editingId = ref<string | null>(null);
const creating = ref(false);
const practiceOpen = ref(false);
const practicePlaybookId = ref<string | null>(null);

const editing = computed(() => {
  if (creating.value) {
    return null;
  }
  return playbooks.value.find((entry) => entry.id === editingId.value) ?? null;
});

const editorOpen = computed(() => creating.value || !!editing.value);

const stepsByPlaybook = computed(() => {
  const grouped: Record<string, UtilityPlaybookStep[]> = {};
  for (const step of steps.value) {
    (grouped[step.playbook_id] ??= []).push(step);
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => a.step_order - b.step_order);
  }
  return grouped;
});

const editingSteps = computed(() =>
  editing.value ? (stepsByPlaybook.value[editing.value.id] ?? []) : [],
);

async function load() {
  loading.value = true;
  try {
    const client = getGraphqlClient();
    const { data } = await client.query({
      query: utilityPlaybooksQuery,
      variables: {
        where: {
          map_name: { _eq: props.mapName },
          can_view: { _eq: true },
        },
        order_by: [{ updated_at: order_by.desc }],
        limit: 100,
      },
      fetchPolicy: "network-only",
    });
    playbooks.value = ((data as any)?.utility_playbooks ?? []) as UtilityPlaybook[];

    const ids = playbooks.value.map((entry) => entry.id);
    if (!ids.length) {
      steps.value = [];
      return;
    }

    // Every listed playbook's steps in one round trip, then the lineups they
    // point at in a second — a per-playbook fetch would be N+1 for a page that
    // only wants to draw a strip of colours.
    const stepResult = await client.query({
      query: utilityPlaybookStepsQuery,
      variables: {
        where: { playbook_id: { _in: ids } },
        order_by: [{ step_order: order_by.asc }],
      },
      fetchPolicy: "network-only",
    });
    steps.value = ((stepResult.data as any)?.utility_playbook_steps ??
      []) as UtilityPlaybookStep[];

    const lineupIds = [
      ...new Set(steps.value.map((step) => step.utility_lineup_id)),
    ];
    if (!lineupIds.length) {
      return;
    }
    const lineupResult = await client.query({
      query: utilityLineupsQuery,
      variables: {
        where: { id: { _in: lineupIds }, can_view: { _eq: true } },
        order_by: [{ created_at: order_by.desc }],
        limit: lineupIds.length,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    const next: Record<string, UtilityLineup> = {};
    for (const lineup of ((lineupResult.data as any)?.utility_lineups ??
      []) as UtilityLineup[]) {
      next[lineup.id] = lineup;
    }
    lineupsById.value = next;
  } catch (error) {
    console.error("[utility] playbook load error:", error);
    playbooks.value = [];
    steps.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => props.mapName, () => {
  playbooks.value = [];
  steps.value = [];
  lineupsById.value = {};
  closeEditor();
  reset();
});

watch(() => props.mapName, load, { immediate: true });

/**
 * An execute has a shape -- four smokes on one call is not the same thing as a
 * staggered eight-second push -- and the shape is what tells two of them apart
 * in a list. Each step becomes a tick placed at its real offset along the
 * execute's own span and coloured by what it throws, so the strip reads as a
 * fingerprint rather than a row of identical chips.
 */
const cards = computed(() =>
  playbooks.value.map((playbook) => {
    const own = stepsByPlaybook.value[playbook.id] ?? [];
    const span = Math.max(...own.map((step) => step.offset_ms ?? 0), 0);
    const types = new Set<string>();
    for (const step of own) {
      const lineup = lineupsById.value[step.utility_lineup_id];
      if (lineup) {
        types.add(lineup.utility_type);
      }
    }
    return {
      playbook,
      steps: own,
      duration: formatUtilityOffset(span),
      typeCount: types.size,
      beats: own.map((step, index) => {
        const lineup = lineupsById.value[step.utility_lineup_id];
        return {
          key: `${step.id}-${index}`,
          color: lineup
            ? (UTILITY_TYPE_COLORS[lineup.utility_type] ?? "#ffffff")
            : "#8a8a8a",
          offset: formatUtilityOffset(step.offset_ms),
          // A single-beat execute has no span to place anything along, so it
          // sits at the start rather than dividing by zero into the middle.
          left: span > 0 ? ((step.offset_ms ?? 0) / span) * 100 : 0,
        };
      }),
      lineups: own
        .map((step) => lineupsById.value[step.utility_lineup_id])
        .filter((lineup): lineup is UtilityLineup => !!lineup),
      markers: own.reduce<UtilityBoardMarker[]>((out, step, index) => {
        const lineup = lineupsById.value[step.utility_lineup_id];
        if (lineup) {
          out.push({
            key: `${step.id}-${index}`,
            point: utilityOrigin(lineup),
            color: UTILITY_TYPE_COLORS[lineup.utility_type] ?? "#ffffff",
            label: String(index + 1),
            shape: "badge",
          });
        }
        return out;
      }, []),
    };
  }),
);

// The page already owns a map. Rather than draw a second one per card, the
// row that is under the cursor is the one the map is showing.
//
// Deliberately no `onUnmounted` hand-back: the panel now leaves through a
// crossfade, so its unmount lands AFTER the next tab's panel has published its
// own board -- clearing on the way out would wipe it.
const previewId = ref<string | null>(null);
const editorBoard = ref<UtilityPanelBoard | null>(null);

const preview = computed(
  () => cards.value.find((card) => card.playbook.id === previewId.value) ?? null,
);

watch(
  [editorOpen, editorBoard, preview],
  () => {
    if (editorOpen.value) {
      emit("board", editorBoard.value);
      return;
    }
    emit("board", {
      lineups: preview.value?.lineups ?? [],
      markers: preview.value?.markers ?? [],
      showAllLines: true,
    });
  },
  { immediate: true },
);


function startCreate() {
  editingId.value = null;
  creating.value = true;
}

function startEdit(id: string) {
  creating.value = false;
  editingId.value = id;
}

// Only while it is genuinely bare: mid-fetch the panel does not know yet, and
// flashing the page's button away and back is worse than leaving it alone.
watch(
  () => (loading.value ? null : !cards.value.length && !editorOpen.value),
  (value) => {
    if (value !== null) {
      emit("empty", value);
    }
  },
  { immediate: true },
);

defineExpose({ startCreate });

function closeEditor() {
  creating.value = false;
  editingId.value = null;
  editorBoard.value = null;
}

async function onSaved() {
  closeEditor();
  await load();
}

async function onDeleted() {
  closeEditor();
  await load();
}

function practice(id: string) {
  practicePlaybookId.value = id;
  practiceOpen.value = true;
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="!hideCreate" class="flex justify-end">
      <Button v-if="!editorOpen" class="tac-amber-cta" @click="startCreate()">
        <Plus class="mr-1 h-4 w-4" />
        {{ $t("pages.utility.playbooks.new") }}
      </Button>
    </div>

    <!-- One dissolve for every state this column can be in, and it measures.
         The old markup ran each branch through the page-ENTRY animation -- a
         520ms slide up from 20px -- so opening an execute looked like
         navigating to a new page. Then it ran them through an opacity-only
         swap, which fixed the slide but let the column collapse to nothing
         between the two halves: the add button under it jumped up 400px and
         back down every time this panel changed its mind. HeightSwap fades the
         leaver out where it stands and eases the shell to the entering side's
         measured height, so nothing below it moves twice. -->
    <HeightSwap class="mt-2">
      <div v-if="editorOpen" key="editor">
        <UtilityPlaybookEditor
          :key="editing?.id ?? 'new'"
          :map-name="mapName"
          :playbook="editing"
          :steps="editingSteps"
          @board="(state) => (editorBoard = state)"
          @saved="onSaved"
          @deleted="onDeleted"
          @cancel="closeEditor"
        />
      </div>

      <UtilitySkeletonList
        v-else-if="skeleton"
        key="loading"
        :count="3"
        shape="block"
      />

      <UtilityEmpty
        v-else-if="!cards.length"
        key="empty"
        :title="$t('pages.utility.playbooks.empty')"
        :description="$t('pages.utility.playbooks.empty_description')"
      >
        <Button
          size="sm"
          variant="outline"
          class="border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.08)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.14)]"
          @click="startCreate()"
        >
          <Plus class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.playbooks.new") }}
        </Button>
      </UtilityEmpty>

      <div
        v-else
        key="list"
        class="flex flex-col transition-opacity [transition-duration:180ms]"
        :class="refreshing ? 'pointer-events-none opacity-50' : ''"
      >
        <p
          class="flex items-center gap-1.5 pb-1.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          <MapPin class="h-3 w-3 shrink-0" />
          {{ $t("pages.utility.playbooks.hover_hint") }}
        </p>

        <!-- One execute per row. A 320px card grid inside a 400px rail was
             always one column of cards pretending to be a grid. -->
        <TransitionGroup name="pbrow" tag="div" class="flex flex-col">
          <div
            v-for="(card, index) of cards"
            :key="card.playbook.id"
            class="pbrow group border-t border-border/50 transition-colors last:border-b"
            :class="
              previewId === card.playbook.id
                ? 'bg-[hsl(var(--tac-amber))]/[0.05] shadow-[inset_2px_0_0_hsl(var(--tac-amber))]'
                : ''
            "
            :style="{ '--pbrow-delay': `${Math.min(index, 6) * 35}ms` }"
            @mouseenter="previewId = card.playbook.id"
            @mouseleave="previewId = null"
          >
            <div class="min-h-0 overflow-hidden">
              <div class="py-2.5">
                <button
                  type="button"
                  class="flex w-full items-start gap-2 px-1.5 text-left"
                  @click="startEdit(card.playbook.id)"
                >
                  <span class="min-w-0 flex-1">
                    <span class="truncate text-sm font-semibold leading-tight">
                      {{ card.playbook.name }}
                    </span>
                    <span
                      class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[0.57rem] uppercase tracking-[0.13em] text-muted-foreground"
                    >
                      <span class="text-foreground/80">
                        {{ $t(`pages.utility.sides.${card.playbook.side}`) }}
                      </span>
                      <span class="text-muted-foreground/40">·</span>
                      <span>
                        {{
                          $t("pages.utility.playbooks.steps_short", {
                            count: card.steps.length,
                          })
                        }}
                      </span>
                      <template v-if="Number(card.duration) > 0">
                        <span class="text-muted-foreground/40">·</span>
                        <span class="tabular-nums">
                          {{
                            $t("pages.utility.playbooks.duration", {
                              seconds: card.duration,
                            })
                          }}
                        </span>
                      </template>
                      <span class="text-muted-foreground/40">·</span>
                      <span class="inline-flex items-center gap-1">
                        <component
                          :is="
                            card.playbook.visibility === 'Team'
                              ? Users
                              : card.playbook.visibility === 'Private'
                                ? Lock
                                : MapPin
                          "
                          class="h-2.5 w-2.5"
                        />
                        {{
                          $t(
                            `pages.utility.visibility.${card.playbook.visibility}`,
                          )
                        }}
                      </span>
                    </span>
                  </span>
                </button>

                <!-- The execute's own clock, drawn to scale: where the ticks
                     bunch is where the calls bunch. -->
                <div
                  v-if="card.beats.length"
                  class="relative mx-1.5 mt-2 h-4"
                  :title="card.beats.map((beat) => `${beat.offset}s`).join(' · ')"
                >
                  <span
                    aria-hidden="true"
                    class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/12"
                  />
                  <!-- End caps, so the strip reads as an axis with a start and
                       a finish rather than three bars floating in a row. -->
                  <span
                    v-for="cap of ['left-0', 'right-0']"
                    :key="cap"
                    aria-hidden="true"
                    :class="cap"
                    class="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-white/20"
                  />
                  <span
                    v-for="beat of card.beats"
                    :key="beat.key"
                    aria-hidden="true"
                    class="absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-200 group-hover:scale-y-125"
                    :style="{
                      left: `calc(${beat.left}% * 0.97 + 1.5%)`,
                      backgroundColor: beat.color,
                    }"
                  />
                </div>

                <p
                  v-if="card.playbook.description"
                  class="mt-1.5 line-clamp-2 px-1.5 text-[0.7rem] leading-snug text-muted-foreground"
                >
                  {{ card.playbook.description }}
                </p>

                <div class="mt-2 flex items-center gap-1.5 px-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    class="h-7 px-2 text-xs"
                    @click="startEdit(card.playbook.id)"
                  >
                    <Pencil
                      v-if="card.playbook.can_edit"
                      class="mr-1 h-3.5 w-3.5"
                    />
                    {{
                      card.playbook.can_edit
                        ? $t("common.edit")
                        : $t("common.view")
                    }}
                  </Button>
                  <Button
                    size="sm"
                    class="tac-amber-cta ml-auto h-7 px-2 text-xs"
                    @click="practice(card.playbook.id)"
                  >
                    <Rocket class="mr-1 h-3.5 w-3.5" />
                    {{ $t("pages.utility.practice.start") }}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </HeightSwap>

    <StartPracticeDialog
      v-model:open="practiceOpen"
      :map-name="mapName"
      :playbook-id="practicePlaybookId"
    />
  </div>
</template>

<style scoped>
/* Rows fold rather than blink: deleting an execute from the editor drops one
   out of this list, and a list that re-lays out instantly is a list you have
   to re-read. */
.pbrow {
  display: grid;
  grid-template-rows: 1fr;
}
.pbrow-enter-active {
  transition:
    grid-template-rows 240ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 220ms ease-out;
  /* Staggered, so a freshly loaded list arrives as a list instead of a block. */
  transition-delay: var(--pbrow-delay, 0ms);
}
.pbrow-leave-active {
  transition:
    grid-template-rows 200ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 110ms ease-in;
}
.pbrow-enter-from,
.pbrow-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
.pbrow-move {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .pbrow-enter-active,
  .pbrow-leave-active,
  .pbrow-move {
    transition-duration: 1ms;
    transition-delay: 0ms;
  }
}
</style>
