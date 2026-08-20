<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Crosshair, Save, Trash2 } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toast } from "~/components/ui/toast";
import UtilityTypeChips from "~/components/utility/UtilityTypeChips.vue";
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
  UTILITY_TYPE_COLORS,
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
const jumpThrowBind = ref(false);
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
      jump_throw_bind: jumpThrowBind.value,
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
      tags: tags.value.length ? tags.value : null,
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
    toast({
      title: t("pages.utility.create.save_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    saving.value = false;
  }
}

function coordinate(point: UtilitySightlinePoint) {
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
  <p class="flex items-start gap-1.5 text-xs text-muted-foreground">
    <Crosshair class="mt-0.5 h-3.5 w-3.5 shrink-0" />
    {{
      pickMode === "origin"
        ? $t("pages.utility.create.pick_origin_hint")
        : $t("pages.utility.create.pick_landing_hint")
    }}
  </p>

  <div class="grid gap-2">
    <div
      class="rounded-sm border border-border bg-card/40 p-2 [backdrop-filter:blur(6px)]"
    >
      <div
        class="flex items-center justify-between gap-2 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.utility.create.origin") }}
        <Button
          size="sm"
          variant="ghost"
          class="h-6 px-2 text-[0.6rem]"
          :class="pickMode === 'origin' ? 'text-[hsl(var(--tac-amber))]' : ''"
          @click="pickMode = 'origin'"
        >
          {{ $t("pages.utility.create.repick") }}
        </Button>
      </div>
      <div class="mt-1 font-mono text-[0.65rem] tabular-nums">
        {{
          origin
            ? coordinate(origin)
            : $t("pages.utility.create.not_placed")
        }}
      </div>
      <label
        class="mt-2 flex items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{ $t("pages.utility.create.origin_height") }}
        <Input
          v-model="originHeightInput"
          type="number"
          class="h-7 w-20 text-xs"
        />
      </label>
    </div>

    <div
      class="rounded-sm border border-border bg-card/40 p-2 [backdrop-filter:blur(6px)]"
    >
      <div
        class="flex items-center justify-between gap-2 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.utility.create.landing") }}
        <Button
          size="sm"
          variant="ghost"
          class="h-6 px-2 text-[0.6rem]"
          :class="
            pickMode === 'landing' ? 'text-[hsl(var(--tac-amber))]' : ''
          "
          @click="pickMode = 'landing'"
        >
          {{ $t("pages.utility.create.repick") }}
        </Button>
      </div>
      <div class="mt-1 font-mono text-[0.65rem] tabular-nums">
        {{
          landing
            ? coordinate(landing)
            : $t("pages.utility.create.not_placed")
        }}
      </div>
      <label
        class="mt-2 flex items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
      >
        {{ $t("pages.utility.create.landing_height") }}
        <Input
          v-model="landingHeightInput"
          type="number"
          class="h-7 w-20 text-xs"
        />
      </label>
    </div>
  </div>

  <p class="text-[0.65rem] text-muted-foreground">
    {{ $t("pages.utility.create.height_hint") }}
  </p>

  <Button
    v-if="origin || landing"
    size="sm"
    variant="ghost"
    class="mt-2"
    @click="clearPoints()"
  >
    <Trash2 class="mr-1 h-4 w-4" />
    {{ $t("pages.utility.create.clear_points") }}
  </Button>

  <div class="flex flex-col gap-3">
    <UtilityConfidenceNote :lineup="confidencePreview" />
    <p class="text-[0.7rem] leading-snug text-muted-foreground">
      {{ $t("pages.utility.create.confidence_caption") }}
    </p>

    <div>
      <label
        class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.utility.create.utility") }}
      </label>
      <div class="flex flex-wrap gap-1.5">
        <UtilityTypeChips v-model="types" single />
      </div>
    </div>

    <div>
      <label
        class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("common.name") }}
      </label>
      <Input
        v-model="name"
        maxlength="120"
        :placeholder="$t('pages.utility.create.name_placeholder')"
      />
    </div>

    <div>
      <label
        class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
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

    <div class="grid gap-2">
      <div>
        <label
          class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.filters.side") }}
        </label>
        <Select v-model="side">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="entry of UTILITY_SIDES"
              :key="entry"
              :value="entry"
            >
              {{ $t(`pages.utility.sides.${entry}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label
          class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.filters.technique") }}
        </label>
        <Select v-model="technique">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="entry of UTILITY_TECHNIQUES"
              :key="entry"
              :value="entry"
            >
              {{ $t(`pages.utility.techniques.${entry}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label
          class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.filters.throw_strength") }}
        </label>
        <Select v-model="throwStrength">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="entry of UTILITY_THROW_STRENGTHS"
              :key="entry"
              :value="entry"
            >
              {{ $t(`pages.utility.strengths.${entry}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex items-end">
        <label class="flex items-center gap-2 pb-1">
          <Switch v-model="jumpThrowBind" />
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.utility.card.jump_bind") }}
          </span>
        </label>
      </div>
    </div>

    <div>
      <label
        class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.utility.create.aim") }}
      </label>
      <div class="flex flex-wrap items-center gap-2">
        <Input
          v-model="yawInput"
          type="number"
          step="0.1"
          class="h-8 w-24 font-mono text-xs tabular-nums"
          :placeholder="$t('pages.utility.create.yaw')"
          @input="anglesTouched = true"
        />
        <Input
          v-model="pitchInput"
          type="number"
          step="0.1"
          class="h-8 w-24 font-mono text-xs tabular-nums"
          :placeholder="$t('pages.utility.create.pitch')"
          @input="anglesTouched = true"
        />
        <Button
          size="sm"
          variant="outline"
          :disabled="!derivedAngles"
          @click="applyDerivedAngles()"
        >
          {{ $t("pages.utility.create.reset_aim") }}
        </Button>
      </div>
      <p class="mt-1 text-[0.65rem] leading-snug text-muted-foreground">
        {{ $t("pages.utility.create.aim_hint") }}
      </p>
    </div>

    <div>
      <label
        class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {{ $t("pages.utility.filters.tags") }}
      </label>
      <Input
        v-model="tagsInput"
        maxlength="160"
        :placeholder="$t('pages.utility.create.tags_placeholder')"
      />
    </div>

    <div class="grid gap-2">
      <div>
        <label
          class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
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

      <div>
        <label
          class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          {{ $t("pages.utility.playbooks.team") }}
        </label>
        <Select v-model="teamId">
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
    </div>

    <p
      v-if="visibility === 'Team' && teamId === NO_TEAM"
      class="text-[0.65rem] text-[hsl(var(--tac-amber))]"
    >
      {{ $t("pages.utility.playbooks.team_required") }}
    </p>

    <div class="flex flex-wrap items-center gap-2 pt-1">
      <Button
        class="tac-amber-cta"
        :loading="saving"
        :disabled="!canSave"
        @click="save()"
      >
        <Save class="mr-1 h-4 w-4" />
        {{ $t("pages.utility.create.save") }}
      </Button>
      <span v-if="!canSave" class="text-[0.65rem] text-muted-foreground">
        {{ $t("pages.utility.create.save_requirements") }}
      </span>
    </div>
  </div>
  </div>
</template>
