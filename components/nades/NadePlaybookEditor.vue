<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
import { toast } from "~/components/ui/toast";
import NadeRadarBoard from "~/components/nades/NadeRadarBoard.vue";
import NadeLineupPickerDialog from "~/components/nades/NadeLineupPickerDialog.vue";
import NadePlaybookCoveragePanel from "~/components/nades/NadePlaybookCoveragePanel.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  deleteNadePlaybookMutation,
  nadeLineupsQuery,
  saveNadePlaybookMutation,
  teamRosterQuery,
} from "~/graphql/nadesGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import {
  NADE_PLAYBOOK_MAX_STEPS,
  NADE_SIDES,
  NADE_TYPE_COLORS,
  formatNadeOffset,
  parseNadeOffset,
} from "~/utilities/nadeDisplay";
import type {
  NadeAuthorRef,
  NadeLineup,
  NadePlaybook,
  NadePlaybookStep,
  NadePlaybookStepInput,
  NadeSide,
  NadeVisibility,
} from "~/types/nade";

const props = withDefaults(
  defineProps<{
    mapName: string;
    playbook?: NadePlaybook | null;
    steps?: NadePlaybookStep[];
  }>(),
  {
    playbook: null,
    steps: () => [],
  },
);

const emit = defineEmits<{
  (e: "saved", id: string): void;
  (e: "deleted", id: string): void;
  (e: "cancel"): void;
}>();

const { t } = useI18n();

// Reka Select rejects an empty-string value, so "unset" rides a sentinel —
// same shape as the practice dialog's region/collection pickers.
const NO_TEAM = "none";
const NO_ASSIGNEE = "none";

const VISIBILITIES: NadeVisibility[] = ["Private", "Team", "Public"];

type StepRow = {
  key: string;
  lineupId: string;
  offsetSeconds: string;
  assignedSteamId: string;
  note: string;
};

const auth = useAuthStore();
const myTeams = computed(
  () =>
    (auth.me?.teams ?? []) as Array<{
      id: string;
      name: string;
      short_name?: string | null;
    }>,
);

const name = ref("");
const description = ref("");
const side = ref<NadeSide>("TERRORIST");
const teamId = ref<string>(NO_TEAM);
const visibility = ref<NadeVisibility>("Team");
const rows = ref<StepRow[]>([]);
const selectedKey = ref<string | null>(null);
const pickerOpen = ref(false);
const confirmDelete = ref(false);
const saving = ref(false);

const lineupsById = ref<Record<string, NadeLineup>>({});
const roster = ref<NadeAuthorRef[]>([]);

const readOnly = computed(() => !!props.playbook && !props.playbook.can_edit);

let rowSeed = 0;
function nextKey() {
  rowSeed += 1;
  return `step-${rowSeed}`;
}

async function loadLineups(ids: string[]) {
  const missing = ids.filter((id) => !lineupsById.value[id]);
  if (!missing.length) {
    return;
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: nadeLineupsQuery,
      variables: {
        where: { id: { _in: missing }, can_view: { _eq: true } },
        order_by: [{ created_at: order_by.desc }],
        limit: missing.length,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    const next = { ...lineupsById.value };
    for (const lineup of ((data as any)?.nade_lineups ?? []) as NadeLineup[]) {
      next[lineup.id] = lineup;
    }
    lineupsById.value = next;
  } catch (error) {
    console.error("[nades] playbook lineup load error:", error);
  }
}

async function loadRoster(id: string | null) {
  if (!id) {
    roster.value = [];
    return;
  }
  try {
    const { data } = await getGraphqlClient().query({
      query: teamRosterQuery,
      variables: { id },
      fetchPolicy: "cache-first",
    });
    roster.value = (((data as any)?.teams_by_pk?.roster ?? []) as Array<{
      player: NadeAuthorRef | null;
    }>)
      .map((entry) => entry.player)
      .filter((player): player is NadeAuthorRef => !!player);
  } catch (error) {
    console.error("[nades] playbook roster load error:", error);
    roster.value = [];
  }
}

function resetForm() {
  const playbook = props.playbook;
  name.value = playbook?.name ?? "";
  description.value = playbook?.description ?? "";
  side.value = playbook?.side ?? "TERRORIST";
  teamId.value = playbook?.team_id ?? NO_TEAM;
  visibility.value = playbook?.visibility ?? "Team";
  rows.value = [...(props.steps ?? [])]
    .sort((a, b) => a.step_order - b.step_order)
    .map((step) => ({
      key: nextKey(),
      lineupId: step.nade_lineup_id,
      offsetSeconds: formatNadeOffset(step.offset_ms),
      assignedSteamId: step.assigned_steam_id ?? NO_ASSIGNEE,
      note: step.note ?? "",
    }));
  selectedKey.value = null;
  void loadLineups(rows.value.map((row) => row.lineupId));
}

watch(
  () => [props.playbook?.id ?? null, props.steps] as const,
  resetForm,
  { immediate: true },
);

watch(
  teamId,
  (id) => {
    void loadRoster(id === NO_TEAM ? null : id);
  },
  { immediate: true },
);

const orderedLineups = computed(() =>
  rows.value
    .map((row) => lineupsById.value[row.lineupId])
    .filter((lineup): lineup is NadeLineup => !!lineup),
);

const selectedLineupId = computed(() => {
  const row = rows.value.find((entry) => entry.key === selectedKey.value);
  return row?.lineupId ?? null;
});

const pickedIds = computed(() => rows.value.map((row) => row.lineupId));

const atStepLimit = computed(
  () => rows.value.length >= NADE_PLAYBOOK_MAX_STEPS,
);

const rosterBySteamId = computed(() => {
  const map: Record<string, NadeAuthorRef> = {};
  for (const player of roster.value) {
    map[player.steam_id] = player;
  }
  return map;
});

function move(index: number, delta: number) {
  const to = index + delta;
  if (to < 0 || to >= rows.value.length) {
    return;
  }
  const next = [...rows.value];
  const [row] = next.splice(index, 1);
  next.splice(to, 0, row);
  rows.value = next;
}

const dragIndex = ref<number | null>(null);
const overIndex = ref<number | null>(null);

function onDragStart(index: number, event: DragEvent) {
  if (readOnly.value) {
    return;
  }
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
  move(from, index - from);
}

function onDragEnd() {
  dragIndex.value = null;
  overIndex.value = null;
}

function addLineup(lineup: NadeLineup) {
  if (atStepLimit.value) {
    toast({
      title: t("pages.nades.playbooks.step_limit", {
        count: NADE_PLAYBOOK_MAX_STEPS,
      }),
      variant: "destructive",
    });
    return;
  }
  lineupsById.value = { ...lineupsById.value, [lineup.id]: lineup };
  const row: StepRow = {
    key: nextKey(),
    lineupId: lineup.id,
    // A new beat lands after the last one rather than on top of it.
    offsetSeconds: formatNadeOffset(
      parseNadeOffset(rows.value.length ? lastOffsetSeconds() + 1 : 0),
    ),
    assignedSteamId: NO_ASSIGNEE,
    note: "",
  };
  rows.value = [...rows.value, row];
  selectedKey.value = row.key;
}

function lastOffsetSeconds() {
  const last = rows.value[rows.value.length - 1];
  return Number(last?.offsetSeconds ?? 0) || 0;
}

function removeRow(key: string) {
  rows.value = rows.value.filter((row) => row.key !== key);
  if (selectedKey.value === key) {
    selectedKey.value = null;
  }
}

// Resolved once per render rather than through a helper called from the
// template, so the markup never has to assert that a lineup is loaded.
const rowViews = computed(() =>
  rows.value.map((row) => {
    const lineup = lineupsById.value[row.lineupId] ?? null;
    return {
      row,
      lineup,
      color: lineup
        ? (NADE_TYPE_COLORS[lineup.nade_type] ?? "#ffffff")
        : "#8a8a8a",
      typeKey: lineup ? `pages.nades.types.${lineup.nade_type}` : "",
      techniqueKey: lineup
        ? `pages.nades.techniques.${lineup.technique}`
        : "",
    };
  }),
);

// A step can point at a lineup this viewer cannot see. The save action rejects
// the whole playbook in that case, so the warning has to be visible before the
// button is pressed rather than only in the failure toast.
const unresolvedSteps = computed(
  () => rowViews.value.filter((view) => !view.lineup).length,
);

function selectByLineupId(id: string | null) {
  if (!id) {
    return;
  }
  const row = rows.value.find((entry) => entry.lineupId === id);
  if (row) {
    selectedKey.value = row.key;
  }
}

const canSave = computed(() => !readOnly.value && name.value.trim().length > 0);

async function save() {
  if (!canSave.value) {
    return;
  }
  saving.value = true;
  try {
    const steps: NadePlaybookStepInput[] = rows.value.map((row) => ({
      nade_lineup_id: row.lineupId,
      offset_ms: parseNadeOffset(row.offsetSeconds),
      assigned_steam_id:
        row.assignedSteamId === NO_ASSIGNEE ? null : row.assignedSteamId,
      note: row.note.trim() ? row.note.trim() : null,
    }));
    // The editor owns the whole step list, so it always sends one. Leaving
    // `steps` out of the variables is what preserves the stored order; an empty
    // array is a deliberate "clear the execute", never a shorthand for "no
    // change".
    const { data } = await getGraphqlClient().mutate({
      mutation: saveNadePlaybookMutation,
      variables: {
        playbook_id: props.playbook?.id ?? null,
        name: name.value.trim(),
        description: description.value.trim() || null,
        map_name: props.mapName,
        side: side.value,
        team_id: teamId.value === NO_TEAM ? null : teamId.value,
        visibility: visibility.value,
        steps,
      },
    });
    const id = (data as any)?.saveNadePlaybook?.id;
    if (!id) {
      throw new Error("no playbook");
    }
    toast({ title: t("pages.nades.playbooks.saved") });
    emit("saved", id);
  } catch (error: any) {
    toast({
      title: t("pages.nades.playbooks.save_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    saving.value = false;
  }
}

async function destroy() {
  const playbook = props.playbook;
  if (!playbook) {
    return;
  }
  try {
    await getGraphqlClient().mutate({
      mutation: deleteNadePlaybookMutation,
      variables: { playbook_id: playbook.id },
    });
    emit("deleted", playbook.id);
  } catch (error: any) {
    toast({
      title: t("pages.nades.playbooks.delete_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
    <div class="flex flex-col gap-3">
      <div class="grid gap-2 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("common.name") }}
          </label>
          <Input
            v-model="name"
            :disabled="readOnly"
            maxlength="120"
            :placeholder="$t('pages.nades.playbooks.name_placeholder')"
          />
        </div>

        <div class="sm:col-span-2">
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("common.description") }}
          </label>
          <Textarea
            v-model="description"
            :disabled="readOnly"
            rows="2"
            maxlength="1000"
            :placeholder="$t('pages.nades.playbooks.description_placeholder')"
          />
        </div>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.nades.filters.side") }}
          </label>
          <Select v-model="side" :disabled="readOnly">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="entry of NADE_SIDES"
                :key="entry"
                :value="entry"
              >
                {{ $t(`pages.nades.sides.${entry}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.nades.playbooks.team") }}
          </label>
          <Select v-model="teamId" :disabled="readOnly">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="NO_TEAM">{{ $t("common.none") }}</SelectItem>
              <SelectItem
                v-for="team of myTeams"
                :key="team.id"
                :value="team.id"
              >
                {{ team.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.nades.playbooks.visibility") }}
          </label>
          <Select v-model="visibility" :disabled="readOnly">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="entry of VISIBILITIES"
                :key="entry"
                :value="entry"
              >
                {{ $t(`pages.nades.visibility.${entry}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p
            v-if="visibility === 'Team' && teamId === NO_TEAM"
            class="mt-1 text-[0.65rem] text-[hsl(var(--tac-amber))]"
          >
            {{ $t("pages.nades.playbooks.team_required") }}
          </p>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 pt-1">
        <span
          class="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{
            $t("pages.nades.playbooks.steps_count", {
              count: rows.length,
              max: NADE_PLAYBOOK_MAX_STEPS,
            })
          }}
        </span>
        <Button
          v-if="!readOnly"
          size="sm"
          variant="outline"
          :disabled="atStepLimit"
          @click="pickerOpen = true"
        >
          <Plus class="mr-1 h-4 w-4" />
          {{ $t("pages.nades.playbooks.add_step") }}
        </Button>
      </div>

      <ol class="flex flex-col gap-2">
        <li
          v-for="(view, index) of rowViews"
          :key="view.row.key"
          :draggable="!readOnly"
          class="rounded-sm border bg-background/40 p-2 transition-[opacity,border-color]"
          :class="[
            dragIndex === index ? 'opacity-40' : '',
            selectedKey === view.row.key
              ? 'border-[hsl(var(--tac-amber)/0.6)]'
              : overIndex === index && dragIndex !== index
                ? 'border-[hsl(var(--tac-amber)/0.7)]'
                : 'border-border/60',
          ]"
          @dragstart="onDragStart(index, $event)"
          @dragenter="onDragEnter(index)"
          @dragover.prevent
          @drop.prevent="onDrop(index)"
          @dragend="onDragEnd"
          @click="selectedKey = view.row.key"
        >
          <div class="flex items-center gap-2">
            <GripVertical
              v-if="!readOnly"
              class="hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing sm:block"
            />
            <div v-if="!readOnly" class="flex shrink-0 flex-col sm:hidden">
              <button
                type="button"
                class="flex h-4 w-5 items-center justify-center text-muted-foreground/70 disabled:opacity-25"
                :disabled="index === 0"
                :aria-label="$t('pages.nades.playbooks.move_up')"
                @click.stop="move(index, -1)"
              >
                <ChevronUp class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="flex h-4 w-5 items-center justify-center text-muted-foreground/70 disabled:opacity-25"
                :disabled="index === rows.length - 1"
                :aria-label="$t('pages.nades.playbooks.move_down')"
                @click.stop="move(index, 1)"
              >
                <ChevronDown class="h-3.5 w-3.5" />
              </button>
            </div>

            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border font-mono text-xs font-bold tabular-nums"
            >
              {{ index + 1 }}
            </span>

            <span
              aria-hidden="true"
              class="h-3 w-3 shrink-0 rounded-[2px]"
              :style="{ backgroundColor: view.color }"
            />

            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">
                {{
                  view.lineup?.name ??
                  $t("pages.nades.playbooks.unknown_lineup")
                }}
              </div>
              <div
                v-if="view.lineup"
                class="truncate font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {{ $t(view.typeKey) }} · {{ $t(view.techniqueKey) }}
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <Input
                v-model="view.row.offsetSeconds"
                type="number"
                min="0"
                max="600"
                step="0.1"
                :disabled="readOnly"
                class="h-8 w-20 font-mono text-xs tabular-nums"
                :title="$t('pages.nades.playbooks.offset_hint')"
                @click.stop
              />
              <span
                class="font-mono text-[0.6rem] uppercase text-muted-foreground"
              >
                {{ $t("pages.nades.playbooks.seconds") }}
              </span>
            </div>

            <Button
              v-if="!readOnly"
              size="icon"
              variant="ghost"
              class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              :aria-label="$t('common.remove')"
              @click.stop="removeRow(view.row.key)"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-2 pl-9">
            <Select
              v-model="view.row.assignedSteamId"
              :disabled="readOnly || !roster.length"
            >
              <SelectTrigger class="h-8 w-[min(100%,12rem)] text-xs">
                <SelectValue
                  :placeholder="$t('pages.nades.playbooks.unassigned')"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="NO_ASSIGNEE">
                  {{ $t("pages.nades.playbooks.unassigned") }}
                </SelectItem>
                <SelectItem
                  v-for="player of roster"
                  :key="player.steam_id"
                  :value="player.steam_id"
                >
                  {{ player.name }}
                </SelectItem>
              </SelectContent>
            </Select>

            <!-- A step can carry an assignee who has since left the roster;
                 showing the bare id beats silently dropping them. -->
            <Badge
              v-if="
                view.row.assignedSteamId !== NO_ASSIGNEE &&
                !rosterBySteamId[view.row.assignedSteamId]
              "
              variant="outline"
              class="font-mono text-[0.58rem]"
            >
              {{ view.row.assignedSteamId }}
            </Badge>

            <Input
              v-model="view.row.note"
              :disabled="readOnly"
              maxlength="160"
              class="h-8 min-w-[8rem] flex-1 text-xs"
              :placeholder="$t('pages.nades.playbooks.note_placeholder')"
              @click.stop
            />
          </div>
        </li>
      </ol>

      <p
        v-if="!rows.length"
        class="rounded-sm border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground"
      >
        {{ $t("pages.nades.playbooks.no_steps") }}
      </p>

      <p
        v-if="!roster.length && teamId !== NO_TEAM"
        class="text-[0.65rem] text-muted-foreground"
      >
        {{ $t("pages.nades.playbooks.no_roster") }}
      </p>
      <p
        v-else-if="teamId === NO_TEAM"
        class="text-[0.65rem] text-muted-foreground"
      >
        {{ $t("pages.nades.playbooks.assign_needs_team") }}
      </p>

      <p
        v-if="unresolvedSteps"
        class="rounded-sm border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.1)] px-2 py-1 text-[0.65rem] text-[hsl(var(--tac-amber))]"
      >
        {{
          $t("pages.nades.playbooks.unresolved", { count: unresolvedSteps })
        }}
      </p>

      <div class="flex flex-wrap items-center gap-2 pt-1">
        <Button
          v-if="!readOnly"
          class="tac-amber-cta"
          :loading="saving"
          :disabled="!canSave"
          @click="save()"
        >
          <Save class="mr-1 h-4 w-4" />
          {{ $t("common.save") }}
        </Button>
        <Button variant="outline" @click="emit('cancel')">
          <X class="mr-1 h-4 w-4" />
          {{ $t("common.cancel") }}
        </Button>
        <Button
          v-if="playbook && playbook.can_edit"
          variant="destructive"
          class="ml-auto"
          @click="confirmDelete = true"
        >
          <Trash2 class="mr-1 h-4 w-4" />
          {{ $t("common.delete") }}
        </Button>
      </div>
    </div>

    <div class="lg:sticky lg:top-4 lg:self-start">
      <NadeRadarBoard
        :map-name="mapName"
        :lineups="orderedLineups"
        :selected-id="selectedLineupId"
        show-all-lines
        @select="selectByLineupId"
      />
      <p class="mt-2 text-xs text-muted-foreground">
        {{ $t("pages.nades.playbooks.board_hint") }}
      </p>
    </div>

    <!-- Coverage is asked of the stored playbook, so there is nothing to ask
         about until one exists. -->
    <div v-if="playbook?.id" class="lg:col-span-2">
      <NadePlaybookCoveragePanel
        :playbook-id="playbook.id"
        :map-name="mapName"
        :steps="steps"
        :lineups-by-id="lineupsById"
      />
    </div>

    <NadeLineupPickerDialog
      v-model:open="pickerOpen"
      :map-name="mapName"
      :side="side"
      :picked-ids="pickedIds"
      @pick="addLineup"
    />

    <AlertDialog :open="confirmDelete" @update:open="confirmDelete = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ $t("pages.nades.playbooks.confirm_delete") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("pages.nades.playbooks.confirm_delete_description") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="confirmDelete = false">
            {{ $t("common.cancel") }}
          </AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="
              destroy();
              confirmDelete = false;
            "
          >
            {{ $t("common.confirm") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
