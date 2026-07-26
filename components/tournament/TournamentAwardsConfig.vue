<script lang="ts">
import AwardBadge from "~/components/award/AwardBadge.vue";
import AwardPickerDialog from "~/components/award/AwardPickerDialog.vue";
import ImageUploadTile from "~/components/ImageUploadTile.vue";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import ManageSection from "~/components/common/ManageSection.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $, order_by } from "~/generated/zeus";
import { awardDefinitionFields } from "~/graphql/awardFields";
import {
  TIER_PALETTES,
  placementToTier,
  resolveTournamentAward,
} from "~/utilities/awardSeed";
import { ImageUp, RotateCcw } from "lucide-vue-next";

const SILHOUETTE_KEYS = ["auto", "0", "1", "2", "3", "4"];

type Placement = 0 | 1 | 2 | 3;

const emptyDraft = () => ({
  award_id: "",
  custom_name: "",
  silhouette: null as number | null,
});

export default {
  components: {
    AwardBadge,
    AwardPickerDialog,
    ImageUploadTile,
    Input,
    Button,
    Switch,
    ManageSection,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    ImageUp,
    RotateCcw,
  },
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      awards: [] as any[],
      placements: [0, 1, 2, 3] as Placement[],
      drafts: {
        0: emptyDraft(),
        1: emptyDraft(),
        2: emptyDraft(),
        3: emptyDraft(),
      } as Record<Placement, ReturnType<typeof emptyDraft>>,
      saving: { 0: false, 1: false, 2: false, 3: false } as Record<
        number,
        boolean
      >,
      savingEnabled: false,
      pickerFor: null as Placement | null,
      uploadFor: null as Placement | null,
    };
  },
  apollo: {
    awards: {
      fetchPolicy: "cache-and-network",
      query: typedGql("query")({
        awards: [{ order_by: [{ name: order_by.asc }] }, awardDefinitionFields],
      }),
    },
  },
  computed: {
    isOrganizer() {
      return !!this.tournament.is_organizer;
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    canCreateAwards() {
      return useApplicationSettingsStore().canManageAwards;
    },
    silhouetteKeys() {
      return SILHOUETTE_KEYS;
    },
  },
  watch: {
    "tournament.award_configs": {
      handler() {
        this.syncDrafts();
      },
      immediate: true,
      deep: true,
    },
  },
  methods: {
    placementLabel(p: number) {
      if (p === 0) return this.$t("awards.mvp");
      if (p === 1) return this.$t("awards.first_place");
      if (p === 2) return this.$t("awards.second_place");
      if (p === 3) return this.$t("awards.third_place");
      return `#${p}`;
    },
    tierColor(p: number) {
      return TIER_PALETTES[placementToTier(p)].primary;
    },
    configFor(placement: number) {
      return (this.tournament.award_configs || []).find(
        (c: any) => c.placement === placement,
      );
    },
    awardFor(placement: number) {
      return resolveTournamentAward(
        this.awards,
        placement,
        this.drafts[placement as Placement].award_id,
      );
    },
    fallbackAwardFor(placement: number) {
      return resolveTournamentAward(this.awards, placement, null);
    },
    // Only the tournament's own upload: this feeds the upload control, which
    // must not present the resolved award's art as though it were an override.
    overrideImage(placement: number): string | null {
      const source = this.configFor(placement)?.image_url;
      if (!source) return null;
      const filename = String(source).replace(/^(awards|trophies)\//, "");
      return `https://${this.apiDomain}/avatars/awards/${filename}`;
    },
    hasOverrideImage(placement: number): boolean {
      return !!this.configFor(placement)?.image_url;
    },
    // Silhouette only shapes the procedural trophy, so it is meaningless once
    // any real image is in play — the tournament's own or the award's.
    usesArtwork(placement: number): boolean {
      return (
        this.hasOverrideImage(placement) ||
        !!this.awardFor(placement)?.image_url
      );
    },
    /** What gets engraved when the name is left blank. */
    effectiveName(placement: number): string {
      return String(this.placementLabel(placement));
    },
    awardLabel(placement: number): string {
      const award = this.awardFor(placement);
      if (!this.drafts[placement as Placement].award_id) {
        const label = this.$t("tournament.awards_config.award_default");
        return award?.name ? `${label} · ${award.name}` : String(label);
      }
      return award?.name || String(this.$t("tournament.awards_config.award"));
    },
    silhouetteKey(placement: number): string {
      const value = this.drafts[placement as Placement].silhouette;
      return value === null || value === undefined ? "auto" : String(value);
    },
    setSilhouette(placement: Placement, key: string) {
      this.drafts[placement].silhouette = key === "auto" ? null : Number(key);
    },
    isDirty(placement: number): boolean {
      const draft = this.drafts[placement as Placement];
      const existing = this.configFor(placement);
      return (
        (draft.award_id || "") !== (existing?.award_id || "") ||
        (draft.custom_name || "") !== (existing?.custom_name || "") ||
        (draft.silhouette ?? null) !== (existing?.silhouette ?? null)
      );
    },
    syncDrafts() {
      for (const p of this.placements) {
        const existing = this.configFor(p);
        this.drafts[p] = {
          award_id: existing?.award_id || "",
          custom_name: existing?.custom_name || "",
          silhouette: existing?.silhouette ?? null,
        };
      }
    },
    onAwardSelected(placement: Placement, awardId: string) {
      this.drafts[placement].award_id = awardId;
      this.save(placement);
    },
    async onAwardCreated() {
      await this.$apollo.queries.awards.refetch();
    },
    async save(placement: Placement) {
      this.saving[placement] = true;
      try {
        const draft = this.drafts[placement];
        await this.$apollo.mutate({
          mutation: typedGql("mutation")({
            setTournamentAward: [
              {
                tournament_id: $("tournament_id", "uuid!"),
                placement: $("placement", "Int!"),
                award_id: $("award_id", "uuid"),
                custom_name: $("custom_name", "String"),
                silhouette: $("silhouette", "Int"),
              },
              { id: true, award_id: true, custom_name: true, silhouette: true },
            ],
          }),
          variables: {
            tournament_id: this.tournament.id,
            placement,
            award_id: draft.award_id || null,
            custom_name: draft.custom_name.trim() || null,
            silhouette:
              draft.silhouette != null && draft.silhouette >= 0
                ? draft.silhouette
                : null,
          },
        });
      } catch (error) {
        console.error("Failed to save tournament award", error);
      } finally {
        this.saving[placement] = false;
      }
    },
    // Reset returns the placement to the app default, which means dropping the
    // tournament's uploaded artwork too — setTournamentAward only clears the
    // award link, name and silhouette, so the image would otherwise survive and
    // the placement would still not look like the default.
    async resetDraft(placement: Placement) {
      this.saving[placement] = true;
      try {
        if (this.hasOverrideImage(placement)) {
          const response = await fetch(this.uploadUrl(placement), {
            method: "DELETE",
            credentials: "include",
          });
          if (!response.ok) {
            throw new Error(`Failed to remove artwork (${response.status})`);
          }
        }
      } catch (error) {
        console.error("Failed to reset tournament award artwork", error);
        this.saving[placement] = false;
        return;
      }
      this.saving[placement] = false;
      this.drafts[placement] = emptyDraft();
      await this.save(placement);
    },
    async toggleEnabled(next: boolean) {
      this.savingEnabled = true;
      try {
        await this.$apollo.mutate({
          mutation: typedGql("mutation")({
            update_tournaments_by_pk: [
              {
                pk_columns: { id: $("id", "uuid!") },
                _set: { awards_enabled: $("awards_enabled", "Boolean!") },
              },
              { id: true, awards_enabled: true },
            ],
          }),
          variables: { id: this.tournament.id, awards_enabled: next },
        });
      } catch (error) {
        console.error("Failed to toggle awards_enabled", error);
      } finally {
        this.savingEnabled = false;
      }
    },
    uploadUrl(placement: number): string {
      return `https://${this.apiDomain}/avatars/awards/tournament/${this.tournament.id}/${placement}`;
    },
  },
};
</script>

<template>
  <ManageSection
    :label="$t('tournament.awards_config.title')"
    :hint="$t('tournament.awards_config.hint')"
  >
    <template v-if="isOrganizer" #action>
      <Switch
        :model-value="tournament.awards_enabled !== false"
        :disabled="savingEnabled"
        @update:model-value="toggleEnabled"
      />
    </template>

    <div
      v-if="!isOrganizer"
      class="rounded-sm border border-dashed border-border px-4 py-6 text-center font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground"
    >
      {{ $t("tournament.awards_config.organizer_access_required") }}
    </div>

    <!-- Vertical cards: the art gets the card's full width, and everything that
         made the columns ragged (inline dropzone, silhouette strip) now lives in
         the artwork dialog, so all four cards stay the same height. -->
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="p in placements"
        :key="p"
        class="relative flex flex-col overflow-hidden rounded-md border border-border/70 bg-background/30 transition-colors duration-200 hover:border-[hsl(var(--tac-amber)/0.35)]"
      >
        <span
          class="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          :style="{
            background: `linear-gradient(90deg, transparent, ${tierColor(p)}, transparent)`,
          }"
          aria-hidden="true"
        ></span>

        <!-- The specimen fills the card width and doubles as the artwork control -->
        <button
          type="button"
          class="group/art relative flex h-32 items-center justify-center overflow-hidden"
          :title="$t('tournament.awards_config.artwork')"
          @click="uploadFor = p"
        >
          <div
            class="pointer-events-none absolute inset-x-6 bottom-0 top-1/4 opacity-45 blur-2xl transition-opacity duration-200 group-hover/art:opacity-90"
            :style="{
              background: `radial-gradient(ellipse 70% 60% at 50% 100%, ${tierColor(p)} 0%, transparent 70%)`,
            }"
            aria-hidden="true"
          ></div>
          <AwardBadge
            :award="awardFor(p)"
            :seed-key="tournament.id"
            :placement="p"
            :tournament-name="tournament.name"
            :tournament-start="tournament.start"
            :custom-name="drafts[p].custom_name || null"
            :silhouette-override="drafts[p].silhouette"
            :image-url="configFor(p)?.image_url || null"
            size="md"
            :interactive="false"
            :show-name="false"
            class="relative z-[1] transition-transform duration-200 group-hover/art:-translate-y-0.5"
          />
          <span
            class="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-[0.15rem] font-mono text-[0.5rem] uppercase tracking-[0.18em]"
            :style="{
              borderColor: tierColor(p) + '55',
              background: tierColor(p) + '12',
              color: tierColor(p),
            }"
          >
            {{ placementLabel(p) }}
            <span
              v-if="hasOverrideImage(p)"
              class="text-[hsl(var(--tac-amber))]"
              :title="$t('tournament.awards_config.custom')"
              >&#9679;</span
            >
          </span>
        </button>

        <div class="flex flex-1 flex-col gap-2 border-t border-border/60 p-2.5">
          <label class="flex flex-col gap-1">
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
            >
              {{ $t("tournament.awards_config.award") }}
            </span>
            <button
              type="button"
              class="flex h-8 min-w-0 items-center gap-2 rounded-md border border-border bg-muted/30 px-2 text-left transition-colors duration-150 hover:border-[hsl(var(--tac-amber)/0.45)]"
              @click="pickerFor = p"
            >
              <span class="min-w-0 flex-1 truncate text-xs">
                {{ awardLabel(p) }}
              </span>
              <span class="shrink-0 text-[0.6rem] text-muted-foreground"
                >&#9662;</span
              >
            </button>
          </label>

          <label class="flex flex-col gap-1">
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
            >
              {{ $t("tournament.awards_config.custom_name") }}
            </span>
            <Input
              v-model="drafts[p].custom_name"
              :placeholder="effectiveName(p)"
              maxlength="40"
              class="h-8 text-xs"
            />
          </label>

          <div class="mt-auto flex items-center gap-1.5 pt-1">
            <Button
              variant="outline"
              size="sm"
              class="h-8 flex-1 gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em]"
              @click="uploadFor = p"
            >
              <ImageUp class="h-3.5 w-3.5" />
              {{ $t("tournament.awards_config.artwork") }}
            </Button>
            <Button
              v-if="isDirty(p)"
              size="sm"
              class="h-8 px-2.5 font-mono text-[0.6rem] uppercase tracking-[0.16em]"
              :disabled="saving[p]"
              @click="save(p)"
            >
              {{ saving[p] ? $t("common.saving") : $t("common.save") }}
            </Button>
            <button
              type="button"
              class="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-border/70 text-muted-foreground transition-colors duration-150 hover:bg-muted/40 hover:text-foreground disabled:opacity-40"
              :title="$t('tournament.awards_config.reset')"
              :aria-label="$t('tournament.awards_config.reset')"
              :disabled="saving[p]"
              @click="resetDraft(p)"
            >
              <RotateCcw class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <AwardPickerDialog
      v-if="pickerFor !== null"
      :open="pickerFor !== null"
      :awards="awards"
      :selected="drafts[pickerFor].award_id"
      :fallback="fallbackAwardFor(pickerFor)"
      :can-create="canCreateAwards"
      @update:open="(v) => (pickerFor = v ? pickerFor : null)"
      @select="(id) => onAwardSelected(pickerFor as Placement, id)"
      @created="onAwardCreated"
    />

    <Dialog
      :open="uploadFor !== null"
      @update:open="(v) => (uploadFor = v ? uploadFor : null)"
    >
      <DialogContent v-if="uploadFor !== null" class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ $t("tournament.awards_config.artwork") }} ·
            {{ placementLabel(uploadFor) }}
          </DialogTitle>
          <DialogDescription>
            {{ $t("tournament.awards_config.custom_image_hint") }}
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4">
          <!-- Live specimen beside the control, so the effect of an upload or a
               silhouette change is visible without closing the dialog. -->
          <div class="flex items-stretch gap-3">
            <div
              class="relative flex h-40 flex-1 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-background/40"
            >
              <div
                class="pointer-events-none absolute inset-x-6 bottom-0 top-1/4 opacity-45 blur-2xl"
                :style="{
                  background: `radial-gradient(ellipse 70% 60% at 50% 100%, ${tierColor(uploadFor)} 0%, transparent 70%)`,
                }"
                aria-hidden="true"
              ></div>
              <Transition name="specimen" mode="out-in">
                <AwardBadge
                  :key="`${silhouetteKey(uploadFor)}-${configFor(uploadFor)?.image_url || ''}`"
                  :award="awardFor(uploadFor)"
                  :seed-key="tournament.id"
                  :placement="uploadFor"
                  :tournament-name="tournament.name"
                  :tournament-start="tournament.start"
                  :custom-name="drafts[uploadFor].custom_name || null"
                  :silhouette-override="drafts[uploadFor].silhouette"
                  :image-url="configFor(uploadFor)?.image_url || null"
                  size="md"
                  :interactive="false"
                  :show-name="false"
                  class="relative z-[1]"
                />
              </Transition>
            </div>

            <div class="flex w-[9rem] shrink-0 flex-col gap-1.5">
              <span
                class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
              >
                {{ $t("tournament.awards_config.custom_image") }}
              </span>
              <ImageUploadTile
                aspect="square"
                fit="contain"
                allow-bg-removal
                :upload-url="uploadUrl(uploadFor)"
                :delete-url="uploadUrl(uploadFor)"
                :has-custom="hasOverrideImage(uploadFor)"
                :current-src="overrideImage(uploadFor)"
              />
            </div>
          </div>

          <!-- Silhouette only shapes the procedural trophy, so it is pointless
               once any real artwork is in play. A fixed 3-up grid keeps the six
               options from ragged-wrapping. -->
          <div
            v-if="!usesArtwork(uploadFor)"
            class="flex min-h-[5.5rem] flex-col gap-1.5"
          >
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground"
            >
              {{ $t("tournament.awards_config.silhouette") }}
            </span>
            <div class="grid grid-cols-3 gap-1">
              <button
                v-for="key in silhouetteKeys"
                :key="key"
                type="button"
                class="rounded-sm border px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] transition-colors duration-150"
                :class="
                  silhouetteKey(uploadFor) === key
                    ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)/0.12)] text-[hsl(var(--tac-amber))]'
                    : 'border-border bg-background/40 text-muted-foreground hover:text-foreground'
                "
                @click="setSilhouette(uploadFor as Placement, key)"
              >
                {{ $t(`tournament.awards_config.silhouettes.${key}`) }}
              </button>
            </div>
          </div>
          <p
            v-else
            class="flex min-h-[5.5rem] items-center text-xs text-muted-foreground"
          >
            {{ $t("tournament.awards_config.silhouette_unused") }}
          </p>

          <div
            class="flex items-center justify-between gap-3 border-t border-border/60 pt-3"
          >
            <span
              class="font-mono text-[0.55rem] uppercase tracking-[0.2em] transition-opacity duration-200"
              :class="
                isDirty(uploadFor)
                  ? 'text-[hsl(var(--tac-amber))] opacity-100'
                  : 'text-muted-foreground opacity-0'
              "
            >
              {{ $t("tournament.awards_config.unsaved") }}
            </span>
            <Button
              size="sm"
              class="font-mono text-[0.6rem] uppercase tracking-[0.16em]"
              :disabled="saving[uploadFor] || !isDirty(uploadFor)"
              @click="save(uploadFor as Placement)"
            >
              {{ saving[uploadFor] ? $t("common.saving") : $t("common.save") }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </ManageSection>
</template>

<style scoped>
.specimen-enter-active,
.specimen-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.specimen-enter-from,
.specimen-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .specimen-enter-active,
  .specimen-leave-active {
    transition: none;
  }
}
</style>
