<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  GripVertical,
  MapPin,
  MoreHorizontal,
  Plus,
  Save,
  Trash2,
  TriangleAlert,
  User,
} from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import Fold from "~/components/ui/transitions/Fold.vue";
import UtilitySegmented from "~/components/utility/UtilitySegmented.vue";
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
import UtilityLineupPickerDialog from "~/components/utility/UtilityLineupPickerDialog.vue";
import UtilityPlaybookCoveragePanel from "~/components/utility/UtilityPlaybookCoveragePanel.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  deleteUtilityPlaybookMutation,
  utilityLineupsQuery,
  saveUtilityPlaybookMutation,
  teamRosterQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import {
  UTILITY_CARRY_LIMITS,
  UTILITY_CARRY_TOTAL,
  UTILITY_PLAYBOOK_MAX_STEPS,
  UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS,
  UTILITY_PLAYBOOK_OFFSET_STEP_SECONDS,
  UTILITY_SIDES,
  UTILITY_TYPE_COLORS,
  formatUtilityOffset,
  parseUtilityOffset,
  utilityOrigin,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBoardMarker,
  UtilityPanelBoard,
} from "~/utilities/utilityDisplay";
import type {
  UtilityAuthorRef,
  UtilityLineup,
  UtilityPlaybook,
  UtilityPlaybookStep,
  UtilityPlaybookStepInput,
  UtilitySide,
  UtilityType,
  UtilityVisibility,
} from "~/types/utility";

const props = withDefaults(
  defineProps<{
    mapName: string;
    playbook?: UtilityPlaybook | null;
    steps?: UtilityPlaybookStep[];
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
  (e: "board", state: UtilityPanelBoard): void;
}>();

const { t } = useI18n();

// Reka Select rejects an empty-string value, so "unset" rides a sentinel —
// same shape as the practice dialog's region/collection pickers.
const NO_TEAM = "none";
const NO_ASSIGNEE = "none";

const VISIBILITIES: UtilityVisibility[] = ["Private", "Team", "Public"];

// Side and visibility are two words each. A <Select> spends a label, a shell
// and a round trip to hide two words; shown open they cost one row together.
const sideOptions = computed(() =>
  UTILITY_SIDES.map((entry) => ({
    key: entry,
    label: t(`pages.utility.sides.${entry}`),
  })),
);
const visibilityOptions = computed(() =>
  VISIBILITIES.map((entry) => ({
    key: entry,
    label: t(`pages.utility.visibility.${entry}`),
  })),
);

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
const side = ref<UtilitySide>("TERRORIST");
const teamId = ref<string>(NO_TEAM);
const visibility = ref<UtilityVisibility>("Team");
const rows = ref<StepRow[]>([]);
const selectedKey = ref<string | null>(null);
const pickerOpen = ref(false);
const confirmDelete = ref(false);
const saving = ref(false);

const lineupsById = ref<Record<string, UtilityLineup>>({});
// Steps arrive before the lineups they point at. Until that round trip lands,
// every row is "unavailable" and the editor is shouting that the execute is
// broken -- for about 200ms, at the exact moment it opens.
const lineupsLoading = ref(false);
const roster = ref<UtilityAuthorRef[]>([]);

const readOnly = computed(() => !!props.playbook && !props.playbook.can_edit);

// UtilitySegmented speaks plain strings; these keep the typed refs honest.
const sideModel = computed<string>({
  get: () => side.value,
  set: (value) => (side.value = value as UtilitySide),
});
const visibilityModel = computed<string>({
  get: () => visibility.value,
  set: (value) => (visibility.value = value as UtilityVisibility),
});

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
  lineupsLoading.value = true;
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupsQuery,
      variables: {
        where: { id: { _in: missing }, can_view: { _eq: true } },
        order_by: [{ created_at: order_by.desc }],
        limit: missing.length,
        offset: 0,
      },
      fetchPolicy: "network-only",
    });
    const next = { ...lineupsById.value };
    for (const lineup of ((data as any)?.utility_lineups ?? []) as UtilityLineup[]) {
      next[lineup.id] = lineup;
    }
    lineupsById.value = next;
  } catch (error) {
    console.error("[utility] playbook lineup load error:", error);
  } finally {
    lineupsLoading.value = false;
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
      player: UtilityAuthorRef | null;
    }>)
      .map((entry) => entry.player)
      .filter((player): player is UtilityAuthorRef => !!player);
  } catch (error) {
    console.error("[utility] playbook roster load error:", error);
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
      lineupId: step.utility_lineup_id,
      offsetSeconds: formatUtilityOffset(step.offset_ms),
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
    .filter((lineup): lineup is UtilityLineup => !!lineup),
);

const selectedLineupId = computed(() => {
  const row = rows.value.find((entry) => entry.key === selectedKey.value);
  return row?.lineupId ?? null;
});

const pickedIds = computed(() => rows.value.map((row) => row.lineupId));

const atStepLimit = computed(
  () => rows.value.length >= UTILITY_PLAYBOOK_MAX_STEPS,
);

const rosterBySteamId = computed(() => {
  const map: Record<string, UtilityAuthorRef> = {};
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

function addLineup(lineup: UtilityLineup) {
  if (atStepLimit.value) {
    toast({
      title: t("pages.utility.playbooks.step_limit", {
        count: UTILITY_PLAYBOOK_MAX_STEPS,
      }),
      variant: "destructive",
    });
    return;
  }
  lineupsById.value = { ...lineupsById.value, [lineup.id]: lineup };
  const row: StepRow = {
    key: nextKey(),
    lineupId: lineup.id,
    // A new beat lands after the last one rather than on top of it, and the
    // first one lands on the clock rather than at zero.
    offsetSeconds: formatUtilityOffset(
      parseUtilityOffset(
        rows.value.length
          ? lastOffsetSeconds() + 1
          : UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS,
      ),
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
        ? (UTILITY_TYPE_COLORS[lineup.utility_type] ?? "#ffffff")
        : "#8a8a8a",
      typeKey: lineup ? `pages.utility.types.${lineup.utility_type}` : "",
      techniqueKey: lineup
        ? `pages.utility.techniques.${lineup.technique}`
        : "",
    };
  }),
);

// A step can point at a lineup this viewer cannot see. The save action rejects
// the whole playbook in that case, so the warning has to be visible before the
// button is pressed rather than only in the failure toast.
const unresolvedSteps = computed(() =>
  lineupsLoading.value
    ? 0
    : rowViews.value.filter((view) => !view.lineup).length,
);

function selectByLineupId(id: string | null) {
  if (!id) {
    selectedKey.value = null;
    return;
  }
  const row = rows.value.find((entry) => entry.lineupId === id);
  if (!row) {
    return;
  }
  selectedKey.value = row.key;
  // The map is a column away from the list it drives, so a step picked out
  // there has to bring its row over rather than expect it to be found.
  if (typeof document !== "undefined") {
    document
      .getElementById(`utility-step-${row.key}`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

const hoveredKey = ref<string | null>(null);

const hoveredLineupId = computed(() => {
  const row = rows.value.find((entry) => entry.key === hoveredKey.value);
  return row?.lineupId ?? null;
});

// The order is the point, and a colour is not an order. Each beat gets its
// number on the map so the list and the board can be read against each other.
const stepMarkers = computed<UtilityBoardMarker[]>(() => {
  const out: UtilityBoardMarker[] = [];
  rowViews.value.forEach((view, index) => {
    if (!view.lineup) {
      return;
    }
    out.push({
      key: view.row.key,
      point: utilityOrigin(view.lineup),
      color: view.color,
      label: String(index + 1),
      shape: "badge",
    });
  });
  return out;
});

// Coverage draws sightlines on the same board rather than a third copy of the
// map, so while it is open it owns what the page draws and the editor stands
// down instead of fighting it for the surface.
const coverageBoard = ref<UtilityPanelBoard | null>(null);

watch(
  [coverageBoard, orderedLineups, stepMarkers, selectedLineupId, hoveredLineupId],
  () => {
    if (coverageBoard.value) {
      emit("board", coverageBoard.value);
      return;
    }
    emit("board", {
      lineups: orderedLineups.value,
      showAllLines: true,
      markers: stepMarkers.value,
      selectedId: selectedLineupId.value,
      hoveredId: hoveredLineupId.value,
      onSelect: selectByLineupId,
      onHover: (id: string | null) => {
        hoveredKey.value =
          rows.value.find((entry) => entry.lineupId === id)?.key ?? null;
      },
    });
  },
  { immediate: true },
);

/**
 * The carry limit is a player's belt, not the execute's budget, so this only
 * has anything to say once steps are assigned. Two counts per player: one per
 * grenade type, and the four-grenade total that catches a loadout which is
 * legal type by type and still cannot be bought.
 */
const loadoutOverloads = computed(() => {
  type Tally = { total: number; byType: Map<UtilityType, number> };
  const tallies = new Map<string, Tally>();

  for (const view of rowViews.value) {
    const steamId = view.row.assignedSteamId;
    if (steamId === NO_ASSIGNEE || !view.lineup) {
      continue;
    }
    const tally = tallies.get(steamId) ?? { total: 0, byType: new Map() };
    const type = view.lineup.utility_type as UtilityType;
    tally.total += 1;
    tally.byType.set(type, (tally.byType.get(type) ?? 0) + 1);
    tallies.set(steamId, tally);
  }

  const out: Array<{
    key: string;
    steamId: string;
    name: string;
    type: UtilityType | null;
    count: number;
    limit: number;
  }> = [];

  for (const [steamId, tally] of tallies) {
    const name = rosterBySteamId.value[steamId]?.name ?? steamId;
    for (const [type, count] of tally.byType) {
      const limit = UTILITY_CARRY_LIMITS[type] ?? 1;
      if (count > limit) {
        out.push({ key: `${steamId}-${type}`, steamId, name, type, count, limit });
      }
    }
    if (tally.total > UTILITY_CARRY_TOTAL) {
      out.push({
        key: `${steamId}-total`,
        steamId,
        name,
        type: null,
        count: tally.total,
        limit: UTILITY_CARRY_TOTAL,
      });
    }
  }

  return out;
});

const overloadedSteamIds = computed(
  () => new Set(loadoutOverloads.value.map((entry) => entry.steamId)),
);

// Seconds are the spine of an execute, so the gutter shows elapsed time rather
// than a row number: the gap between two beats is the thing being designed.
const timeline = computed(() => {
  const beats = rowViews.value.map((view) => ({
    ...view,
    seconds: Number(view.row.offsetSeconds) || 0,
  }));
  // Where each lineup was first used, so a second helping can point at it. A
  // re-smoke is legal, so this names the earlier step rather than calling the
  // later one wrong.
  const firstUse = new Map<string, number>();
  beats.forEach((beat, index) => {
    if (!firstUse.has(beat.row.lineupId)) {
      firstUse.set(beat.row.lineupId, index);
    }
  });
  return beats.map((beat, index) => {
    const first = firstUse.get(beat.row.lineupId);
    const overload = overloadedSteamIds.value.has(beat.row.assignedSteamId);
    return {
      ...beat,
      // Only the first beat at a given second prints it. Four smokes on the
      // same call are one moment, and printing "0.0" four times says otherwise.
      showTime: index === 0 || beats[index - 1].seconds !== beat.seconds,
      // A beat that lands before the one above it is a mistake you can only see
      // if the list says so.
      outOfOrder: index > 0 && beat.seconds < beats[index - 1].seconds,
      // 1-based, because that is the number this step wears on the map.
      repeatOf: first !== undefined && first !== index ? first + 1 : null,
      overloaded: overload,
    };
  });
});

const outOfOrderCount = computed(
  () => timeline.value.filter((beat) => beat.outOfOrder).length,
);

const repeatCount = computed(
  () => timeline.value.filter((beat) => beat.repeatOf !== null).length,
);


const lastBeatSeconds = computed(() =>
  rows.value.length ? Math.max(...timeline.value.map((b) => b.seconds)) : 0,
);

const named = computed(() => name.value.trim().length > 0);

/**
 * Every complaint the execute has, in one list. Five separately-framed amber
 * paragraphs stacked under the timeline read as five alarms; one framed list
 * reads as a checklist, which is what it is.
 */
const notices = computed(() => {
  const out: Array<{ key: string; text: string }> = [];
  // The one complaint that actually blocks Save. The field is quiet until it
  // is hovered and its placeholder reads like a real name, so an empty one
  // looks filled in -- without this the button is simply dead and says nothing.
  if (!named.value) {
    out.push({
      key: "name",
      text: t("pages.utility.playbooks.name_required"),
    });
  }
  if (unresolvedSteps.value) {
    out.push({
      key: "unresolved",
      text: t("pages.utility.playbooks.unresolved", {
        count: unresolvedSteps.value,
      }),
    });
  }
  if (outOfOrderCount.value) {
    out.push({
      key: "order",
      text: t("pages.utility.playbooks.out_of_order", {
        count: outOfOrderCount.value,
      }),
    });
  }
  for (const entry of loadoutOverloads.value) {
    out.push({
      key: entry.key,
      text: entry.type
        ? t("pages.utility.playbooks.carry_over_type", {
            player: entry.name,
            count: entry.count,
            type: t(`pages.utility.types.${entry.type}`),
            limit: entry.limit,
          })
        : t("pages.utility.playbooks.carry_over_total", {
            player: entry.name,
            count: entry.count,
            limit: entry.limit,
          }),
    });
  }
  if (repeatCount.value) {
    out.push({
      key: "repeats",
      text: t("pages.utility.playbooks.repeats", { count: repeatCount.value }),
    });
  }
  return out;
});

// An instruction for something you have not done yet. Once a step has been
// picked the hint has been obeyed, so it stops taking a line forever.
const showBoardHint = computed(
  () => rowViews.value.length > 0 && !selectedKey.value,
);

const canSave = computed(() => !readOnly.value && named.value);

async function save() {
  if (!canSave.value) {
    return;
  }
  saving.value = true;
  try {
    const steps: UtilityPlaybookStepInput[] = rows.value.map((row) => ({
      utility_lineup_id: row.lineupId,
      offset_ms: parseUtilityOffset(row.offsetSeconds),
      assigned_steam_id:
        row.assignedSteamId === NO_ASSIGNEE ? null : row.assignedSteamId,
      note: row.note.trim() ? row.note.trim() : null,
    }));
    // The editor owns the whole step list, so it always sends one. Leaving
    // `steps` out of the variables is what preserves the stored order; an empty
    // array is a deliberate "clear the execute", never a shorthand for "no
    // change".
    const { data } = await getGraphqlClient().mutate({
      mutation: saveUtilityPlaybookMutation,
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
    const id = (data as any)?.saveUtilityPlaybook?.id;
    if (!id) {
      throw new Error("no playbook");
    }
    toast({ title: t("pages.utility.playbooks.saved") });
    emit("saved", id);
  } catch (error: any) {
    toast({
      title: t("pages.utility.playbooks.save_failed"),
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
      mutation: deleteUtilityPlaybookMutation,
      variables: { playbook_id: playbook.id },
    });
    emit("deleted", playbook.id);
  } catch (error: any) {
    toast({
      title: t("pages.utility.playbooks.delete_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}
</script>

<template>
  <!-- One column. The page keeps its map in the other one, and an editor that
       opens a second board inside a 400px rail collapses its own form to a
       few pixels wide -- which is what this used to do.

       space-y, not flex gap: a folding section can animate its own margin-top
       to nothing, but nothing can animate a flex container's gap, so a closing
       Fold would leave a 12px hole behind and snap it shut on unmount. -->
  <div class="space-y-3">
    <!-- Leaving, naming and deleting are three different weights of action, so
         they stop sharing a row of same-sized buttons. Back is chrome, delete
         is buried, and Save gets the whole footer to itself. -->
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="-ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        :aria-label="$t('pages.utility.playbooks.back')"
        :title="$t('pages.utility.playbooks.back')"
        @click="emit('cancel')"
      >
        <ChevronLeft class="h-4 w-4" />
      </button>
      <span
        class="min-w-0 truncate font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground"
      >
        {{
          playbook
            ? $t("pages.utility.playbooks.editing")
            : $t("pages.utility.playbooks.creating")
        }}
      </span>
      <DropdownMenu v-if="playbook && playbook.can_edit">
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            :aria-label="$t('common.more')"
          >
            <MoreHorizontal class="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuItem
            class="text-destructive focus:text-destructive"
            @click="confirmDelete = true"
          >
            <Trash2 class="mr-2 h-4 w-4" />
            {{ $t("common.delete") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- The name and the blurb are the execute's own words, so they are set
         like words. The field only draws itself when you go near it -- except
         while it is empty and blocking the save, when it has to draw itself
         whether you are near it or not. -->
    <div class="flex flex-col">
      <Input
        v-model="name"
        :disabled="readOnly"
        maxlength="120"
        class="h-8 px-1.5 text-sm font-semibold shadow-none"
        :class="
          named || readOnly
            ? 'tac-quiet-field'
            : 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.05)]'
        "
        :aria-invalid="!named && !readOnly"
        :placeholder="$t('pages.utility.playbooks.name_placeholder')"
      />
      <Textarea
        v-model="description"
        :disabled="readOnly"
        rows="2"
        maxlength="1000"
        class="tac-quiet-field resize-none px-1.5 py-1 text-xs leading-snug text-foreground/75 shadow-none"
        :placeholder="$t('pages.utility.playbooks.description_placeholder')"
      />
    </div>

    <div class="space-y-1.5">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <UtilitySegmented
          v-model="sideModel"
          :options="sideOptions"
          :disabled="readOnly"
        />
        <span aria-hidden="true" class="h-3.5 w-px shrink-0 bg-border" />
        <UtilitySegmented
          v-model="visibilityModel"
          :options="visibilityOptions"
          :disabled="readOnly"
        />
      </div>

      <!-- The team picker is only a question once the answer above it is
           "Team". Asked unconditionally it is a row of "None" on every
           private execute anyone ever writes. -->
      <Fold :open="visibility === 'Team'">
        <div class="pt-0.5">
          <Select v-model="teamId" :disabled="readOnly">
            <SelectTrigger class="tac-quiet-field h-7 text-xs shadow-none">
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
          <p
            v-if="teamId === NO_TEAM"
            class="mt-1 text-[0.65rem] leading-snug text-[hsl(var(--tac-amber))]"
          >
            {{ $t("pages.utility.playbooks.team_required") }}
          </p>
        </div>
      </Fold>
    </div>

    <!-- The step count, the run time and the unit all label the same column,
         so they share its row instead of stacking three thin ones. -->
    <div
      class="grid grid-cols-[3.1rem_0.9rem_minmax(0,1fr)] items-end gap-x-1.5 border-t border-border/60 pt-2.5"
    >
      <span
        class="pr-1 text-right font-mono text-[0.5rem] uppercase tracking-[0.16em] text-muted-foreground/60"
      >
        {{ rowViews.length ? $t("pages.utility.playbooks.seconds_label") : "" }}
      </span>
      <span />
      <div class="flex items-center justify-between gap-2">
        <span
          class="min-w-0 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {{
            $t("pages.utility.playbooks.steps_count", {
              count: rows.length,
              max: UTILITY_PLAYBOOK_MAX_STEPS,
            })
          }}
          <span v-if="lastBeatSeconds > 0" class="text-foreground/70">
            ·
            {{
              $t("pages.utility.playbooks.duration", {
                seconds: lastBeatSeconds.toFixed(1),
              })
            }}
          </span>
        </span>
        <Button
          v-if="!readOnly"
          size="sm"
          variant="outline"
          class="h-7 shrink-0 px-2 text-xs"
          :disabled="atStepLimit"
          @click="pickerOpen = true"
        >
          <Plus class="mr-1 h-3.5 w-3.5" />
          {{ $t("pages.utility.playbooks.add_step") }}
        </Button>
      </div>
    </div>

    <!-- Time runs down the gutter, because an execute is a clock: what a
         reader needs first is when a beat lands, not which index it holds.
         Repeated seconds print once, so four throws on one call read as one
         moment instead of four identical rows.

         Rows fold rather than pop: a step you just added should arrive where
         it belongs, and one you removed should take its space with it. The
         fold is why `move` behaves -- when the list changes the leaver has not
         shrunk yet, so FLIP measures no movement and stays out of the way,
         then the collapse carries the rows below it. -->
    <TransitionGroup
      v-if="rowViews.length"
      tag="ol"
      class="flex flex-col"
      name="step"
    >
      <li
        v-for="(beat, index) of timeline"
        :id="`utility-step-${beat.row.key}`"
        :key="beat.row.key"
        :draggable="!readOnly"
        class="step-row group"
        :class="dragIndex === index ? 'opacity-40' : ''"
        @dragstart="onDragStart(index, $event)"
        @dragenter="onDragEnter(index)"
        @dragover.prevent
        @drop.prevent="onDrop(index)"
        @dragend="onDragEnd"
        @mouseenter="hoveredKey = beat.row.key"
        @mouseleave="hoveredKey = null"
      >
        <!-- Bare cell: any padding or border here would floor the fold. -->
        <div class="min-h-0 overflow-hidden">
          <div
            class="grid grid-cols-[3.1rem_0.9rem_minmax(0,1fr)] items-start gap-x-1.5"
          >
            <div class="flex justify-end pt-0.5">
              <Input
                v-if="!readOnly"
                v-model="beat.row.offsetSeconds"
                type="number"
                :min="UTILITY_PLAYBOOK_MIN_OFFSET_SECONDS"
                max="600"
                :step="UTILITY_PLAYBOOK_OFFSET_STEP_SECONDS"
                class="tac-quiet-field h-6 w-full px-1 text-right font-mono text-[0.74rem] font-semibold tabular-nums shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                :class="
                  beat.outOfOrder
                    ? '!border-[hsl(var(--tac-amber)/0.6)] text-[hsl(var(--tac-amber))]'
                    : beat.showTime
                      ? ''
                      : 'text-muted-foreground/40'
                "
                :title="$t('pages.utility.playbooks.offset_hint')"
                @click.stop
              />
              <span
                v-else
                class="pt-0.5 font-mono text-[0.72rem] tabular-nums"
                :class="beat.showTime ? '' : 'text-muted-foreground/40'"
              >
                {{ beat.row.offsetSeconds }}s
              </span>
            </div>

            <!-- The rail is the sequence made visible; the dot carries the
                 type colour so the strip down the gutter is also the loadout. -->
            <div
              class="relative flex h-full self-stretch justify-center pt-[0.42rem]"
            >
              <button
                type="button"
                class="relative z-10 h-[11px] w-[11px] shrink-0 rounded-full ring-2 ring-background [transition:transform_180ms_cubic-bezier(0.16,1,0.3,1)]"
                :class="
                  selectedKey === beat.row.key
                    ? 'scale-[1.45]'
                    : 'hover:scale-125'
                "
                :style="{ backgroundColor: beat.color }"
                :aria-label="beat.lineup?.name ?? ''"
                @click.stop="
                  selectedKey =
                    selectedKey === beat.row.key ? null : beat.row.key
                "
              />
              <span
                v-if="index < timeline.length - 1"
                aria-hidden="true"
                class="absolute inset-x-0 -bottom-1 top-[1.05rem] mx-auto w-px bg-white/15"
              />
            </div>

            <div
              class="min-w-0 rounded-sm pb-3 transition-colors"
              :class="[
                selectedKey === beat.row.key
                  ? 'bg-[hsl(var(--tac-amber))]/[0.07]'
                  : hoveredKey === beat.row.key
                    ? 'bg-white/[0.025]'
                    : '',
                overIndex === index && dragIndex !== index && dragIndex !== null
                  ? 'shadow-[inset_0_2px_0_hsl(var(--tac-amber))]'
                  : '',
              ]"
            >
              <button
                type="button"
                class="block w-full min-w-0 px-1.5 text-left"
                @click="
                  selectedKey =
                    selectedKey === beat.row.key ? null : beat.row.key
                "
              >
                <span class="flex items-center gap-1.5">
                  <GripVertical
                    v-if="!readOnly"
                    class="-ml-1 h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/25 transition-colors group-hover:text-muted-foreground/60 active:cursor-grabbing"
                  />
                  <span
                    v-if="beat.lineup"
                    class="truncate text-[0.8rem] font-semibold leading-tight"
                  >
                    {{ beat.lineup.name }}
                  </span>
                  <span
                    v-else-if="lineupsLoading"
                    aria-hidden="true"
                    class="inline-block h-3 w-28 animate-pulse rounded-md bg-primary/10"
                  />
                  <span
                    v-else
                    class="truncate text-[0.8rem] font-semibold leading-tight text-muted-foreground"
                  >
                    {{ $t("pages.utility.playbooks.unknown_lineup") }}
                  </span>
                </span>

                <span
                  v-if="beat.lineup"
                  class="mt-0.5 block truncate font-mono text-[0.57rem] uppercase tracking-[0.13em] text-muted-foreground"
                >
                  {{ $t(beat.typeKey) }} · {{ $t(beat.techniqueKey) }}
                  <!-- Named, not scolded: throwing the same smoke twice is a
                       re-smoke, and the only thing the row owes you is which
                       step you already spent it on. -->
                  <span v-if="beat.repeatOf" class="text-[hsl(var(--tac-amber))]">
                    ·
                    {{
                      $t("pages.utility.playbooks.repeat_of", {
                        step: beat.repeatOf,
                      })
                    }}
                  </span>
                </span>

                <!-- Collapsed, the call and the caller are read, not edited. -->
                <span
                  v-if="
                    selectedKey !== beat.row.key &&
                    (beat.row.note ||
                      beat.row.assignedSteamId !== NO_ASSIGNEE)
                  "
                  class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1"
                >
                  <span
                    v-if="beat.row.assignedSteamId !== NO_ASSIGNEE"
                    class="inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-px font-mono text-[0.55rem] uppercase tracking-[0.1em]"
                    :class="
                      beat.overloaded
                        ? 'border-[hsl(var(--tac-amber)/0.55)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                        : 'border-border text-muted-foreground'
                    "
                  >
                    <User class="h-2.5 w-2.5 shrink-0" />
                    <span class="truncate">
                      {{
                        rosterBySteamId[beat.row.assignedSteamId]?.name ??
                        beat.row.assignedSteamId
                      }}
                    </span>
                  </span>
                  <span
                    v-if="beat.row.note"
                    class="truncate text-[0.68rem] italic text-muted-foreground"
                  >
                    “{{ beat.row.note }}”
                  </span>
                </span>

                <span
                  v-else-if="selectedKey === beat.row.key && readOnly && beat.row.note"
                  class="mt-1 block text-[0.68rem] italic text-muted-foreground"
                >
                  “{{ beat.row.note }}”
                </span>
              </button>

              <!-- Expanded is where a step is edited, so eight collapsed rows
                   stay a list you can read down instead of eight rows of form.
                   A sibling of the header rather than a child of it: form
                   controls inside a <button> are invalid, and the fold needs a
                   block it is allowed to own. -->
              <Fold :open="selectedKey === beat.row.key && !readOnly">
                <div class="flex flex-col gap-1.5 px-1.5 pt-2">
                  <Select
                    v-if="roster.length"
                    v-model="beat.row.assignedSteamId"
                  >
                    <SelectTrigger class="h-7 w-full text-xs" @click.stop>
                      <SelectValue
                        :placeholder="$t('pages.utility.playbooks.unassigned')"
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem :value="NO_ASSIGNEE">
                        {{ $t("pages.utility.playbooks.unassigned") }}
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

                  <!-- Asked where the question comes up, not as a standing
                       note under the whole editor. -->
                  <p
                    v-else
                    class="text-[0.62rem] leading-snug text-muted-foreground"
                  >
                    {{
                      teamId === NO_TEAM
                        ? $t("pages.utility.playbooks.assign_needs_team")
                        : $t("pages.utility.playbooks.no_roster")
                    }}
                  </p>

                  <Badge
                    v-if="
                      beat.row.assignedSteamId !== NO_ASSIGNEE &&
                      !rosterBySteamId[beat.row.assignedSteamId]
                    "
                    variant="outline"
                    class="w-fit font-mono text-[0.58rem]"
                  >
                    {{ beat.row.assignedSteamId }}
                  </Badge>

                  <Input
                    v-model="beat.row.note"
                    maxlength="160"
                    class="h-7 w-full text-xs"
                    :placeholder="$t('pages.utility.playbooks.note_placeholder')"
                    @click.stop
                  />

                  <div class="flex items-center gap-1 pt-0.5">
                    <button
                      type="button"
                      class="flex h-6 w-6 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25"
                      :disabled="index === 0"
                      :aria-label="$t('pages.utility.playbooks.move_up')"
                      @click.stop="move(index, -1)"
                    >
                      <ChevronUp class="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      class="flex h-6 w-6 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25"
                      :disabled="index === rows.length - 1"
                      :aria-label="$t('pages.utility.playbooks.move_down')"
                      @click.stop="move(index, 1)"
                    >
                      <ChevronDown class="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      class="ml-auto flex h-6 items-center gap-1 rounded-sm px-1.5 font-mono text-[0.58rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-destructive"
                      @click.stop="removeRow(beat.row.key)"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                      {{ $t("common.remove") }}
                    </button>
                  </div>
                </div>
              </Fold>
            </div>
          </div>
        </div>
      </li>
    </TransitionGroup>

    <p
      v-else
      class="rounded-sm border border-dashed border-border/60 px-3 py-4 text-center text-xs leading-relaxed text-muted-foreground"
    >
      {{ $t("pages.utility.playbooks.no_steps") }}
    </p>

    <Fold :open="showBoardHint">
      <p
        class="flex items-start gap-1.5 text-[0.68rem] leading-snug text-muted-foreground"
      >
        <MapPin class="mt-px h-3 w-3 shrink-0" />
        {{ $t("pages.utility.playbooks.board_hint") }}
      </p>
    </Fold>

    <!-- One frame, one list. Five separately-boxed amber paragraphs read as
         five alarms; this reads as the checklist it is. -->
    <Fold :open="notices.length > 0">
      <div
        class="-mt-1 rounded-sm border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.09)] px-2 py-1.5"
      >
        <!-- Each line folds, and the gap between lines rides inside the clip
             (-mt on the list, pt inside each cell) -- a flex gap left outside
             would be the one pixel that snaps. -->
        <TransitionGroup name="notice">
          <div
            v-for="notice of notices"
            :key="notice.key"
            class="notice-row"
          >
            <div class="min-h-0 overflow-hidden">
              <p
                class="flex items-start gap-1.5 pt-1 text-[0.65rem] leading-snug text-[hsl(var(--tac-amber))]"
              >
                <TriangleAlert class="mt-px h-3 w-3 shrink-0" />
                <span class="min-w-0">{{ notice.text }}</span>
              </p>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </Fold>

    <!-- Coverage is asked of the stored playbook, so there is nothing to ask
         about until one exists. -->
    <UtilityPlaybookCoveragePanel
      v-if="playbook?.id"
      :playbook-id="playbook.id"
      :steps="steps"
      :lineups-by-id="lineupsById"
      @board="(state) => (coverageBoard = state)"
    />

    <!-- A long execute pushes Save off the bottom of a tall rail, so it stays
         where it can be reached -- and it is the only thing down here, because
         back and delete are not the same size of decision. -->
    <div
      v-if="!readOnly"
      class="sticky bottom-0 z-10 -mx-1 border-t border-border/60 bg-background px-1 pb-1 pt-2"
    >
      <Button
        class="tac-amber-cta w-full"
        :loading="saving"
        :disabled="!canSave"
        @click="save()"
      >
        <Save class="mr-1.5 h-4 w-4" />
        {{ $t("common.save") }}
      </Button>
    </div>

    <UtilityLineupPickerDialog
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
            {{ $t("pages.utility.playbooks.confirm_delete") }}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {{ $t("pages.utility.playbooks.confirm_delete_description") }}
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

<style scoped>
/* The row is its own fold: one grid row that tweens 1fr <-> 0fr. Declared here
   rather than as Tailwind classes so the enter/leave overrides land later in
   the same stylesheet and win on order instead of on !important. */
.step-row {
  display: grid;
  grid-template-rows: 1fr;
}
.step-enter-active {
  transition:
    grid-template-rows 240ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 200ms ease-out;
}
.step-leave-active {
  transition:
    grid-template-rows 200ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 110ms ease-in;
}
.step-enter-from,
.step-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
/* Reordering is the one change FLIP can measure honestly, and the only one
   this needs to animate. */
.step-move {
  transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.notice-row {
  display: grid;
  grid-template-rows: 1fr;
}
.notice-enter-active,
.notice-leave-active {
  transition:
    grid-template-rows 200ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 160ms ease;
}
.notice-enter-from,
.notice-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .step-enter-active,
  .step-leave-active,
  .step-move,
  .notice-enter-active,
  .notice-leave-active,
  .notice-move {
    transition-duration: 1ms;
  }
}
</style>
