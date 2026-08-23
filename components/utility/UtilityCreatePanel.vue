<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import UtilityPracticeButton from "~/components/utility/UtilityPracticeButton.vue";
import { Check, Crosshair, MapPin, Save, Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "~/components/ui/toast";
import UtilityTypeChips from "~/components/utility/UtilityTypeChips.vue";
import UtilitySegmented from "~/components/utility/UtilitySegmented.vue";
import UtilityConfidenceNote from "~/components/utility/UtilityConfidenceNote.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  createUtilityLineupMutation,
  utilityLineupsQuery,
} from "~/graphql/utilityGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import {
  UTILITY_EYE_HEIGHT_UNITS,
  UTILITY_SIDES,
  UTILITY_TECHNIQUES,
  UTILITY_THROW_STRENGTHS,
  UTILITY_AIM_PRECISIONS,
  aimPrecisionDegrees,
  type UtilityAimPrecision,
  UTILITY_TYPE_COLORS,
  utilityThrowButtonsKey,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBoardMarker,
  UtilityBoardSegment,
  UtilityMetaSpot,
} from "~/utilities/utilityDisplay";
import type {
  UtilityLineup,
  UtilitySide,
  UtilitySightlinePoint,
  UtilityTechnique,
  UtilityThrowStrength,
  UtilityType,
  UtilityVisibility,
} from "~/types/utility";

const props = defineProps<{
  mapName: string;
  // A mined cluster the author is writing up. Its aim is a median of what
  // people actually threw, which is a far better starting point than the
  // straight eye-to-target line the editor derives from two picks.
  seed?: UtilityMetaSpot | null;
}>();

const emit = defineEmits<{
  (event: "created", id: string): void;
  (event: "board", state: {
    picking: boolean;
    pickZ: number;
    markers: UtilityBoardMarker[];
    segments: UtilityBoardSegment[];
    onPick: (point: UtilitySightlinePoint) => void;
  }): void;
}>();

const { t } = useI18n();


// Reka Select rejects an empty-string value, so "unset" rides a sentinel.
const NO_TEAM = "none";

const VISIBILITIES: UtilityVisibility[] = ["Private", "Team", "Public"];

const auth = useAuthStore();
const myTeams = computed(
  () =>
    (auth.me?.teams ?? []) as Array<{
      id: string;
      name: string;
      short_name?: string | null;
    }>,
);

const origin = ref<UtilitySightlinePoint | null>(null);
const landing = ref<UtilitySightlinePoint | null>(null);
const pickMode = ref<"origin" | "landing">("origin");

// One height per end, because a radar pixel carries none of its own: the throw
// is read at the floor the player stands on, the landing at whatever the utility
// comes to rest on. On Nuke and Vertigo the same number also picks the level,
// which is why the point has to be re-picked after the height changes rather
// than edited in place — the world X/Y were unprojected through the old level's
// offset and mean nothing under the new one.
const originHeightInput = ref("0");
const landingHeightInput = ref("0");

const types = ref<UtilityType[]>(["Smoke"]);
const side = ref<UtilitySide>("TERRORIST");
const technique = ref<UtilityTechnique>("Stationary");
const throwStrength = ref<UtilityThrowStrength>("Full");
const aimPrecision = ref<UtilityAimPrecision>("tight");
const name = ref("");
const description = ref("");
const tagsInput = ref("");
const visibility = ref<UtilityVisibility>("Private");
const teamId = ref<string>(NO_TEAM);

const yawInput = ref("");
const pitchInput = ref("");
const anglesTouched = ref(false);

const saving = ref(false);

const utilityType = computed<UtilityType>(() => types.value[0] ?? "Smoke");

const typeColor = computed(
  () => UTILITY_TYPE_COLORS[utilityType.value] ?? "#ffffff",
);

const originHeight = computed(() => {
  const value = Number(originHeightInput.value);
  return Number.isFinite(value) ? value : 0;
});

const landingHeight = computed(() => {
  const value = Number(landingHeightInput.value);
  return Number.isFinite(value) ? value : 0;
});

const pickHeight = computed(() =>
  pickMode.value === "origin" ? originHeight.value : landingHeight.value,
);

/**
 * A radar pixel carries no height, and the map's own lineups know better than a
 * constant what the ground is worth here — right on Mirage, wrong on Nuke. Same
 * seed the block page uses.
 */
async function seedHeights() {
  try {
    const { data } = await getGraphqlClient().query({
      query: utilityLineupsQuery,
      variables: {
        where: {
          map_name: { _eq: props.mapName },
          can_view: { _eq: true },
        },
        order_by: [{ upvotes: order_by.desc }],
        limit: 60,
        offset: 0,
      },
      fetchPolicy: "cache-first",
    });
    const rows = ((data as any)?.utility_lineups ?? []) as UtilityLineup[];
    const grounds = rows
      .map((lineup) => Number(lineup.origin_z))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    if (!grounds.length) {
      return;
    }
    const median = Math.round(grounds[Math.floor(grounds.length / 2)]);
    originHeightInput.value = String(median);
    landingHeightInput.value = String(median);
  } catch (error) {
    console.error("[utility] author height seed error:", error);
  }
}

watch(() => props.mapName, () => void seedHeights(), { immediate: true });

/**
 * The straight line from the eye to the landing spot — which is NOT the throw
 * angle. A grenade arcs, so the real crosshair always sits higher than this.
 * It is a seed the author corrects by walking the lineup in, and it is exactly
 * why an authored lineup can never claim to be exact.
 */
const derivedAngles = computed(() => {
  if (!origin.value || !landing.value) {
    return null;
  }
  const dx = landing.value.x - origin.value.x;
  const dy = landing.value.y - origin.value.y;
  const dz = landing.value.z - (origin.value.z + UTILITY_EYE_HEIGHT_UNITS);
  const flat = Math.sqrt(dx * dx + dy * dy);
  return {
    // CS2 pitch is negative looking up.
    yaw: (Math.atan2(dy, dx) * 180) / Math.PI,
    pitch: flat === 0 ? 0 : -((Math.atan2(dz, flat) * 180) / Math.PI),
  };
});

function applyDerivedAngles() {
  const derived = derivedAngles.value;
  if (!derived) {
    return;
  }
  yawInput.value = derived.yaw.toFixed(1);
  pitchInput.value = derived.pitch.toFixed(1);
  anglesTouched.value = false;
}

watch(derivedAngles, () => {
  if (!anglesTouched.value) {
    applyDerivedAngles();
  }
});

const yaw = computed(() => {
  const value = Number(yawInput.value);
  return Number.isFinite(value) ? value : 0;
});

const pitch = computed(() => {
  const value = Number(pitchInput.value);
  return Number.isFinite(value) ? value : 0;
});

function onPick(point: UtilitySightlinePoint) {
  if (pickMode.value === "origin") {
    origin.value = point;
    pickMode.value = "landing";
    return;
  }
  landing.value = point;
}

function clearPoints() {
  origin.value = null;
  landing.value = null;
  pickMode.value = "origin";
  yawInput.value = "";
  pitchInput.value = "";
  anglesTouched.value = false;
}

const markers = computed<UtilityBoardMarker[]>(() => {
  const out: UtilityBoardMarker[] = [];
  if (origin.value) {
    out.push({
      key: "origin",
      point: origin.value,
      color: "#e6ebf5",
      shape: "cross" as const,
      label: t("pages.utility.create.origin_short"),
    });
  }
  if (landing.value) {
    out.push({
      key: "landing",
      point: landing.value,
      color: typeColor.value,
      label: t("pages.utility.create.landing_short"),
    });
  }
  return out;
});

const segments = computed<UtilityBoardSegment[]>(() => {
  if (!origin.value || !landing.value) {
    return [];
  }
  return [
    {
      key: "throw",
      from: origin.value,
      to: landing.value,
      color: typeColor.value,
      dashed: true,
    },
  ];
});

const tags = computed(() =>
  tagsInput.value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0),
);

/**
 * What the saved lineup will read as in the library. The server grades it — the
 * insert cannot set `confidence` — so this previews the floor rather than a
 * promise: a hand-placed lineup has no measured physics behind it.
 */
const confidencePreview = {
  confidence: "low" as const,
  origin_source: "editor" as const,
  verified_at: null,
  view_yaw_delta: null,
  view_pitch_delta: null,
};

const canSave = computed(
  () => !!origin.value && !!landing.value && name.value.trim().length > 0,
);

/**
 * Three steps because that is what authoring one actually is: you place it, you
 * say what it is, then you say how it is thrown. It used to be one wall of
 * twelve fields with the save button below the fold.
 */
const STEPS = ["place", "describe", "throw"] as const;
type Step = (typeof STEPS)[number];

const step = ref<Step>("place");

const placed = computed(() => !!origin.value && !!landing.value);
const named = computed(() => name.value.trim().length > 0);
const hasAim = computed(
  () => yawInput.value.trim().length > 0 && pitchInput.value.trim().length > 0,
);

const stepState = computed(() => ({
  place: {
    done: placed.value,
    note: placed.value
      ? t("pages.utility.create.step_place_done")
      : origin.value
        ? t("pages.utility.create.step_place_half")
        : t("pages.utility.create.step_place_todo"),
  },
  describe: {
    done: named.value,
    note: named.value
      ? t("pages.utility.create.step_describe_done")
      : t("pages.utility.create.step_describe_todo"),
  },
  throw: {
    // Nothing here blocks a save -- every field has a working default -- but a
    // tick beside "no aim yet" claims the opposite of the note under it.
    done: hasAim.value,
    note: hasAim.value
      ? t("pages.utility.create.step_throw_aimed")
      : t("pages.utility.create.step_throw_todo"),
  },
}));

// Placing both ends is the one step with a natural end, so it hands over on its
// own rather than making you find the next tab after every pick.
watch(placed, (value, was) => {
  if (value && !was && step.value === "place") {
    step.value = "describe";
  }
});

// Seeding from a mined cluster arrives with both ends and the aim already
// filled, so the only thing left to do is name it.
watch(
  () => props.seed,
  (spot) => {
    if (spot) {
      step.value = "describe";
    }
  },
);

// The warning is about a lineup, and there is no lineup until an origin exists.
// Firing it at an empty form taught people to read past it.
const showConfidence = computed(() => !!origin.value);

// What "test in game" sends: the form as it stands, whether or not it is
// complete enough to save. Null until there is an origin, because a throw with
// nowhere to stand is not one anybody can try.
const draft = computed(() =>
  origin.value
    ? {
        map_name: props.mapName,
        utility_type: utilityType.value,
        side: side.value,
        technique: technique.value,
        throw_strength: throwStrength.value,
        origin: origin.value,
        landing: landing.value,
        view_yaw: yaw.value,
        view_pitch: pitch.value,
      }
    : null,
);

async function save() {
  const start = origin.value;
  const end = landing.value;
  if (!canSave.value || !start || !end) {
    return;
  }
  saving.value = true;
  try {
    // No flight_time_ms and no trajectory_preview: both describe a grenade that
    // was actually thrown. Writing a straight line between the two picks as a
    // "trajectory" would draw a flight that never happened, and the board
    // already falls back to a dashed origin-to-landing line without one.
    const object: Record<string, unknown> = {
      map_name: props.mapName,
      utility_type: utilityType.value,
      side: side.value,
      technique: technique.value,
      throw_strength: throwStrength.value,
      aim_tolerance: aimPrecisionDegrees(aimPrecision.value),
      origin_x: start.x,
      origin_y: start.y,
      origin_z: start.z,
      eye_z: start.z + UTILITY_EYE_HEIGHT_UNITS,
      view_yaw: yaw.value,
      view_pitch: pitch.value,
      land_x: end.x,
      land_y: end.y,
      land_z: end.z,
      name: name.value.trim(),
      description: description.value.trim() || null,
      // tags is text[] NOT NULL DEFAULT '{}'. Sending null coerces to [null]
      // against [String!] and the insert is rejected before it reaches the
      // column, so an empty tag box has to send an empty list.
      tags: tags.value,
      visibility: visibility.value,
      team_id: teamId.value === NO_TEAM ? null : teamId.value,
    };
    const { data } = await getGraphqlClient().mutate({
      mutation: createUtilityLineupMutation,
      variables: { object },
    });
    const id = (data as any)?.insert_utility_lineups_one?.id;
    if (!id) {
      throw new Error("no lineup");
    }
    toast({ title: t("pages.utility.create.saved") });
    emit("created", id);
    reset();
  } catch (error: any) {
    // Hasura names the offending type but not the field, which is useless on
    // an insert with twenty of them. The path is in the GraphQL error.
    const detail = error?.graphQLErrors?.[0];
    const where = detail?.extensions?.path ?? detail?.path?.join(".");

    console.error("[utility] save error:", detail ?? error);

    toast({
      title: t("pages.utility.create.save_failed"),
      description: where ? `${error?.message} (${where})` : error?.message,
      variant: "destructive",
    });
  } finally {
    saving.value = false;
  }
}

function coordinate(point: UtilitySightlinePoint | null) {
  if (!point) {
    return "";
  }
  return `${Math.round(point.x)}, ${Math.round(point.y)}, ${Math.round(point.z)}`;
}

// Applied as a starting point, not a lock: every field stays editable, and the
// aim is the cluster's own median rather than the two-pick derivation.
function applySeed(spot: UtilityMetaSpot | null | undefined) {
  if (!spot) {
    return;
  }
  origin.value = { ...spot.origin };
  landing.value = spot.landing ? { ...spot.landing } : null;
  pickMode.value = spot.landing ? "landing" : "origin";
  originHeightInput.value = String(Math.round(Number(spot.origin.z)));
  if (spot.landing) {
    landingHeightInput.value = String(Math.round(Number(spot.landing.z)));
  }
  types.value = [spot.utilityType];
  if (spot.side) {
    side.value = spot.side;
  }
  if (spot.technique) {
    technique.value = spot.technique;
  }
  if (spot.throwStrength) {
    throwStrength.value = spot.throwStrength;
  }
  if (spot.viewYaw !== null || spot.viewPitch !== null) {
    yawInput.value = Number(spot.viewYaw ?? 0).toFixed(1);
    pitchInput.value = Number(spot.viewPitch ?? 0).toFixed(1);
    anglesTouched.value = true;
  }
}

watch(() => props.seed, applySeed, { immediate: true });

function reset() {
  clearPoints();
  name.value = "";
  description.value = "";
  tagsInput.value = "";
  step.value = "place";
}

// The board belongs to the page, so the panel publishes what it should draw
// rather than owning a second copy of it.
watch(
  [pickHeight, markers, segments],
  () => {
    emit("board", {
      picking: true,
      pickZ: pickHeight.value,
      markers: markers.value,
      segments: segments.value,
      onPick,
    });
  },
  { immediate: true },
);

</script>


<template>
  <div class="flex flex-col gap-3">
    <!-- Where you are, and what is still missing. The panel used to be one
         scroll with the save button below the fold and no way to tell how far
         through it you were. -->
    <div class="grid grid-cols-3 overflow-hidden rounded-md border border-border">
      <button
        v-for="(key, index) of STEPS"
        :key="key"
        type="button"
        class="flex flex-col items-center gap-0.5 px-2 py-1.5 text-center transition-colors"
        :class="[
          index > 0 ? 'border-l border-border' : '',
          step === key
            ? 'bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] shadow-[inset_0_-2px_0_hsl(var(--tac-amber))]'
            : 'text-muted-foreground hover:bg-muted/40',
        ]"
        @click="step = key"
      >
        <span
          class="flex items-center gap-1 font-mono text-[0.6rem] uppercase tracking-[0.14em]"
        >
          <Check
            v-if="stepState[key].done && step !== key"
            class="h-3 w-3 text-success"
          />
          {{ $t(`pages.utility.create.step_${key}`) }}
        </span>
        <span class="font-mono text-[0.55rem] tabular-nums opacity-70">
          {{ stepState[key].note }}
        </span>
      </button>
    </div>

    <!-- ============================ PLACE ============================ -->
    <template v-if="step === 'place'">
      <!-- Both ends still to come: the board is the input, so the panel says
           what to do on it and gets out of the way. Only the height matters
           here, and only because it has to be right before the click. -->
      <template v-if="!placed">
        <p class="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Crosshair class="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--tac-amber))]" />
          {{
            pickMode === "origin"
              ? $t("pages.utility.create.pick_origin_hint")
              : $t("pages.utility.create.pick_landing_hint")
          }}
        </p>

        <div class="flex flex-col gap-2 rounded-md border border-border p-2.5">
          <div
            class="flex items-center justify-between gap-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
          >
            {{ $t("pages.utility.create.ground_height") }}
            <span
              class="cursor-help border-b border-dotted border-muted-foreground/60"
              :title="$t('pages.utility.create.height_hint')"
            >
              {{ $t("pages.utility.create.height_why") }}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span
                class="font-mono text-[0.55rem] uppercase tracking-[0.14em]"
                :class="
                  pickMode === 'origin'
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
              >
                {{ $t("pages.utility.create.origin_height") }}
              </span>
              <Input
                v-model="originHeightInput"
                type="number"
                class="h-7 font-mono text-xs tabular-nums"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span
                class="font-mono text-[0.55rem] uppercase tracking-[0.14em]"
                :class="
                  pickMode === 'landing'
                    ? 'text-[hsl(var(--tac-amber))]'
                    : 'text-muted-foreground'
                "
              >
                {{ $t("pages.utility.create.landing_height") }}
              </span>
              <Input
                v-model="landingHeightInput"
                type="number"
                class="h-7 font-mono text-xs tabular-nums"
              />
            </label>
          </div>
        </div>
      </template>

      <!-- Placed. Two coordinates on one line, because that is all there is to
           say about it, and a way to take it back. -->
      <div
        v-else
        class="flex flex-col gap-2 rounded-md border border-[hsl(var(--tac-amber)/0.4)] bg-[hsl(var(--tac-amber)/0.05)] p-2.5"
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))]"
          >
            <MapPin class="h-3 w-3" />
            {{ $t("pages.utility.create.placed") }}
          </span>
          <Button
            size="sm"
            variant="ghost"
            class="h-6 px-2 text-[0.6rem]"
            @click="clearPoints()"
          >
            <Trash2 class="mr-1 h-3 w-3" />
            {{ $t("pages.utility.create.clear_points") }}
          </Button>
        </div>

        <div
          class="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.62rem] tabular-nums"
        >
          <button
            type="button"
            class="text-left transition-colors hover:text-[hsl(var(--tac-amber))]"
            :title="$t('pages.utility.create.repick')"
            @click="pickMode = 'origin'"
          >
            <span class="text-muted-foreground">
              {{ $t("pages.utility.create.origin_short") }}
            </span>
            {{ coordinate(origin) }}
          </button>
          <span :style="{ color: typeColor }">&rarr;</span>
          <button
            type="button"
            class="text-left transition-colors hover:text-[hsl(var(--tac-amber))]"
            :title="$t('pages.utility.create.repick')"
            @click="pickMode = 'landing'"
          >
            <span class="text-muted-foreground">
              {{ $t("pages.utility.create.landing_short") }}
            </span>
            {{ coordinate(landing) }}
          </button>
        </div>

        <p
          class="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground"
        >
          <span
            class="cursor-help border-b border-dotted border-muted-foreground/60"
            :title="$t('pages.utility.create.height_hint')"
          >
            {{ $t("pages.utility.create.repick_note") }}
          </span>
        </p>
      </div>
    </template>

    <!-- =========================== DESCRIBE =========================== -->
    <template v-else-if="step === 'describe'">
      <div class="flex flex-col gap-1">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("common.name") }}
        </label>
        <Input
          v-model="name"
          maxlength="120"
          :placeholder="$t('pages.utility.create.name_placeholder')"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.create.utility") }}
        </label>
        <div class="flex flex-wrap gap-1.5">
          <UtilityTypeChips v-model="types" single />
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("common.description") }}
        </label>
        <Textarea
          v-model="description"
          rows="2"
          maxlength="1000"
          :placeholder="$t('pages.utility.create.description_placeholder')"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.filters.tags") }}
        </label>
        <Input
          v-model="tagsInput"
          maxlength="160"
          :placeholder="$t('pages.utility.create.tags_placeholder')"
        />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div class="flex min-w-0 flex-col gap-1">
          <label
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.utility.playbooks.visibility") }}
          </label>
          <Select v-model="visibility">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="entry of VISIBILITIES"
                :key="entry"
                :value="entry"
              >
                {{ $t(`pages.utility.visibility.${entry}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex min-w-0 flex-col gap-1">
          <label
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.utility.playbooks.team") }}
          </label>
          <Select v-model="teamId">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="NO_TEAM">{{ $t("common.none") }}</SelectItem>
              <SelectItem v-for="team of myTeams" :key="team.id" :value="team.id">
                {{ team.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p
        v-if="visibility === 'Team' && teamId === NO_TEAM"
        class="text-[0.65rem] text-[hsl(var(--tac-amber))]"
      >
        {{ $t("pages.utility.playbooks.team_required") }}
      </p>
    </template>

    <!-- ============================ THROW ============================ -->
    <template v-else>
      <div class="flex flex-col gap-1">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.filters.side") }}
        </label>
        <UtilitySegmented
          v-model="side"
          even
          :options="
            UTILITY_SIDES.map((entry) => ({
              key: entry,
              label: $t(`pages.utility.sides.${entry}`),
            }))
          "
        />
      </div>

      <div class="flex flex-col gap-1">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.filters.technique") }}
        </label>
        <UtilitySegmented
          v-model="technique"
          :options="
            UTILITY_TECHNIQUES.map((entry) => ({
              key: entry,
              label: $t(`pages.utility.techniques.${entry}`),
            }))
          "
        />
      </div>

      <div class="flex flex-col gap-1">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.filters.throw_strength") }}
        </label>
        <!-- Named by the buttons you press. "Half" is a strength you have to
             translate; "left + right click" is the thing you actually do. -->
        <UtilitySegmented
          v-model="throwStrength"
          even
          :options="
            UTILITY_THROW_STRENGTHS.map((entry) => ({
              key: entry,
              label: $t(
                `pages.utility.throw_buttons.${utilityThrowButtonsKey(entry)}`,
              ),
            }))
          "
        />
      </div>

      <div class="flex flex-col gap-1">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.create.precision") }}
        </label>
        <UtilitySegmented
          v-model="aimPrecision"
          even
          :options="
            UTILITY_AIM_PRECISIONS.map((entry) => ({
              key: entry.key,
              label: $t(`pages.utility.precisions.${entry.key}`),
            }))
          "
        />
        <span class="text-[0.6rem] leading-tight text-muted-foreground">
          {{ $t("pages.utility.create.precision_hint") }}
        </span>
      </div>

      <div class="flex flex-col gap-1">
        <label
          class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.create.aim") }}
        </label>
        <div class="flex items-center gap-2">
          <Input
            v-model="yawInput"
            type="number"
            step="0.1"
            class="h-8 min-w-0 flex-1 font-mono text-xs tabular-nums"
            :placeholder="$t('pages.utility.create.yaw')"
            @input="anglesTouched = true"
          />
          <Input
            v-model="pitchInput"
            type="number"
            step="0.1"
            class="h-8 min-w-0 flex-1 font-mono text-xs tabular-nums"
            :placeholder="$t('pages.utility.create.pitch')"
            @input="anglesTouched = true"
          />
          <Button
            size="sm"
            variant="outline"
            class="h-8 shrink-0"
            :disabled="!derivedAngles"
            @click="applyDerivedAngles()"
          >
            {{ $t("pages.utility.create.reset_aim") }}
          </Button>
        </div>
        <p class="text-[0.65rem] leading-snug text-muted-foreground">
          {{ $t("pages.utility.create.aim_hint") }}
        </p>
      </div>

      <!-- Held back until an origin exists. An empty form is not low-confidence,
           it is empty, and a warning about nothing is a warning you learn to
           read past. -->
      <template v-if="showConfidence">
        <UtilityConfidenceNote :lineup="confidencePreview" />
        <p class="text-[0.7rem] leading-snug text-muted-foreground">
          {{ $t("pages.utility.create.confidence_caption") }}
        </p>
      </template>
    </template>

    <!-- The save is always reachable and always says what is missing, instead
         of a disabled button below the fold with a sentence beside it. -->
    <div
      class="sticky bottom-0 -mx-1 mt-1 flex items-center gap-2 rounded-md border px-2.5 py-2 [backdrop-filter:blur(10px)]"
      :class="
        canSave
          ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.08)]'
          : 'border-border bg-background/85'
      "
    >
      <span
        class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground"
      >
        <button
          type="button"
          class="transition-colors hover:text-foreground"
          :class="placed ? 'text-success' : ''"
          @click="step = 'place'"
        >
          {{ $t("pages.utility.create.check_placed") }}
          {{ placed ? "✓" : "—" }}
        </button>
        <button
          type="button"
          class="transition-colors hover:text-foreground"
          :class="named ? 'text-success' : ''"
          @click="step = 'describe'"
        >
          {{ $t("pages.utility.create.check_named") }}
          {{ named ? "✓" : "—" }}
        </button>
        <button
          type="button"
          class="transition-colors hover:text-foreground"
          :class="hasAim ? 'text-success' : ''"
          @click="step = 'throw'"
        >
          {{ $t("pages.utility.create.check_aim") }}
          {{ hasAim ? "✓" : "—" }}
        </button>
      </span>

      <!-- Grouped so Save keeps the right edge whether or not there is a
           server to test on -- the practice button hides itself. -->
      <div class="ml-auto flex shrink-0 items-center gap-2">
        <UtilityPracticeButton
          :draft="draft"
          :name="name.trim() || undefined"
          :label="$t('pages.utility.load.test')"
          variant="outline"
        />

        <Button
          class="tac-amber-cta"
          size="sm"
          :loading="saving"
          :disabled="!canSave"
          @click="save()"
        >
          <Save class="mr-1 h-3.5 w-3.5" />
          {{ $t("pages.utility.create.save") }}
        </Button>
      </div>
    </div>
  </div>
</template>
