<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { ArrowLeft, Crosshair, Save, Trash2 } from "lucide-vue-next";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
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
import NadeRadarBoard from "~/components/nades/NadeRadarBoard.vue";
import NadeTypeChips from "~/components/nades/NadeTypeChips.vue";
import NadeConfidenceNote from "~/components/nades/NadeConfidenceNote.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  createNadeLineupMutation,
  nadeLineupsQuery,
} from "~/graphql/nadesGraphql";
import { order_by } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { normalizeMapName } from "~/utilities/mapAssets";
import cleanMapName from "~/utilities/cleanMapName";
import {
  NADE_EYE_HEIGHT_UNITS,
  NADE_SIDES,
  NADE_TECHNIQUES,
  NADE_THROW_STRENGTHS,
  NADE_TYPE_COLORS,
} from "~/utilities/nadeDisplay";
import type {
  NadeBoardMarker,
  NadeBoardSegment,
} from "~/utilities/nadeDisplay";
import type {
  NadeLineup,
  NadeSide,
  NadeSightlinePoint,
  NadeTechnique,
  NadeThrowStrength,
  NadeType,
  NadeVisibility,
} from "~/types/nade";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const mapName = computed(() => normalizeMapName(String(route.params.map)));
const mapTitle = computed(() => cleanMapName(mapName.value));

// Reka Select rejects an empty-string value, so "unset" rides a sentinel.
const NO_TEAM = "none";

const VISIBILITIES: NadeVisibility[] = ["Private", "Team", "Public"];

const auth = useAuthStore();
const myTeams = computed(
  () =>
    (auth.me?.teams ?? []) as Array<{
      id: string;
      name: string;
      short_name?: string | null;
    }>,
);

const origin = ref<NadeSightlinePoint | null>(null);
const landing = ref<NadeSightlinePoint | null>(null);
const pickMode = ref<"origin" | "landing">("origin");

// One height per end, because a radar pixel carries none of its own: the throw
// is read at the floor the player stands on, the landing at whatever the nade
// comes to rest on. On Nuke and Vertigo the same number also picks the level,
// which is why the point has to be re-picked after the height changes rather
// than edited in place — the world X/Y were unprojected through the old level's
// offset and mean nothing under the new one.
const originHeightInput = ref("0");
const landingHeightInput = ref("0");

const types = ref<NadeType[]>(["Smoke"]);
const side = ref<NadeSide>("TERRORIST");
const technique = ref<NadeTechnique>("Stationary");
const throwStrength = ref<NadeThrowStrength>("Full");
const jumpThrowBind = ref(false);
const name = ref("");
const description = ref("");
const tagsInput = ref("");
const visibility = ref<NadeVisibility>("Private");
const teamId = ref<string>(NO_TEAM);

const yawInput = ref("");
const pitchInput = ref("");
const anglesTouched = ref(false);

const saving = ref(false);

const nadeType = computed<NadeType>(() => types.value[0] ?? "Smoke");

const typeColor = computed(
  () => NADE_TYPE_COLORS[nadeType.value] ?? "#ffffff",
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
      query: nadeLineupsQuery,
      variables: {
        where: {
          map_name: { _eq: mapName.value },
          can_view: { _eq: true },
        },
        order_by: [{ upvotes: order_by.desc }],
        limit: 60,
        offset: 0,
      },
      fetchPolicy: "cache-first",
    });
    const rows = ((data as any)?.nade_lineups ?? []) as NadeLineup[];
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
    console.error("[nades] author height seed error:", error);
  }
}

watch(mapName, () => void seedHeights(), { immediate: true });

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
  const dz = landing.value.z - (origin.value.z + NADE_EYE_HEIGHT_UNITS);
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

function onPick(point: NadeSightlinePoint) {
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

const markers = computed<NadeBoardMarker[]>(() => {
  const out: NadeBoardMarker[] = [];
  if (origin.value) {
    out.push({
      key: "origin",
      point: origin.value,
      color: "#e6ebf5",
      shape: "cross" as const,
      label: t("pages.nades.create.origin_short"),
    });
  }
  if (landing.value) {
    out.push({
      key: "landing",
      point: landing.value,
      color: typeColor.value,
      label: t("pages.nades.create.landing_short"),
    });
  }
  return out;
});

const segments = computed<NadeBoardSegment[]>(() => {
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
      map_name: mapName.value,
      nade_type: nadeType.value,
      side: side.value,
      technique: technique.value,
      throw_strength: throwStrength.value,
      jump_throw_bind: jumpThrowBind.value,
      origin_x: start.x,
      origin_y: start.y,
      origin_z: start.z,
      eye_z: start.z + NADE_EYE_HEIGHT_UNITS,
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
      mutation: createNadeLineupMutation,
      variables: { object },
    });
    const id = (data as any)?.insert_nade_lineups_one?.id;
    if (!id) {
      throw new Error("no lineup");
    }
    toast({ title: t("pages.nades.create.saved") });
    await router.push({ name: "nades-lineup-id", params: { id } });
  } catch (error: any) {
    toast({
      title: t("pages.nades.create.save_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    saving.value = false;
  }
}

function coordinate(point: NadeSightlinePoint) {
  return `${Math.round(point.x)}, ${Math.round(point.y)}, ${Math.round(point.z)}`;
}
</script>

<template>
  <PageTransition>
    <TacticalPageHeader>
      <template #description>{{ $t("pages.nades.create.eyebrow") }}</template>
      <template #title>{{ $t("pages.nades.create.title") }}</template>
      <template #subtitle>
        {{ $t("pages.nades.create.subtitle", { map: mapTitle }) }}
      </template>
      <template #actions>
        <NuxtLink :to="{ name: 'nades-map', params: { map: mapName } }">
          <Button variant="outline">
            <ArrowLeft class="mr-1 h-4 w-4" />
            {{ $t("pages.nades.back_to_map") }}
          </Button>
        </NuxtLink>
      </template>
    </TacticalPageHeader>
  </PageTransition>

  <PageTransition :delay="60" class="mt-4">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div class="lg:sticky lg:top-4 lg:self-start">
        <NadeRadarBoard
          :map-name="mapName"
          :lineups="[]"
          picking
          :pick-z="pickHeight"
          :markers="markers"
          :segments="segments"
          @pick="onPick"
        />

        <p class="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Crosshair class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {{
            pickMode === "origin"
              ? $t("pages.nades.create.pick_origin_hint")
              : $t("pages.nades.create.pick_landing_hint")
          }}
        </p>

        <div class="mt-2 grid gap-2 sm:grid-cols-2">
          <div
            class="rounded-sm border border-border bg-card/40 p-2 [backdrop-filter:blur(6px)]"
          >
            <div
              class="flex items-center justify-between gap-2 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("pages.nades.create.origin") }}
              <Button
                size="sm"
                variant="ghost"
                class="h-6 px-2 text-[0.6rem]"
                :class="pickMode === 'origin' ? 'text-[hsl(var(--tac-amber))]' : ''"
                @click="pickMode = 'origin'"
              >
                {{ $t("pages.nades.create.repick") }}
              </Button>
            </div>
            <div class="mt-1 font-mono text-[0.65rem] tabular-nums">
              {{
                origin
                  ? coordinate(origin)
                  : $t("pages.nades.create.not_placed")
              }}
            </div>
            <label
              class="mt-2 flex items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              {{ $t("pages.nades.create.origin_height") }}
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
              {{ $t("pages.nades.create.landing") }}
              <Button
                size="sm"
                variant="ghost"
                class="h-6 px-2 text-[0.6rem]"
                :class="
                  pickMode === 'landing' ? 'text-[hsl(var(--tac-amber))]' : ''
                "
                @click="pickMode = 'landing'"
              >
                {{ $t("pages.nades.create.repick") }}
              </Button>
            </div>
            <div class="mt-1 font-mono text-[0.65rem] tabular-nums">
              {{
                landing
                  ? coordinate(landing)
                  : $t("pages.nades.create.not_placed")
              }}
            </div>
            <label
              class="mt-2 flex items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              {{ $t("pages.nades.create.landing_height") }}
              <Input
                v-model="landingHeightInput"
                type="number"
                class="h-7 w-20 text-xs"
              />
            </label>
          </div>
        </div>

        <p class="mt-2 text-[0.65rem] text-muted-foreground">
          {{ $t("pages.nades.create.height_hint") }}
        </p>

        <Button
          v-if="origin || landing"
          size="sm"
          variant="ghost"
          class="mt-2"
          @click="clearPoints()"
        >
          <Trash2 class="mr-1 h-4 w-4" />
          {{ $t("pages.nades.create.clear_points") }}
        </Button>
      </div>

      <div class="flex flex-col gap-3">
        <NadeConfidenceNote :lineup="confidencePreview" />
        <p class="text-[0.7rem] leading-snug text-muted-foreground">
          {{ $t("pages.nades.create.confidence_caption") }}
        </p>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.nades.create.utility") }}
          </label>
          <div class="flex flex-wrap gap-1.5">
            <NadeTypeChips v-model="types" single />
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
            :placeholder="$t('pages.nades.create.name_placeholder')"
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
            :placeholder="$t('pages.nades.create.description_placeholder')"
          />
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <div>
            <label
              class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("pages.nades.filters.side") }}
            </label>
            <Select v-model="side">
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
              {{ $t("pages.nades.filters.technique") }}
            </label>
            <Select v-model="technique">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="entry of NADE_TECHNIQUES"
                  :key="entry"
                  :value="entry"
                >
                  {{ $t(`pages.nades.techniques.${entry}`) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("pages.nades.filters.throw_strength") }}
            </label>
            <Select v-model="throwStrength">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="entry of NADE_THROW_STRENGTHS"
                  :key="entry"
                  :value="entry"
                >
                  {{ $t(`pages.nades.strengths.${entry}`) }}
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
                {{ $t("pages.nades.card.jump_bind") }}
              </span>
            </label>
          </div>
        </div>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.nades.create.aim") }}
          </label>
          <div class="flex flex-wrap items-center gap-2">
            <Input
              v-model="yawInput"
              type="number"
              step="0.1"
              class="h-8 w-24 font-mono text-xs tabular-nums"
              :placeholder="$t('pages.nades.create.yaw')"
              @input="anglesTouched = true"
            />
            <Input
              v-model="pitchInput"
              type="number"
              step="0.1"
              class="h-8 w-24 font-mono text-xs tabular-nums"
              :placeholder="$t('pages.nades.create.pitch')"
              @input="anglesTouched = true"
            />
            <Button
              size="sm"
              variant="outline"
              :disabled="!derivedAngles"
              @click="applyDerivedAngles()"
            >
              {{ $t("pages.nades.create.reset_aim") }}
            </Button>
          </div>
          <p class="mt-1 text-[0.65rem] leading-snug text-muted-foreground">
            {{ $t("pages.nades.create.aim_hint") }}
          </p>
        </div>

        <div>
          <label
            class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            {{ $t("pages.nades.filters.tags") }}
          </label>
          <Input
            v-model="tagsInput"
            maxlength="160"
            :placeholder="$t('pages.nades.create.tags_placeholder')"
          />
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <div>
            <label
              class="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
            >
              {{ $t("pages.nades.playbooks.visibility") }}
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
                  {{ $t(`pages.nades.visibility.${entry}`) }}
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
          {{ $t("pages.nades.playbooks.team_required") }}
        </p>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <Button
            class="tac-amber-cta"
            :loading="saving"
            :disabled="!canSave"
            @click="save()"
          >
            <Save class="mr-1 h-4 w-4" />
            {{ $t("pages.nades.create.save") }}
          </Button>
          <span v-if="!canSave" class="text-[0.65rem] text-muted-foreground">
            {{ $t("pages.nades.create.save_requirements") }}
          </span>
        </div>
      </div>
    </div>
  </PageTransition>
</template>
