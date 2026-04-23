<script lang="ts">
import TrophyBadge from "~/components/trophy/TrophyBadge.vue";
import AvatarUpload from "~/components/AvatarUpload.vue";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { $ } from "~/generated/zeus";

const SILHOUETTE_OPTIONS = [
  { value: null, label: "Auto" },
  { value: 0, label: "Chalice" },
  { value: 1, label: "Faceted" },
  { value: 2, label: "Star" },
  { value: 3, label: "Shield" },
  { value: 4, label: "Laurel" },
];

const FRAME_CLASSES =
  "relative overflow-hidden rounded-lg border border-border px-6 py-6 [background:linear-gradient(180deg,hsl(var(--card)_/_0.7)_0%,hsl(var(--card)_/_0.35)_100%)] [backdrop-filter:blur(6px)] before:pointer-events-none before:absolute before:left-2 before:top-2 before:h-[14px] before:w-[14px] before:border-l-2 before:border-t-2 before:border-[hsl(var(--tac-amber))] before:content-[''] after:pointer-events-none after:absolute after:bottom-2 after:right-2 after:h-[14px] after:w-[14px] after:border-b-2 after:border-r-2 after:border-[hsl(var(--tac-amber))] after:content-['']";

export default {
  components: { TrophyBadge, AvatarUpload, Input, Button, Switch },
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      placements: [0, 1, 2, 3],
      silhouetteOptions: SILHOUETTE_OPTIONS,
      frameClasses: FRAME_CLASSES,
      drafts: {
        0: { custom_name: "", silhouette: null as number | null },
        1: { custom_name: "", silhouette: null as number | null },
        2: { custom_name: "", silhouette: null as number | null },
        3: { custom_name: "", silhouette: null as number | null },
      },
      saving: { 0: false, 1: false, 2: false, 3: false } as Record<
        number,
        boolean
      >,
      savingEnabled: false,
    };
  },
  computed: {
    isOrganizer() {
      return !!this.tournament.is_organizer;
    },
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
  },
  watch: {
    "tournament.trophy_configs": {
      handler() {
        this.syncDrafts();
      },
      immediate: true,
      deep: true,
    },
  },
  methods: {
    placementLabel(p: number) {
      if (p === 0) return "MVP";
      if (p === 1) return "1st Place";
      if (p === 2) return "2nd Place";
      if (p === 3) return "3rd Place";
      return `#${p}`;
    },
    tierColor(p: number) {
      if (p === 0) return "hsl(195 85% 60%)";
      if (p === 1) return "hsl(45 95% 60%)";
      if (p === 2) return "hsl(0 0% 78%)";
      return "hsl(28 70% 52%)";
    },
    configFor(placement: number) {
      return (this.tournament.trophy_configs || []).find(
        (c: any) => c.placement === placement,
      );
    },
    imageUrlFor(placement: number): string | null {
      const cfg = this.configFor(placement);
      if (!cfg?.image_url) return null;
      const filename = String(cfg.image_url).replace(/^trophies\//, "");
      return `https://${this.apiDomain}/trophies/${filename}`;
    },
    hasImage(placement: number): boolean {
      return !!this.configFor(placement)?.image_url;
    },
    uploadUrl(placement: number): string {
      return `https://${this.apiDomain}/trophies/${this.tournament.id}/${placement}`;
    },
    syncDrafts() {
      for (const p of this.placements) {
        const existing = this.configFor(p);
        this.drafts[p as 0 | 1 | 2 | 3] = {
          custom_name: existing?.custom_name || "",
          silhouette: existing?.silhouette ?? null,
        };
      }
    },
    async save(placement: 0 | 1 | 2 | 3) {
      this.saving[placement] = true;
      try {
        const draft = this.drafts[placement];
        const existing = this.configFor(placement);
        const custom_name = draft.custom_name.trim() || null;
        const silhouette =
          draft.silhouette != null && draft.silhouette >= 0
            ? draft.silhouette
            : null;

        if (existing) {
          const hasImage = !!existing.image_url;
          if (!hasImage && custom_name == null && silhouette == null) {
            await this.$apollo.mutate({
              mutation: typedGql("mutation")({
                delete_tournament_trophy_configs_by_pk: [
                  { id: $("id", "uuid!") },
                  { id: true },
                ],
              }),
              variables: { id: existing.id },
            });
          } else {
            await this.$apollo.mutate({
              mutation: typedGql("mutation")({
                update_tournament_trophy_configs_by_pk: [
                  {
                    pk_columns: { id: $("id", "uuid!") },
                    _set: {
                      custom_name: $("custom_name", "String"),
                      silhouette: $("silhouette", "Int"),
                    },
                  },
                  { id: true },
                ],
              }),
              variables: {
                id: existing.id,
                custom_name,
                silhouette,
              },
            });
          }
        } else if (custom_name != null || silhouette != null) {
          await this.$apollo.mutate({
            mutation: typedGql("mutation")({
              insert_tournament_trophy_configs_one: [
                {
                  object: {
                    tournament_id: $("tournament_id", "uuid!"),
                    placement: $("placement", "Int!"),
                    custom_name: $("custom_name", "String"),
                    silhouette: $("silhouette", "Int"),
                  },
                },
                { id: true },
              ],
            }),
            variables: {
              tournament_id: this.tournament.id,
              placement,
              custom_name,
              silhouette,
            },
          });
        }
      } catch (err) {
        console.error("Failed to save trophy config", err);
      } finally {
        this.saving[placement] = false;
      }
    },
    resetDraft(placement: 0 | 1 | 2 | 3) {
      this.drafts[placement] = { custom_name: "", silhouette: null };
      this.save(placement);
    },
    async toggleEnabled(next: boolean) {
      this.savingEnabled = true;
      try {
        await this.$apollo.mutate({
          mutation: typedGql("mutation")({
            update_tournaments_by_pk: [
              {
                pk_columns: { id: $("id", "uuid!") },
                _set: { trophies_enabled: $("trophies_enabled", "Boolean!") },
              },
              { id: true, trophies_enabled: true },
            ],
          }),
          variables: { id: this.tournament.id, trophies_enabled: next },
        });
      } catch (err) {
        console.error("Failed to toggle trophies_enabled", err);
      } finally {
        this.savingEnabled = false;
      }
    },
  },
};
</script>

<template>
  <section :class="frameClasses">
    <header class="relative mb-6 flex flex-col gap-1">
      <div
        class="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground"
      >
        <span
          class="translate-y-[-1px] text-[0.7rem] text-[hsl(var(--tac-amber))]"
          >◢</span
        >
        Trophy Configuration
      </div>
      <div
        class="font-mono text-[0.62rem] uppercase tracking-[0.3em] text-muted-foreground/70"
      >
        ▚ UPLOAD AN IMAGE OR CUSTOMIZE THE DEFAULT AWARD
      </div>
    </header>

    <div
      v-if="!isOrganizer"
      class="rounded-sm border border-dashed border-border px-4 py-6 text-center font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground"
    >
      ORGANIZER ACCESS REQUIRED
    </div>

    <template v-else>
      <div
        class="mb-4 flex items-center justify-between rounded-sm border border-border/60 bg-background/40 px-4 py-3"
      >
        <div class="flex flex-col gap-1">
          <span
            class="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
          >
            AWARD TROPHIES
          </span>
          <span
            class="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground"
          >
            Disable to skip / clear auto-awarded trophies for this tournament.
            Manual awards stay.
          </span>
        </div>
        <Switch
          :model-value="tournament.trophies_enabled !== false"
          :disabled="savingEnabled"
          @update:model-value="toggleEnabled"
        />
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="p in placements"
          :key="p"
          class="relative flex flex-col gap-4 rounded-sm border border-border/60 bg-background/40 p-4"
        >
          <span
            class="pointer-events-none absolute inset-x-4 top-0 h-[2px]"
            :style="{
              background: `linear-gradient(90deg, transparent, ${tierColor(p)}, transparent)`,
            }"
          ></span>

          <div class="flex items-center justify-between">
            <div
              class="rounded-sm border px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.22em]"
              :style="{
                borderColor: tierColor(p) + '55',
                background: tierColor(p) + '12',
                color: tierColor(p),
              }"
            >
              {{ placementLabel(p) }}
            </div>
            <span
              v-if="hasImage(p)"
              class="font-mono text-[0.55rem] uppercase tracking-[0.22em] text-[hsl(var(--tac-amber))]"
            >
              CUSTOM
            </span>
          </div>

          <!-- Live preview -->
          <div
            class="relative flex items-center justify-center overflow-hidden rounded-sm border border-border/40 bg-background/40 py-3"
          >
            <div
              class="pointer-events-none absolute inset-x-6 bottom-0 h-2/3 blur-2xl"
              :style="{
                background: `radial-gradient(ellipse at center bottom, ${tierColor(p)} 0%, transparent 65%)`,
                opacity: 0.35,
              }"
              aria-hidden="true"
            ></div>
            <TrophyBadge
              :tournament-id="tournament.id"
              :placement="p"
              :tournament-name="tournament.name"
              :tournament-start="tournament.start"
              :custom-name="drafts[p].custom_name || null"
              :silhouette-override="drafts[p].silhouette"
              :image-url="configFor(p)?.image_url || null"
              size="md"
              :interactive="false"
              class="relative z-[1]"
            />
          </div>

          <!-- Image upload (always visible) -->
          <div class="flex flex-col gap-1.5">
            <label
              class="inline-flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
            >
              <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]"></span>
              Custom Image
            </label>
            <AvatarUpload
              variant="dropzone"
              :upload-url="uploadUrl(p)"
              :delete-url="uploadUrl(p)"
              :has-custom="hasImage(p)"
              :current-src="imageUrlFor(p)"
            />
          </div>

          <!-- Name + silhouette only when no custom image is set -->
          <template v-if="!hasImage(p)">
            <div class="flex flex-col gap-1.5">
              <label
                class="inline-flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]"></span>
                Custom Name
              </label>
              <Input
                v-model="drafts[p].custom_name"
                :placeholder="tournament.name"
                maxlength="40"
                class="h-8 font-mono text-xs"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label
                class="inline-flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground"
              >
                <span class="h-[2px] w-2 bg-[hsl(var(--tac-amber))]"></span>
                Silhouette
              </label>
              <div class="grid grid-cols-3 gap-1">
                <button
                  v-for="opt in silhouetteOptions"
                  :key="opt.label"
                  type="button"
                  class="rounded-sm border px-2 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] transition-colors duration-150"
                  :class="
                    drafts[p].silhouette === opt.value
                      ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)_/_0.12)] text-[hsl(var(--tac-amber))]'
                      : 'border-border bg-background/40 text-muted-foreground hover:text-foreground'
                  "
                  @click="drafts[p].silhouette = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2 border-t border-border/60 pt-3">
              <Button
                size="sm"
                class="flex-1"
                :disabled="saving[p]"
                @click="save(p as 0 | 1 | 2 | 3)"
              >
                {{ saving[p] ? "Saving…" : "Save" }}
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="saving[p]"
                @click="resetDraft(p as 0 | 1 | 2 | 3)"
              >
                Reset
              </Button>
            </div>
          </template>

          <div
            v-else
            class="rounded-sm border border-border/60 bg-background/40 px-3 py-2 text-center font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground"
          >
            Remove image to customize name or silhouette
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
