<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  ArrowBigUp,
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  Ellipsis,
  Clock,
  Globe,
  Heart,
  Lock,
  SkipForward,
  Users,
} from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import { Skeleton } from "~/components/ui/skeleton";
import Fold from "~/components/ui/transitions/Fold.vue";
import HeightGlide from "~/components/ui/transitions/HeightGlide.vue";
import { toast } from "~/components/ui/toast";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import UtilityCollectionPicker from "~/components/utility/UtilityCollectionPicker.vue";
import UtilityConfidenceNote from "~/components/utility/UtilityConfidenceNote.vue";
import UtilityHowCells from "~/components/utility/UtilityHowCells.vue";
import UtilityLineupPreview from "~/components/utility/UtilityLineupPreview.vue";
import UtilityMissPatternPanel from "~/components/utility/UtilityMissPatternPanel.vue";
import UtilityProgressPanel from "~/components/utility/UtilityProgressPanel.vue";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import {
  updateUtilityLineupMutation,
  utilityLineupQuery,
} from "~/graphql/utilityGraphql";
import cleanMapName from "~/utilities/cleanMapName";
import {
  UTILITY_TYPE_COLORS,
  aimPrecisionFor,
  aimTolerance,
  humanizeUtilityToken,
  myUtilityProgress,
  utilityDifficultyKey,
  utilityDifficultyMeasured,
} from "~/utilities/utilityDisplay";
import type {
  UtilityBarOffer,
  UtilityLineupContext,
} from "~/utilities/utilityDisplay";
import { useUtilityLoad } from "~/composables/useUtilityLoad";
import { useAuthStore } from "~/stores/AuthStore";
import type { UtilityLineup, UtilityVisibility } from "~/types/utility";

const props = defineProps<{
  /** The page's own list, so a lineup already on screen opens without a fetch. */
  lineups: UtilityLineup[];
  lineupId: string | null;
  canReact?: boolean;
  /**
   * Off on a phone: every practice action ends in "join this server in CS2",
   * which a phone cannot do, so offering it there is a button that only fails.
   */
  canPractice?: boolean;
  canReview?: boolean;
  /**
   * Where it was opened from, when that is not the Lineups list: a meta spot,
   * a collection, a step of an execute, the practice plan.
   */
  context?: UtilityLineupContext | null;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
  // What the bar at the foot of the card should offer while this is open.
  (e: "bar", offer: UtilityBarOffer | null): void;
  (e: "vote", id: string, value: 1 | -1): void;
  (e: "favorite", id: string): void;
  // Carries the name because the page may never have loaded this lineup --
  // it can arrive by link alone -- and both dialogs put the name in their copy.
  (e: "fork", id: string, name: string): void;
  (e: "archive", id: string, name: string): void;
  (e: "updated", id: string, patch: Partial<UtilityLineup>): void;
  (e: "request-public", id: string): void;
  (e: "review-public", id: string, approve: boolean): void;
  (e: "rerender-preview", id: string): void;
  (e: "restore", id: string): void;
  (e: "delete", id: string): void;
  // From the plan: on to the next one in its queue.
  (e: "skip", id: string): void;
}>();

const { t } = useI18n();

// The context line names the thing you came from, and marks that name for
// emphasis with <b> or **. It is split into runs and each run is set as text,
// so a name somebody typed is never read as markup.
const contextRuns = computed(() =>
  (props.context?.text ?? "")
    .split(/<\/?b>|\*\*/)
    .map((text, at) => ({ text, strong: at % 2 === 1 }))
    .filter((run) => run.text.length > 0),
);

const index = computed(() =>
  props.lineups.findIndex((entry) => entry.id === props.lineupId),
);

/**
 * A lineup the page never loaded. This is what makes `?lineup=<id>` a shareable
 * address rather than only a pointer into whatever the current filters happen
 * to hold: follow a link to a lineup on another scope, or on page four, and it
 * is fetched instead of reported missing.
 */
const fetched = ref<UtilityLineup | null>(null);
const fetching = ref(false);

const lineup = computed(() =>
  index.value >= 0 ? props.lineups[index.value] : fetched.value,
);

let fetchToken = 0;
watch(
  () => [props.lineupId, index.value, open.value] as const,
  async ([id, inList, isOpen]) => {
    if (!isOpen || !id || inList >= 0 || fetched.value?.id === id) {
      return;
    }
    const token = ++fetchToken;
    fetching.value = true;
    fetched.value = null;
    try {
      const { data } = await getGraphqlClient().query({
        query: utilityLineupQuery(),
        variables: { id },
        fetchPolicy: "cache-first",
      });
      if (token === fetchToken) {
        fetched.value = (data as any)?.utility_lineups_by_pk ?? null;
      }
    } catch (error) {
      console.error("[utility] lineup fetch error:", error);
      if (token === fetchToken) {
        fetched.value = null;
      }
    } finally {
      if (token === fetchToken) {
        fetching.value = false;
      }
    }
  },
  { immediate: true },
);

// It sits over the list in the card, so Escape is Back -- unless something
// above it (a menu, a dialog, a field being typed in) owns the key.
function onKey(event: KeyboardEvent) {
  if (!open.value || event.defaultPrevented) {
    return;
  }
  const target = event.target instanceof Element ? event.target : null;
  if (
    target?.closest("input, textarea, select, [contenteditable='true']") ||
    document.querySelector(
      "[role='dialog'][data-state='open'], [role='menu'], [role='listbox'], [data-utility-practice-open]",
    )
  ) {
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    if (editing.value) {
      editing.value = false;
    } else {
      open.value = false;
    }
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

// Already standing on a practice server? Then "practice this" is not a booking
// flow, it is one RCON away: stand them on it where they are.
const load = useUtilityLoad();

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      void load.check();
    }
  },
  { immediate: true },
);

// The numbers below are the throw's telemetry, not its story: they answer
// "why did this land there" on the rare day something is wrong with it, and
// nothing at all on the ordinary day you came to learn it.
const detailsOpen = ref(false);

const editing = ref(false);
const saving = ref(false);
const form = ref({
  name: "",
  description: "",
  tags: "",
  visibility: "Private" as UtilityVisibility,
});

// Public is not a setting an author can flip: it goes through review, and the
// submit action is the door to that. Coming back DOWN off Public is theirs.
const visibilities = computed<UtilityVisibility[]>(() => {
  const out: UtilityVisibility[] = ["Private", "Team"];
  if (lineup.value?.visibility === "Public") {
    out.push("Public");
  }
  return out;
});

function startEdit() {
  const value = lineup.value;
  if (!value) {
    return;
  }
  form.value = {
    name: value.name,
    description: value.description ?? "",
    tags: (value.tags ?? []).join(", "),
    visibility: value.visibility,
  };
  editing.value = true;
}

const editedTags = computed(() =>
  form.value.tags
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0),
);

const canSave = computed(
  () => form.value.name.trim().length > 0 && !saving.value,
);

async function save() {
  const value = lineup.value;
  if (!value || !canSave.value) {
    return;
  }
  saving.value = true;
  const patch = {
    name: form.value.name.trim(),
    description: form.value.description.trim() || null,
    tags: editedTags.value,
    visibility: form.value.visibility,
    // Team visibility without a team is a lineup nobody can reach, so the
    // team only rides along while it is the thing being addressed.
    team_id: form.value.visibility === "Team" ? value.team_id : null,
  };
  try {
    await getGraphqlClient().mutate({
      mutation: updateUtilityLineupMutation,
      variables: { id: value.id, ...patch },
    });
    // The fetched copy is this dialog's own; the list's copy belongs to the
    // page, which patches it in place rather than refetching the whole set.
    if (fetched.value?.id === value.id) {
      fetched.value = { ...fetched.value, ...patch };
    }
    emit("updated", value.id, patch);
    editing.value = false;
    toast({ title: t("pages.utility.edit.saved") });
  } catch (error) {
    console.error("[utility] lineup update error:", error);
    toast({
      title: t("pages.utility.edit.failed"),
      description: (error as Error)?.message,
      variant: "destructive",
    });
  } finally {
    saving.value = false;
  }
}

// Only the author, only while it is neither public nor already asked, and
// never for something archived: the queue is for lineups meant to be seen.
const canSubmitPublic = computed(
  () =>
    !!lineup.value?.can_edit &&
    lineup.value.visibility !== "Public" &&
    !lineup.value.public_requested_at &&
    !lineup.value.archived_at,
);

const reviewable = computed(
  () =>
    !!props.canReview &&
    !!lineup.value?.public_requested_at &&
    !lineup.value.archived_at,
);

// A request waiting on a moderator is answered in the bar, in the place of
// the practice action: there, answering it is the job.
const barOffer = computed<UtilityBarOffer | null>(() => {
  const row = lineup.value;
  if (!open.value || !row || editing.value) {
    return null;
  }
  if (reviewable.value) {
    return {
      actions: [
        {
          kind: "run",
          key: "reject",
          label: t("pages.utility.publish.reject"),
          quiet: true,
          run: () => emit("review-public", row.id, false),
        },
        {
          kind: "run",
          key: "approve",
          label: t("pages.utility.publish.approve"),
          run: () => emit("review-public", row.id, true),
        },
      ],
    };
  }
  return {
    target: { lineupId: row.id },
    actions:
      props.canPractice === false ? [] : [{ kind: "lineup", lineup: row }],
  };
});

watch(barOffer, (offer) => emit("bar", offer), { immediate: true });

const canRerender = computed(
  () =>
    !!props.canReview &&
    lineup.value?.visibility === "Public" &&
    !lineup.value.archived_at,
);

const canEdit = computed(
  () => !!lineup.value?.can_edit && !lineup.value.archived_at,
);

const canRestore = computed(
  () => !!lineup.value?.can_edit && !!lineup.value.archived_at,
);

const color = computed(
  () => UTILITY_TYPE_COLORS[lineup.value?.utility_type ?? "Smoke"] ?? "#ffffff",
);

// Your drill record arrives after the lineup does -- patched in from the live
// subscription -- so the block it lives in has to know whether there is one.
const hasRecord = computed(
  () =>
    !!myUtilityProgress(lineup.value?.progress, useAuthStore().me?.steam_id),
);

const myVote = computed(() => Number(lineup.value?.my_vote ?? 0));
const score = computed(
  () =>
    Number(lineup.value?.upvotes ?? 0) - Number(lineup.value?.downvotes ?? 0),
);

// Whose it is and who can see it, on yours and on anything waiting for review.
const STATUS_TONES = {
  Public: "bg-success/15 text-success",
  Team: "bg-[hsl(214_80%_62%/0.15)] text-[hsl(214_80%_68%)]",
  Private: "bg-muted/60 text-muted-foreground",
  review: "bg-[hsl(var(--tac-amber)/0.15)] text-[hsl(var(--tac-amber))]",
} as const;

const STATUS_ICONS = {
  Public: Globe,
  Team: Users,
  Private: Lock,
  review: Clock,
} as const;

const status = computed(() => {
  const value = lineup.value;
  if (
    !value ||
    value.archived_at ||
    (!value.can_edit && !value.public_requested_at)
  ) {
    return null;
  }
  const key = value.public_requested_at ? "review" : value.visibility;
  return {
    label:
      key === "review"
        ? t("pages.utility.publish.in_review")
        : t(`pages.utility.visibility.${key}`),
    tone: STATUS_TONES[key],
    icon: STATUS_ICONS[key],
  };
});

const facts = computed(() => {
  const value = lineup.value;
  if (!value) {
    return [];
  }
  const out: string[] = [];
  const ms = Number(value.flight_time_ms ?? 0);
  if (ms > 0) {
    out.push(
      `${t("pages.utility.card.stat_flight")} ${t("pages.utility.card.flight_time", { seconds: (ms / 1000).toFixed(1) })}`,
    );
  }
  // A grade nobody has measured is not a fact about the throw.
  const difficulty = String(value.difficulty ?? "").trim();
  if (difficulty && utilityDifficultyMeasured(difficulty)) {
    const key = utilityDifficultyKey(difficulty);
    out.push(
      key
        ? t(`pages.utility.difficulty.levels.${key}`)
        : humanizeUtilityToken(difficulty),
    );
  }
  return out;
});

// The dock's buttons are the app's own: square-cornered, outlined, the height
// of every other control row, amber when on -- the same toggle the map's
// callout and meta buttons are. The two states are whole strings rather than
// one base plus overrides, because two background or border utilities on one
// element resolve by stylesheet order, not by which was written last.
const TILE_BASE =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-50";
// Open, a trigger is lit like a hover; the focus ring a menu leaves on it
// would read as a second, louder selection on top of that.
const TILE_OFF =
  "border-white/10 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground data-[state=open]:bg-white/[0.06] data-[state=open]:text-foreground data-[state=open]:!ring-0";
const TILE_ON =
  "border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)]";

function tile(on = false, wide = false) {
  return [TILE_BASE, on ? TILE_ON : TILE_OFF, wide ? "px-2.5" : "w-8"];
}

// A menu trigger inside a tooltip registers its anchor on the tooltip's popper,
// so the menu needs the button handed to it or it opens off screen.
const moreRef = ref<HTMLElement | null>(null);

// Moving from one lineup to the next is a content swap inside a panel that is
// already open, so the body fades up instead of the whole panel sliding again.
const bodyRef = ref<HTMLElement | null>(null);
const swapped = ref(false);

// Picking another lineup mid-edit would otherwise save this form onto it.
watch(
  () => props.lineupId,
  (id, prev) => {
    detailsOpen.value = false;
    editing.value = false;
    swapped.value = !!(id && prev);
    if (swapped.value) {
      bodyRef.value?.scrollTo({ top: 0 });
    }
  },
);

watch(open, (isOpen) => {
  if (!isOpen) {
    editing.value = false;
  }
});

function coords(x: unknown, y: unknown, z: unknown) {
  return `${Math.round(Number(x))}, ${Math.round(Number(y))}, ${Math.round(Number(z))}`;
}

// How far the utility actually travels, which is the number that says whether a
// lineup is a long-range setup or a step-and-throw.
const throwDistance = computed(() => {
  const value = lineup.value;
  if (!value) {
    return null;
  }
  const dx = Number(value.land_x) - Number(value.origin_x);
  const dy = Number(value.land_y) - Number(value.origin_y);
  return Number.isFinite(dx) && Number.isFinite(dy)
    ? `${Math.round(Math.hypot(dx, dy))}u`
    : null;
});

// Stored eye minus stored feet. Not a constant: the feet are the standstill a
// throw was set up from and the eye is the release, so a jump throw reads
// higher than a standing 64.
const eyeOverFeet = computed(() => {
  const value = lineup.value;
  if (!value || value.eye_z == null) {
    return null;
  }
  const over = Number(value.eye_z) - Number(value.origin_z);
  return Number.isFinite(over) ? Math.round(over * 10) / 10 : null;
});

const flightSeconds = computed(() => {
  const ms = lineup.value?.flight_time_ms;
  return ms ? (ms / 1000).toFixed(2) : null;
});

const aimToleranceDegrees = computed(() =>
  aimTolerance(lineup.value?.aim_tolerance),
);
const aimPrecision = computed(() =>
  aimPrecisionFor(lineup.value?.aim_tolerance),
);

const stats = computed(() => {
  const value = lineup.value;
  if (!value) {
    return [];
  }
  return [
    {
      key: "flight_time",
      value: flightSeconds.value
        ? t("pages.utility.card.flight_time", { seconds: flightSeconds.value })
        : t("common.na"),
    },
    {
      key: "view_angles",
      value: `${Number(value.view_yaw ?? 0).toFixed(1)} / ${Number(value.view_pitch ?? 0).toFixed(1)}`,
    },
    {
      key: "precision",
      value: `${t(`pages.utility.precisions.${aimPrecision.value}`)} (${aimToleranceDegrees.value.toFixed(2)}°)`,
    },
    {
      key: "origin_source",
      value: t(`pages.utility.origin_sources.${value.origin_source}`),
    },
    {
      key: "stand",
      value: coords(value.origin_x, value.origin_y, value.origin_z),
    },
    { key: "lands", value: coords(value.land_x, value.land_y, value.land_z) },
    { key: "distance", value: throwDistance.value ?? t("common.na") },
    {
      key: "eye_height",
      value:
        eyeOverFeet.value === null ? t("common.na") : `${eyeOverFeet.value}u`,
    },
  ];
});
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
    leave-active-class="transition-[opacity,transform] [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
    enter-from-class="translate-x-4 opacity-0"
    leave-to-class="translate-x-4 opacity-0"
  >
    <section
      v-if="open"
      data-utility-lineup-open
      class="absolute inset-0 z-20 flex flex-col bg-sidebar max-md:bg-background"
      :aria-label="lineup?.name ?? $t('pages.utility.detail.not_found')"
    >
      <!-- Slid out over the list: Back puts the list where it was. The
           header is the way out on the left, big enough to hit without
           aiming, and on the right what you do TO the lineup: the reactions
           as tiles, the rest behind the last one -- or, editing, the form's
           own two answers. What you do WITH it -- put it on a practice
           server, or answer a request to publish it -- is in the bar at the
           foot of the card, where the server is. -->
      <header
        class="relative z-30 flex shrink-0 items-center gap-1.5 border-b border-white/[0.07] px-3 py-2.5"
      >
        <Button
          variant="outline"
          size="sm"
          class="h-8 shrink-0 border-white/10 bg-white/[0.05] pl-2 pr-3 text-foreground hover:bg-white/[0.09]"
          @click="open = false"
        >
          <ChevronLeft class="mr-0.5 h-4 w-4" />
          {{ $t("common.back") }}
        </Button>

        <div
          v-if="lineup && editing"
          class="ml-auto flex min-w-0 items-center gap-1.5"
        >
          <Button
            variant="outline"
            size="sm"
            class="h-8 border-white/10 px-3"
            @click="editing = false"
          >
            {{ $t("common.cancel") }}
          </Button>
          <Button
            size="sm"
            class="tac-amber-cta h-8 px-3.5 text-[13px] font-semibold"
            :disabled="!canSave"
            @click="save()"
          >
            {{ $t("common.save") }}
          </Button>
        </div>

        <div
          v-else-if="lineup"
          class="ml-auto flex min-w-0 items-center gap-1.5"
        >
          <!-- From the plan there is a queue behind this one. -->
          <FiveStackToolTip
            v-if="context?.skippable"
            as-child
            side="bottom"
            :delay-duration="120"
            :tap-toggle="false"
          >
            <template #trigger>
              <button
                type="button"
                :class="tile()"
                :aria-label="$t('pages.utility.plan.skip')"
                @click="emit('skip', lineup.id)"
              >
                <SkipForward class="h-4 w-4" />
              </button>
            </template>
            {{ $t("pages.utility.plan.skip") }}
          </FiveStackToolTip>

          <FiveStackToolTip
            as-child
            side="bottom"
            :delay-duration="120"
            :tap-toggle="false"
          >
            <template #trigger>
              <button
                type="button"
                :class="tile(myVote === 1, true)"
                :disabled="!canReact"
                :aria-pressed="myVote === 1"
                :aria-label="
                  myVote === 1
                    ? $t('pages.utility.card.unvote')
                    : $t('pages.utility.card.upvote')
                "
                @click="emit('vote', lineup.id, 1)"
              >
                <ArrowBigUp class="h-4 w-4" />
                {{ score }}
              </button>
            </template>
            {{
              myVote === 1
                ? $t("pages.utility.card.unvote")
                : $t("pages.utility.card.upvote")
            }}
          </FiveStackToolTip>

          <FiveStackToolTip
            as-child
            side="bottom"
            :delay-duration="120"
            :tap-toggle="false"
          >
            <template #trigger>
              <button
                type="button"
                :class="tile(lineup.is_favorited === true)"
                :disabled="!canReact"
                :aria-pressed="lineup.is_favorited === true"
                :aria-label="
                  lineup.is_favorited
                    ? $t('pages.utility.card.unfavorite')
                    : $t('pages.utility.card.favorite')
                "
                @click="emit('favorite', lineup.id)"
              >
                <Heart
                  class="h-4 w-4"
                  :class="lineup.is_favorited ? 'fill-current' : ''"
                />
              </button>
            </template>
            {{
              lineup.is_favorited
                ? $t("pages.utility.card.unfavorite")
                : $t("pages.utility.card.favorite")
            }}
          </FiveStackToolTip>

          <UtilityCollectionPicker
            :lineup-id="lineup.id"
            :trigger-class="tile()"
            :trigger-active-class="tile(true)"
            placement="below"
          />

          <DropdownMenu v-if="canReact">
            <FiveStackToolTip
              as-child
              side="bottom"
              :delay-duration="120"
              :tap-toggle="false"
            >
              <template #trigger>
                <DropdownMenuTrigger as-child>
                  <button
                    ref="moreRef"
                    type="button"
                    :class="tile()"
                    :aria-label="$t('pages.utility.card.more_actions')"
                  >
                    <Ellipsis class="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
              </template>
              {{ $t("pages.utility.card.more_actions") }}
            </FiveStackToolTip>
            <DropdownMenuContent
              :reference="moreRef ?? undefined"
              side="bottom"
              align="end"
              :side-offset="10"
              class="w-56 rounded-xl border-white/[0.12] bg-[#232327] p-1.5 [&_[role=separator]]:my-1.5 [&_[role=separator]]:bg-white/[0.08]"
            >
              <!-- Three groups, ruled apart: what its owner does to it,
                   what anyone can do with it, and taking it away. Words
                   only -- the glyphs said nothing the words did not. -->
              <template v-if="canEdit || canSubmitPublic || canRerender">
                <DropdownMenuItem v-if="canEdit" @click="startEdit()">
                  {{ $t("pages.utility.edit.action") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="canSubmitPublic"
                  @click="emit('request-public', lineup.id)"
                >
                  {{ $t("pages.utility.publish.submit") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="canRerender"
                  @click="emit('rerender-preview', lineup.id)"
                >
                  {{ $t("pages.utility.render_queue.rerender") }}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </template>

              <DropdownMenuItem @click="emit('fork', lineup.id, lineup.name)">
                {{ $t("pages.utility.fork.action") }}
              </DropdownMenuItem>
              <DropdownMenuItem @click="emit('vote', lineup.id, -1)">
                {{
                  myVote === -1
                    ? $t("pages.utility.card.unvote")
                    : $t("pages.utility.card.downvote")
                }}
              </DropdownMenuItem>

              <template v-if="canEdit || canRestore">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  v-if="canEdit"
                  class="text-destructive focus:text-destructive"
                  @click="emit('archive', lineup.id, lineup.name)"
                >
                  {{ $t("pages.utility.archive.action") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="canRestore"
                  @click="emit('restore', lineup.id)"
                >
                  {{ $t("pages.utility.archive.restore") }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="canRestore"
                  class="text-destructive focus:text-destructive"
                  @click="emit('delete', lineup.id)"
                >
                  {{ $t("pages.utility.archive.delete") }}
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div
        ref="bodyRef"
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-3"
      >
        <div
          v-if="lineup"
          :key="lineup.id"
          class="flex min-h-full flex-col gap-3.5"
          :class="
            swapped
              ? 'animate-in fade-in-0 slide-in-from-bottom-1 [animation-duration:240ms] [animation-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none'
              : ''
          "
        >
          <UtilityLineupPreview :lineup="lineup" />

          <!-- Editing swaps the details for the form; the throw stays on
               screen, which is the thing you are naming. -->
          <template v-if="editing">
            <div class="flex flex-col gap-1">
              <label
                class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
              >
                {{ $t("common.name") }}
              </label>
              <Input
                v-model="form.name"
                maxlength="120"
                :placeholder="$t('pages.utility.create.name_placeholder')"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label
                class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
              >
                {{ $t("common.description") }}
              </label>
              <Textarea
                v-model="form.description"
                rows="4"
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
                v-model="form.tags"
                maxlength="160"
                :placeholder="$t('pages.utility.create.tags_placeholder')"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label
                class="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
              >
                {{ $t("pages.utility.playbooks.visibility") }}
              </label>
              <Select v-model="form.visibility">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="entry of visibilities"
                    :key="entry"
                    :value="entry"
                  >
                    {{ $t(`pages.utility.visibility.${entry}`) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p
                v-if="lineup.visibility !== 'Public'"
                class="text-[0.68rem] leading-snug text-muted-foreground"
              >
                {{ $t("pages.utility.edit.public_note") }}
              </p>
            </div>

            <!-- What the throw IS -- where you stand, where you aim, how long
                 it flies -- is not on this form: everybody else's drill record
                 points at those, so a different throw is a fork, not an edit. -->
            <p class="text-[0.68rem] leading-snug text-muted-foreground">
              {{ $t("pages.utility.edit.geometry_note") }}
            </p>
          </template>

          <template v-else>
            <!-- What it is, as the line over its name: the utility in its
                 own colour, the map, and the side as the side's own mark. -->
            <div class="flex flex-col gap-1.5">
              <p
                class="flex min-w-0 items-center gap-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  class="size-2 shrink-0 rounded-[2px]"
                  :style="{ backgroundColor: color }"
                />
                <span class="truncate tabular-nums">
                  <template v-if="context?.kicker">{{ context.kicker }}</template>
                  <template v-else>
                    {{ $t(`pages.utility.types.${lineup.utility_type}`) }} ·
                    {{ cleanMapName(lineup.map_name) }}
                  </template>
                </span>
                <FiveStackToolTip as-child :delay-duration="120">
                  <template #trigger>
                    <img
                      :src="
                        lineup.side === 'CT'
                          ? '/img/teams/ct_logo.svg'
                          : '/img/teams/t_logo.svg'
                      "
                      :alt="$t(`pages.utility.sides.${lineup.side}`)"
                      class="-my-1 size-[1.125rem] shrink-0 -translate-y-px"
                    />
                  </template>
                  {{ $t(`pages.utility.sides.${lineup.side}`) }}
                </FiveStackToolTip>
              </p>
              <div class="flex items-start gap-2">
                <h2
                  class="min-w-0 flex-1 text-lg font-bold leading-tight [text-wrap:balance]"
                >
                  {{ lineup.name }}
                </h2>
                <!-- Who can see it is worth a glyph, not a word's width. -->
                <FiveStackToolTip v-if="status" as-child :delay-duration="120">
                  <template #trigger>
                    <span
                      class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md"
                      :class="status.tone"
                      role="img"
                      :aria-label="status.label"
                    >
                      <component :is="status.icon" class="h-3.5 w-3.5" />
                    </span>
                  </template>
                  {{ $t("pages.utility.card.yours", { status: status.label }) }}
                </FiveStackToolTip>
              </div>
            </div>

            <!-- Where you came from, when that is not the list: one quiet
                 line, and from the plan, why it queued this one. -->
            <div
              v-if="context?.reason"
              class="flex flex-col gap-1.5 rounded-md border border-border bg-background/50 p-2.5"
            >
              <span
                class="w-fit rounded-sm border px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase leading-none tracking-[0.12em]"
                :class="context.reason.tone"
              >
                {{ context.reason.label }}
              </span>
              <p
                v-for="line of context.reason.lines"
                :key="line"
                class="text-xs leading-relaxed text-muted-foreground first-of-type:text-foreground/90"
              >
                {{ line }}
              </p>
            </div>
            <p
              v-if="contextRuns.length"
              class="-mt-1.5 text-xs leading-relaxed text-muted-foreground"
            >
              <template v-for="(run, at) of contextRuns" :key="at">
                <b v-if="run.strong" class="font-semibold text-foreground/80">{{
                  run.text
                }}</b>
                <template v-else>{{ run.text }}</template>
              </template>
            </p>

            <!-- How to throw it, first and large: this is the part you glance
                 at mid-match. -->
            <UtilityHowCells
              :technique="lineup.technique"
              :strength="lineup.throw_strength"
            />

            <p
              v-if="facts.length"
              class="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground"
            >
              <template v-for="(fact, index) of facts" :key="fact">
                <span v-if="index > 0" aria-hidden="true" class="text-border">
                  /
                </span>
                <span class="tabular-nums">{{ fact }}</span>
              </template>
            </p>

            <!-- Anything less sure than a recorded lineup keeps its full note
                 up here, because that one you have to act on. -->
            <UtilityConfidenceNote
              v-if="lineup.confidence !== 'exact'"
              :lineup="lineup"
            />

            <p
              v-if="lineup.description"
              class="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground"
            >
              {{ lineup.description }}
            </p>

            <p
              v-if="lineup.tags?.length"
              class="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[0.6rem] lowercase tracking-[0.08em] text-muted-foreground/70"
            >
              <span v-for="tag of lineup.tags" :key="tag">#{{ tag }}</span>
            </p>

            <!-- Your record and the miss pattern both arrive after the panel
                 does, and both change size when they land. The block glides
                 to whatever height they come to, and each fades into the
                 room it makes, so nothing under them jumps. Spacing rides on
                 the pieces (mt) against a negative margin on the block: empty,
                 it takes no room at all. -->
            <HeightGlide class="-mt-3.5">
              <Transition
                enter-active-class="transition-[opacity,transform] [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
                leave-active-class="transition-opacity [transition-duration:110ms] ease-in motion-reduce:![transition-duration:1ms]"
                enter-from-class="translate-y-1 opacity-0"
                leave-to-class="opacity-0"
              >
                <UtilityProgressPanel
                  v-if="hasRecord"
                  :progress="lineup.progress"
                  class="mt-3.5"
                />
              </Transition>

              <!-- Signed out too: a public lineup's miss pattern is as public
                   as the lineup (the action is granted to guests). -->
              <UtilityMissPatternPanel
                :lineup-id="lineup.id"
                class="mt-3.5"
              />
            </HeightGlide>

            <!-- Who made it, whether it is public and the raw numbers are what
                 you read last, if at all -- so they sit at the foot of the
                 panel, pushed there even when the lineup has little to say. -->
            <div class="mt-auto flex flex-col gap-3 pt-3">
              <div
                class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground"
              >
                <PlayerDisplay
                  v-if="lineup.author"
                  :player="lineup.author"
                  size="xs"
                  compact
                  truncate-name
                  :show-elo="false"
                  :show-role="false"
                  :show-online="false"
                  class="min-w-0"
                />
                <span v-else>
                  {{ $t("pages.utility.card.unknown_author") }}
                </span>
                <span
                  v-if="lineup.team"
                  class="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.14em]"
                >
                  {{ lineup.team.short_name || lineup.team.name }}
                </span>
                <span class="flex-1" />
                <FiveStackToolTip
                  v-if="lineup.confidence === 'exact'"
                  as-child
                  :delay-duration="120"
                >
                  <template #trigger>
                    <span
                      class="inline-flex shrink-0 items-center gap-1 text-success"
                    >
                      <BadgeCheck class="h-3.5 w-3.5" />
                      {{ $t("pages.utility.confidence.exact") }}
                    </span>
                  </template>
                  {{ $t("pages.utility.confidence.exact_note") }}
                </FiveStackToolTip>
              </div>

              <!-- The telemetry, folded: it answers "why did this land there" on
                   the day something is wrong with the lineup, and nothing at all
                   on the ordinary day you came to learn it. -->
              <div class="overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 p-2.5 text-left transition-colors hover:bg-muted/30"
                  :aria-expanded="detailsOpen"
                  @click="detailsOpen = !detailsOpen"
                >
                  <span
                    class="min-w-0 flex-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {{ $t("pages.utility.detail.technical") }}
                  </span>
                  <ChevronDown
                    class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform [transition-duration:240ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:![transition-duration:1ms]"
                    :class="detailsOpen ? 'rotate-180' : ''"
                  />
                </button>
                <Fold :open="detailsOpen">
                  <dl
                    class="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border p-2.5 text-xs"
                  >
                    <div v-for="stat of stats" :key="stat.key" class="min-w-0">
                      <dt
                        class="truncate font-mono text-[0.58rem] uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        {{ $t(`pages.utility.detail.${stat.key}`) }}
                      </dt>
                      <dd class="truncate font-mono tabular-nums">
                        {{ stat.value }}
                      </dd>
                    </div>
                  </dl>
                </Fold>
              </div>
            </div>
          </template>
        </div>

        <div v-else-if="fetching" class="flex flex-col gap-3">
          <Skeleton class="h-6 w-2/3 rounded-md" />
          <Skeleton class="aspect-video w-full rounded-md" />
          <Skeleton class="h-16 w-full rounded-md" />
        </div>

        <div v-else class="p-8 text-center">
          <p class="text-sm font-semibold">
            {{ $t("pages.utility.detail.not_found") }}
          </p>
          <p class="mx-auto mt-1 max-w-[40ch] text-xs text-muted-foreground">
            {{ $t("pages.utility.detail.not_found_description") }}
          </p>
        </div>
      </div>

    </section>
  </Transition>
</template>
