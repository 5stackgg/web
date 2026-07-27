<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import AwardBadge from "./AwardBadge.vue";
import AwardPickerDialog from "./AwardPickerDialog.vue";
import ImageUploadTile from "~/components/ImageUploadTile.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";
import PlayerSearch from "~/components/PlayerSearch.vue";
import TeamSearch from "~/components/teams/TeamSearch.vue";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
} from "~/utilities/tacticalClasses";
import { TIER_PALETTES, resolveAwardTier } from "~/utilities/awardSeed";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { awardScopedDefinitionFields } from "~/graphql/awardFields";

type ScopeKind = "global" | "tournament" | "season" | "event" | "league_season";
type RecipientKind = "none" | "player" | "team";

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** Preselect an existing award, e.g. "Grant" on a catalog card. */
    awardId?: string | null;
    /**
     * The already-loaded row for `awardId`, when the caller has it. The panel
     * then reads as its award immediately instead of blank until the catalog
     * query lands.
     */
    award?: Record<string, any> | null;
    /**
     * Grant-only: the award is being handed out, not authored, so its
     * definition and artwork are shown as-is and a recipient is required.
     */
    grant?: boolean;
    /** Pre-set and lock the scope when opened from that context. */
    tournamentId?: string | null;
    seasonId?: string | null;
    eventId?: string | null;
    leagueSeasonId?: string | null;
    /** Pre-set the recipient when opened from a team or player page. */
    team?: { id: string; name?: string | null } | null;
    player?: { steam_id: string; name?: string | null } | null;
    /**
     * The recipient is already decided by where the panel was opened (a
     * player's or a team's page), so the selector gives way to a statement of
     * who receives it.
     */
    lockRecipient?: boolean;
    /** Restrict recipients, e.g. to a tournament's participants. */
    playerOptions?: Array<{
      id: string;
      name: string;
      players: Array<{ steam_id: string; name: string }>;
    }> | null;
    teamOptions?: Array<{ id: string; team_id: string; name: string }> | null;
  }>(),
  {
    awardId: null,
    award: null,
    grant: false,
    tournamentId: null,
    seasonId: null,
    eventId: null,
    leagueSeasonId: null,
    team: null,
    player: null,
    lockRecipient: false,
    playerOptions: null,
    teamOptions: null,
  },
);

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "saved"): void;
}>();

const TIERS = ["special", "mvp", "gold", "silver", "bronze"];

const { t } = useI18n();
const { client } = useApolloClient();
const apiDomain = computed(() => useRuntimeConfig().public.apiDomain);

const awards = ref<any[]>([]);
const catalogLoaded = ref(false);
const pickerOpen = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const mode = ref<"existing" | "new">("new");
const draft = ref({
  id: "",
  name: "",
  description: "",
  tier: "special",
  allow_multiple: false,
  image_url: null as string | null,
});
const recipient = ref<{
  kind: RecipientKind;
  player: any;
  team: any;
}>({ kind: "none", player: null, team: null });
const note = ref("");

/** The scope is fixed by whoever opened the panel; global when none is given. */
const scope = computed<{ kind: ScopeKind; id: string | null }>(() => {
  if (props.tournamentId) return { kind: "tournament", id: props.tournamentId };
  if (props.seasonId) return { kind: "season", id: props.seasonId };
  if (props.eventId) return { kind: "event", id: props.eventId };
  if (props.leagueSeasonId)
    return { kind: "league_season", id: props.leagueSeasonId };
  return { kind: "global", id: null };
});

/**
 * The catalog row behind an id. The caller's copy wins so the panel can render
 * before the query resolves, and it is the only source when the query fails.
 */
function findAward(id: string): Record<string, any> | null {
  if (!id) return null;
  if (props.award?.id === id) return props.award;
  return awards.value.find((a) => a.id === id) ?? null;
}

const previewAward = computed(() => ({
  id: draft.value.id || "new-award",
  name: draft.value.name,
  tier: draft.value.tier,
  image_url: draft.value.image_url,
}));

const accent = computed(
  () => TIER_PALETTES[resolveAwardTier(null, previewAward.value?.tier)].primary,
);

const artworkSrc = computed(() => {
  const source = previewAward.value?.image_url;
  if (!source) return null;
  return `https://${apiDomain.value}/avatars/awards/${String(source).replace(/^(awards|trophies)\//, "")}`;
});

/** Artwork needs a row to attach to, so it unlocks once the award exists. */
const awardId = computed(() => draft.value.id);

/** Handing out a known award: nothing about it is editable here. */
const granting = computed(() => props.grant && !!props.awardId);

const hasRecipient = computed(
  () =>
    (recipient.value.kind === "player" && !!recipient.value.player) ||
    (recipient.value.kind === "team" && !!recipient.value.team),
);

/**
 * Working on an existing award needs its current row: to show what is being
 * handed out, and to send its scope back rather than blanking it. Until the
 * row is in hand there is nothing safe to save.
 */
const awardRowReady = computed(
  () => !props.awardId || !!findAward(props.awardId),
);

/**
 * The named award is genuinely absent rather than still on its way, so the
 * panel can say so instead of flashing an error while the catalog loads.
 */
const awardMissing = computed(
  () => catalogLoaded.value && !awardRowReady.value,
);

const canSave = computed(() => {
  if (saving.value || !awardRowReady.value) return false;
  if (granting.value) return hasRecipient.value;
  return !!draft.value.name.trim();
});

const recipientLabel = computed(() => {
  if (recipient.value.kind === "player") {
    return recipient.value.player?.name ?? null;
  }
  if (recipient.value.kind === "team")
    return recipient.value.team?.name ?? null;
  return null;
});

const tierChoices = computed(() =>
  TIERS.map((tier) => ({ key: tier, label: tier })),
);

const recipientChoices = computed<Array<{ key: RecipientKind; label: string }>>(
  () => {
    const options: Array<{ key: RecipientKind; label: string }> = [];
    // Granting has no point without a recipient, so "none" is not on offer.
    if (!granting.value) {
      options.push({ key: "none", label: t("common.none") });
    }
    if (!props.playerOptions || props.playerOptions.length) {
      options.push({ key: "player", label: t("awards_manage_form.player") });
    }
    if (!props.teamOptions || props.teamOptions.length) {
      options.push({ key: "team", label: t("awards_manage_form.team") });
    }
    return options;
  },
);

/**
 * The draft as applyAward() left it, so a catalog that lands late can tell an
 * untouched panel from one already being typed into.
 */
let appliedDraft = "";

/** Fills the draft from a known award, so its fields show as-is. */
function applyAward(id: string) {
  const found = findAward(id);
  draft.value = {
    id,
    name: found?.name ?? "",
    description: found?.description ?? "",
    tier: found?.tier ?? "special",
    allow_multiple: !!found?.allow_multiple,
    image_url: found?.image_url ?? null,
  };
  appliedDraft = JSON.stringify(draft.value);
}

function reset() {
  mode.value = props.awardId ? "existing" : "new";
  applyAward(props.awardId ?? "");
  recipient.value = {
    kind: props.player
      ? "player"
      : props.team
        ? "team"
        : granting.value
          ? (recipientChoices.value[0]?.key ?? "player")
          : "none",
    player: props.player,
    team: props.team,
  };
  note.value = "";
  error.value = null;
}

async function loadAwards() {
  const { data } = await client.query({
    query: typedGql("query")({
      awards: [
        { order_by: [{ name: order_by.asc }] },
        awardScopedDefinitionFields,
      ],
    }),
    fetchPolicy: "network-only",
  });
  awards.value = (data as any)?.awards ?? [];
  catalogLoaded.value = true;
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    catalogLoaded.value = false;
    reset();
    try {
      await loadAwards();
    } catch (err: any) {
      // Surfaced rather than swallowed: without the catalog the panel cannot
      // show what it is about to hand out or save without re-homing it.
      error.value = err?.message ?? String(err);
      return;
    }
    // The catalog arrives after reset(), so a preselected award only becomes
    // fillable now — unless it is already filled, or typed over in the mean
    // time.
    if (
      props.awardId &&
      draft.value.id === props.awardId &&
      JSON.stringify(draft.value) === appliedDraft
    ) {
      applyAward(props.awardId);
    }
  },
  { immediate: true },
);

/** Switching who receives it drops whoever was picked for the old kind. */
function selectRecipientKind(kind: unknown) {
  recipient.value.kind = kind as RecipientKind;
  recipient.value.player = null;
  recipient.value.team = null;
}

function onPicked(id: string) {
  mode.value = "existing";
  applyAward(id);
}

/** Creates or updates the award row; returns its id. */
async function persistAward(): Promise<string> {
  const creating = !draft.value.id;
  const existing = creating ? null : findAward(draft.value.id);
  const { data } = await client.mutate({
    mutation: typedGql("mutation")({
      saveAward: [
        {
          id: $("id", "uuid"),
          name: $("name", "String!"),
          description: $("description", "String"),
          tier: $("tier", "String!"),
          allow_multiple: $("allow_multiple", "Boolean"),
          tournament_id: $("tournament_id", "uuid"),
          season_id: $("season_id", "uuid"),
          event_id: $("event_id", "uuid"),
          league_season_id: $("league_season_id", "uuid"),
        },
        { id: true, name: true, tier: true, image_url: true },
      ],
    }),
    variables: {
      id: draft.value.id || null,
      name: draft.value.name.trim(),
      description: draft.value.description.trim() || null,
      tier: draft.value.tier,
      allow_multiple: draft.value.allow_multiple,
      // Only a new award takes the panel's scope; editing an existing one
      // sends its own scope back, so a save can neither re-home it nor — if
      // the mutation reads a null as "clear this" — orphan it.
      tournament_id: creating
        ? props.tournamentId
        : (existing?.tournament_id ?? null),
      season_id: creating ? props.seasonId : (existing?.season_id ?? null),
      event_id: creating ? props.eventId : (existing?.event_id ?? null),
      league_season_id: creating
        ? props.leagueSeasonId
        : (existing?.league_season_id ?? null),
    },
  });
  const saved = (data as any)?.saveAward;
  draft.value.id = saved?.id ?? "";
  draft.value.image_url = saved?.image_url ?? null;
  return draft.value.id;
}

/**
 * Where the recipient belongs: the panel's scope when it was opened from one,
 * otherwise the award's own, so a tournament award granted from the catalog
 * still lands on that tournament instead of nowhere.
 */
function scopeForGrant(id: string) {
  const source = findAward(id);
  return {
    tournament_id: props.tournamentId ?? source?.tournament_id ?? null,
    season_id: props.seasonId ?? source?.season_id ?? null,
    event_id: props.eventId ?? source?.event_id ?? null,
    league_season_id: props.leagueSeasonId ?? source?.league_season_id ?? null,
  };
}

/** Saves the award without closing, so artwork can be attached to it. */
async function createForArtwork() {
  saving.value = true;
  error.value = null;
  try {
    await persistAward();
    await loadAwards();
  } catch (err: any) {
    error.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
}

async function submit() {
  saving.value = true;
  error.value = null;
  try {
    // Granting never rewrites the award it is handing out.
    const id = granting.value ? props.awardId! : await persistAward();
    if (!id) throw new Error("Award was not saved");

    if (recipient.value.kind !== "none") {
      await client.mutate({
        mutation: typedGql("mutation")({
          grantAward: [
            {
              award_id: $("award_id", "uuid!"),
              tournament_id: $("tournament_id", "uuid"),
              season_id: $("season_id", "uuid"),
              event_id: $("event_id", "uuid"),
              league_season_id: $("league_season_id", "uuid"),
              player_steam_id: $("player_steam_id", "String"),
              team_id: $("team_id", "uuid"),
              note: $("note", "String"),
            },
            { id: true },
          ],
        }),
        variables: {
          award_id: id,
          ...scopeForGrant(id),
          player_steam_id:
            recipient.value.kind === "player"
              ? String(recipient.value.player.steam_id)
              : null,
          team_id:
            recipient.value.kind === "team" ? recipient.value.team.id : null,
          note: note.value.trim() || null,
        },
      });
    }

    emit("saved");
    emit("update:open", false);
  } catch (err: any) {
    error.value = err?.message ?? String(err);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="(v) => emit('update:open', v)">
    <SheetContent class="flex flex-col gap-0">
      <SheetHeader>
        <SheetTitle>{{
          granting
            ? $t("awards.composer.grant_here")
            : $t("awards.composer.title")
        }}</SheetTitle>
        <SheetDescription class="sr-only">
          {{
            granting
              ? $t("awards.composer.grant_here")
              : $t("awards.composer.title")
          }}
        </SheetDescription>
      </SheetHeader>

      <div class="-mx-4 mt-6 flex-1 space-y-6 overflow-y-auto px-4">
        <!-- The specimen tracks the draft, so the award is visible as it is built -->
        <div
          class="relative flex h-40 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background/40"
        >
          <div
            class="pointer-events-none absolute inset-x-10 bottom-0 top-1/3 opacity-45 blur-2xl"
            :style="{
              background: `radial-gradient(ellipse 70% 60% at 50% 100%, ${accent} 0%, transparent 70%)`,
            }"
            aria-hidden="true"
          ></div>
          <AwardBadge
            :award="previewAward"
            :seed-key="previewAward?.id || 'new-award'"
            size="md"
            :interactive="false"
            :show-name="false"
            class="relative z-[1]"
          />
        </div>

        <div class="space-y-2">
          <div :class="[tacticalSectionLabelClasses, 'mb-0']">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("awards.composer.award") }}
          </div>

          <!-- The row never turned up, so there is nothing to show and nothing
               safe to save. Say so rather than offering a blank award. -->
          <p v-if="awardMissing" class="text-xs text-destructive">
            {{ $t("awards.composer.award_unavailable") }}
          </p>

          <!-- Granting hands out the award as it stands, so it reads rather
               than edits. -->
          <div v-else-if="granting" class="space-y-1.5">
            <div class="flex items-baseline gap-2">
              <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{
                draft.name
              }}</span>
              <span
                class="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.2em]"
                :style="{ color: accent }"
                >{{
                  TIER_PALETTES[resolveAwardTier(null, draft.tier)].label
                }}</span
              >
            </div>
            <p v-if="draft.description" class="text-xs text-muted-foreground">
              {{ draft.description }}
            </p>
          </div>

          <!-- Loading an existing award fills these fields, so an award can be
               customised at any point rather than only at creation. -->
          <button
            v-if="!granting"
            type="button"
            class="flex h-9 w-full items-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-2 text-left text-muted-foreground transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.45)] hover:text-foreground"
            @click="pickerOpen = true"
          >
            <span class="min-w-0 flex-1 truncate text-xs">
              {{
                draft.id
                  ? $t("awards.composer.editing", { name: draft.name })
                  : $t("awards.composer.load_existing")
              }}
            </span>
            <span class="shrink-0 text-[0.6rem]">&#9662;</span>
          </button>

          <template v-if="!granting">
            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">{{
                $t("pages.awards.name")
              }}</span>
              <Input v-model="draft.name" maxlength="60" />
            </label>
            <label class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">{{
                $t("pages.awards.description_label")
              }}</span>
              <Textarea v-model="draft.description" rows="2" />
            </label>
            <div class="flex flex-col gap-1.5">
              <span class="text-sm font-medium">{{
                $t("pages.awards.tier")
              }}</span>
              <AnimatedFilters
                v-model="draft.tier"
                square
                :options="tierChoices"
              />
            </div>
            <label class="flex items-center justify-between gap-3">
              <span class="flex flex-col">
                <span class="text-sm font-medium">{{
                  $t("pages.awards.allow_multiple")
                }}</span>
                <span class="text-xs text-muted-foreground">{{
                  $t("pages.awards.allow_multiple_hint")
                }}</span>
              </span>
              <Switch v-model="draft.allow_multiple" />
            </label>
          </template>
        </div>

        <div v-if="!granting" class="space-y-2">
          <div :class="[tacticalSectionLabelClasses, 'mb-0']">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("pages.awards.artwork") }}
          </div>
          <ImageUploadTile
            v-if="awardId"
            class="max-w-[9rem]"
            aspect="square"
            fit="contain"
            allow-bg-removal
            :upload-url="`https://${apiDomain}/avatars/awards/${awardId}`"
            :delete-url="`https://${apiDomain}/avatars/awards/${awardId}`"
            :has-custom="!!previewAward?.image_url"
            :current-src="artworkSrc"
            @uploaded="(path) => (draft.image_url = path)"
            @removed="draft.image_url = null"
          />
          <!-- Artwork attaches to a row, so the award is created first. Saving
               here keeps the panel open rather than bouncing the user out. -->
          <div v-else class="flex flex-col items-start gap-2">
            <p class="text-xs text-muted-foreground">
              {{ $t("awards.composer.artwork_needs_award") }}
            </p>
            <Button
              size="sm"
              variant="outline"
              :disabled="!draft.name.trim() || saving"
              @click="createForArtwork"
            >
              {{ $t("awards.composer.create_to_upload") }}
            </Button>
          </div>
        </div>

        <div class="space-y-2">
          <div :class="[tacticalSectionLabelClasses, 'mb-0']">
            <span :class="tacticalSectionTickClasses"></span>
            {{ $t("awards.composer.assign") }}
          </div>

          <p class="text-xs text-muted-foreground">
            {{ $t(`awards.composer.scope_${scope.kind}`) }}
          </p>

          <template v-if="lockRecipient">
            <div
              class="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2"
            >
              <span
                class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
              >
                {{
                  recipient.kind === "team"
                    ? $t("awards_manage_form.team")
                    : $t("awards_manage_form.player")
                }}
              </span>
              <span class="min-w-0 flex-1 truncate text-sm font-semibold">
                {{ recipientLabel }}
              </span>
            </div>
            <p
              v-if="recipient.kind === 'team'"
              class="text-xs text-muted-foreground"
            >
              {{ $t("awards.composer.team_fans_out") }}
            </p>
          </template>

          <template v-else>
            <!-- Nothing to hand the award to, e.g. a tournament whose roster is
                 still empty. Saying so beats an empty row of choices. -->
            <p
              v-if="!recipientChoices.length"
              class="text-xs text-muted-foreground"
            >
              {{ $t("awards.composer.no_recipients") }}
            </p>
            <AnimatedFilters
              v-else
              :model-value="recipient.kind"
              square
              :options="recipientChoices"
              @update:model-value="(key) => selectRecipientKind(key)"
            />

            <template v-if="recipient.kind === 'player'">
              <select
                v-if="playerOptions"
                :value="recipient.player?.steam_id || ''"
                class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                @change="
                  (e) => {
                    const id = (e.target as HTMLSelectElement).value;
                    recipient.player = id ? { steam_id: id } : null;
                  }
                "
              >
                <option value="">
                  {{ $t("ui_extras.select_player_placeholder") }}
                </option>
                <optgroup
                  v-for="group in playerOptions"
                  :key="group.id"
                  :label="group.name"
                >
                  <option
                    v-for="p in group.players"
                    :key="p.steam_id"
                    :value="p.steam_id"
                  >
                    {{ p.name }}
                  </option>
                </optgroup>
              </select>
              <PlayerSearch
                v-else
                :label="$t('ui_extras.select_player_placeholder')"
                :selected="recipient.player"
                @selected="(p) => (recipient.player = p)"
              />
            </template>

            <template v-else-if="recipient.kind === 'team'">
              <select
                v-if="teamOptions"
                :value="recipient.team?.id || ''"
                class="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                @change="
                  (e) => {
                    const id = (e.target as HTMLSelectElement).value;
                    const found = teamOptions?.find((o) => o.team_id === id);
                    recipient.team = found
                      ? { id: found.team_id, name: found.name }
                      : null;
                  }
                "
              >
                <option value="">
                  {{ $t("ui_extras.select_team_placeholder") }}
                </option>
                <option
                  v-for="option in teamOptions"
                  :key="option.id"
                  :value="option.team_id"
                >
                  {{ option.name }}
                </option>
              </select>
              <TeamSearch
                v-else
                :label="$t('ui_extras.select_team_placeholder')"
                :model-value="recipient.team?.id ?? ''"
                @selected="(t) => (recipient.team = t)"
              />
              <p class="text-xs text-muted-foreground">
                {{ $t("awards.composer.team_fans_out") }}
              </p>
            </template>
          </template>

          <label v-if="recipient.kind !== 'none'" class="flex flex-col gap-1.5">
            <span class="text-sm font-medium">{{
              $t("pages.awards.note")
            }}</span>
            <Input v-model="note" maxlength="140" />
          </label>
        </div>

        <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
      </div>

      <div
        class="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-4"
      >
        <span class="truncate text-xs text-muted-foreground">
          <template v-if="recipientLabel">
            &rarr; {{ recipientLabel }}
          </template>
        </span>
        <div class="flex items-center gap-2">
          <Button variant="outline" @click="emit('update:open', false)">
            {{ $t("common.cancel") }}
          </Button>
          <Button :disabled="!canSave" @click="submit">
            {{ saving ? $t("common.saving") : $t("common.save") }}
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>

  <AwardPickerDialog
    v-model:open="pickerOpen"
    :awards="awards"
    :selected="draft.id"
    :can-create="false"
    @select="onPicked"
  />
</template>
