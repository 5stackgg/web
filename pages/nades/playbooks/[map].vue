<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { ArrowLeft, ListOrdered, Pencil, Plus, Rocket } from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import Empty from "~/components/ui/empty/Empty.vue";
import EmptyTitle from "~/components/ui/empty/EmptyTitle.vue";
import EmptyDescription from "~/components/ui/empty/EmptyDescription.vue";
import NadePlaybookEditor from "~/components/nades/NadePlaybookEditor.vue";
import StartPracticeDialog from "~/components/nades/StartPracticeDialog.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  nadeLineupsQuery,
  nadePlaybookStepsQuery,
  nadePlaybooksQuery,
} from "~/graphql/nadesGraphql";
import { order_by } from "~/generated/zeus";
import { normalizeMapName } from "~/utilities/mapAssets";
import cleanMapName from "~/utilities/cleanMapName";
import { NADE_TYPE_COLORS, formatNadeOffset } from "~/utilities/nadeDisplay";
import type {
  NadeLineup,
  NadePlaybook,
  NadePlaybookStep,
} from "~/types/nade";

const route = useRoute();

const mapName = computed(() => normalizeMapName(String(route.params.map)));
const mapTitle = computed(() => cleanMapName(mapName.value));

const playbooks = ref<NadePlaybook[]>([]);
const steps = ref<NadePlaybookStep[]>([]);
const lineupsById = ref<Record<string, NadeLineup>>({});
const loading = ref(true);

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
  const grouped: Record<string, NadePlaybookStep[]> = {};
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
      query: nadePlaybooksQuery,
      variables: {
        where: {
          map_name: { _eq: mapName.value },
          can_view: { _eq: true },
        },
        order_by: [{ updated_at: order_by.desc }],
        limit: 100,
      },
      fetchPolicy: "network-only",
    });
    playbooks.value = ((data as any)?.nade_playbooks ?? []) as NadePlaybook[];

    const ids = playbooks.value.map((entry) => entry.id);
    if (!ids.length) {
      steps.value = [];
      return;
    }

    // Every listed playbook's steps in one round trip, then the lineups they
    // point at in a second — a per-playbook fetch would be N+1 for a page that
    // only wants to draw a strip of colours.
    const stepResult = await client.query({
      query: nadePlaybookStepsQuery,
      variables: {
        where: { playbook_id: { _in: ids } },
        order_by: [{ step_order: order_by.asc }],
      },
      fetchPolicy: "network-only",
    });
    steps.value = ((stepResult.data as any)?.nade_playbook_steps ??
      []) as NadePlaybookStep[];

    const lineupIds = [
      ...new Set(steps.value.map((step) => step.nade_lineup_id)),
    ];
    if (!lineupIds.length) {
      return;
    }
    const lineupResult = await client.query({
      query: nadeLineupsQuery,
      variables: {
        where: { id: { _in: lineupIds }, can_view: { _eq: true } },
        order_by: [{ created_at: order_by.desc }],
        limit: lineupIds.length,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    const next: Record<string, NadeLineup> = {};
    for (const lineup of ((lineupResult.data as any)?.nade_lineups ??
      []) as NadeLineup[]) {
      next[lineup.id] = lineup;
    }
    lineupsById.value = next;
  } catch (error) {
    console.error("[nades] playbook load error:", error);
    playbooks.value = [];
    steps.value = [];
  } finally {
    loading.value = false;
  }
}

watch(mapName, load, { immediate: true });

const cards = computed(() =>
  playbooks.value.map((playbook) => {
    const own = stepsByPlaybook.value[playbook.id] ?? [];
    return {
      playbook,
      steps: own,
      swatches: own.map((step, index) => {
        const lineup = lineupsById.value[step.nade_lineup_id];
        return {
          key: `${step.id}-${index}`,
          color: lineup
            ? (NADE_TYPE_COLORS[lineup.nade_type] ?? "#ffffff")
            : "#8a8a8a",
          offset: formatNadeOffset(step.offset_ms),
        };
      }),
    };
  }),
);

function startCreate() {
  editingId.value = null;
  creating.value = true;
}

function startEdit(id: string) {
  creating.value = false;
  editingId.value = id;
}

function closeEditor() {
  creating.value = false;
  editingId.value = null;
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
  <PageTransition>
    <TacticalPageHeader>
      <template #description>{{ $t("pages.nades.playbooks.eyebrow") }}</template>
      <template #title>{{ mapTitle }}</template>
      <template #subtitle>
        {{ $t("pages.nades.playbooks.subtitle") }}
      </template>
      <template #actions>
        <NuxtLink :to="{ name: 'nades-map', params: { map: mapName } }">
          <Button variant="outline">
            <ArrowLeft class="mr-1 h-4 w-4" />
            {{ $t("pages.nades.back_to_map") }}
          </Button>
        </NuxtLink>
        <Button v-if="!editorOpen" class="tac-amber-cta" @click="startCreate()">
          <Plus class="mr-1 h-4 w-4" />
          {{ $t("pages.nades.playbooks.new") }}
        </Button>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition v-if="editorOpen" :delay="60" class="mt-4">
    <NadePlaybookEditor
      :key="editing?.id ?? 'new'"
      :map-name="mapName"
      :playbook="editing"
      :steps="editingSteps"
      @saved="onSaved"
      @deleted="onDeleted"
      @cancel="closeEditor"
    />
  </PageTransition>

  <template v-else>
    <PageTransition v-if="loading" :delay="60" class="mt-4">
      <div class="flex flex-col gap-2">
        <Skeleton v-for="i in 4" :key="i" class="h-24 w-full rounded-md" />
      </div>
    </PageTransition>

    <PageTransition v-else-if="!cards.length" :delay="60" class="mt-4">
      <Empty>
        <EmptyTitle>{{ $t("pages.nades.playbooks.empty") }}</EmptyTitle>
        <EmptyDescription>
          {{ $t("pages.nades.playbooks.empty_description") }}
        </EmptyDescription>
      </Empty>
    </PageTransition>

    <PageTransition v-else :delay="60" class="mt-4">
      <div
        class="grid gap-3"
        style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))"
      >
        <div
          v-for="card of cards"
          :key="card.playbook.id"
          class="flex flex-col gap-2 rounded-md border border-border bg-card/40 p-3 [backdrop-filter:blur(6px)]"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold">
                {{ card.playbook.name }}
              </div>
              <div
                class="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
              >
                {{ $t(`pages.nades.sides.${card.playbook.side}`) }}
                ·
                {{ $t(`pages.nades.visibility.${card.playbook.visibility}`) }}
              </div>
            </div>
            <Badge
              variant="outline"
              class="shrink-0 font-mono text-[0.6rem] tabular-nums uppercase"
            >
              <ListOrdered class="mr-1 h-3 w-3" />
              {{ card.steps.length }}
            </Badge>
          </div>

          <p
            v-if="card.playbook.description"
            class="line-clamp-2 text-xs text-muted-foreground"
          >
            {{ card.playbook.description }}
          </p>

          <div v-if="card.swatches.length" class="flex flex-wrap gap-1">
            <span
              v-for="swatch of card.swatches"
              :key="swatch.key"
              class="inline-flex items-center gap-1 rounded-sm border border-border/60 px-1 py-0.5 font-mono text-[0.55rem] tabular-nums text-muted-foreground"
            >
              <span
                aria-hidden="true"
                class="h-2 w-2 rounded-[1px]"
                :style="{ backgroundColor: swatch.color }"
              />
              {{ swatch.offset }}s
            </span>
          </div>

          <div class="mt-auto flex items-center gap-2 pt-1">
            <Button
              v-if="card.playbook.can_edit"
              size="sm"
              variant="outline"
              @click="startEdit(card.playbook.id)"
            >
              <Pencil class="mr-1 h-4 w-4" />
              {{ $t("common.edit") }}
            </Button>
            <Button
              v-else
              size="sm"
              variant="outline"
              @click="startEdit(card.playbook.id)"
            >
              {{ $t("common.view") }}
            </Button>
            <Button
              size="sm"
              class="tac-amber-cta ml-auto"
              @click="practice(card.playbook.id)"
            >
              <Rocket class="mr-1 h-4 w-4" />
              {{ $t("pages.nades.practice.start") }}
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  </template>

  <StartPracticeDialog
    v-model:open="practiceOpen"
    :map-name="mapName"
    :playbook-id="practicePlaybookId"
  />
</template>
