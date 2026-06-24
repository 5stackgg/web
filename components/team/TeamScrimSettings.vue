<script lang="ts">
import { $, order_by } from "~/generated/zeus";
import mapLabel from "~/utilities/mapLabel";
import { typedGql } from "~/generated/zeus/typedDocumentNode";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { mapFields } from "~/graphql/mapGraphql";
import { ELO_MAX, eloMin, eloMax } from "~/utilities/scrimElo";
import ScrimRegionPicker from "~/components/team/ScrimRegionPicker.vue";
import ScrimEloRange from "~/components/team/ScrimEloRange.vue";
import TeamScrimAvailabilityGrid from "~/components/team/TeamScrimAvailabilityGrid.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";

export default {
  components: {
    Input,
    Textarea,
    Switch,
    ScrimRegionPicker,
    ScrimEloRange,
    TeamScrimAvailabilityGrid,
    SettingsSaveBar,
  },
  props: {
    teamId: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      submitting: false,
      hydrating: false,
      formDirty: false,
      availabilityDirty: false,
      form: {
        enabled: false,
        regions: [] as string[],
        map_ids: [] as string[],
        notes: "",
        allow_outside_availability: false,
      },
      eloRange: [0, ELO_MAX],
      loaded: null as any,
      mapOptions: [] as Array<any>,
      editingMaps: false,
      mapSearch: "",
      mapFilters: {
        official: true,
        workshop: false,
        activeDuty: false,
      },
      sectionLabel:
        "text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--tac-amber))]",
    };
  },
  computed: {
    isDirty(): boolean {
      return this.formDirty || this.availabilityDirty;
    },
    mapsById() {
      const byId: Record<string, any> = {};
      for (const map of this.mapOptions) {
        byId[map.id] = map;
      }
      return byId;
    },
    selectedMaps() {
      return this.form.map_ids
        .map((id) => this.mapsById[id])
        .filter((map) => Boolean(map));
    },
    filteredMaps() {
      const query = this.mapSearch.trim().toLowerCase();
      return this.mapOptions.filter((map) => {
        if (!map.patch) {
          return false;
        }
        const isWorkshop = Boolean(map.workshop_map_id);
        const typeOk =
          (this.mapFilters.official && !isWorkshop) ||
          (this.mapFilters.workshop && isWorkshop);
        if (!typeOk) {
          return false;
        }
        if (this.mapFilters.activeDuty && !map.active_pool) {
          return false;
        }
        if (
          query &&
          !`${map.label ?? ""} ${map.name ?? ""}`.toLowerCase().includes(query)
        ) {
          return false;
        }
        return true;
      });
    },
  },
  watch: {
    form: {
      deep: true,
      handler() {
        if (!this.hydrating) {
          this.formDirty = true;
        }
      },
    },
    eloRange: {
      deep: true,
      handler() {
        if (!this.hydrating) {
          this.formDirty = true;
        }
      },
    },
  },
  apollo: {
    $subscribe: {
      team_scrim_settings: {
        query: typedGql("subscription")({
          team_scrim_settings: [
            { where: { team_id: { _eq: $("teamId", "uuid!") } } },
            {
              id: true,
              enabled: true,
              regions: true,
              map_ids: true,
              notes: true,
              elo_min: true,
              elo_max: true,
              allow_outside_availability: true,
            },
          ],
        }),
        variables() {
          return { teamId: this.teamId };
        },
        result({ data }) {
          const settings = data.team_scrim_settings?.at(0);
          this.loaded = {
            enabled: settings?.enabled ?? false,
            regions: settings?.regions ?? [],
            map_ids: settings?.map_ids ?? [],
            notes: settings?.notes ?? "",
            elo_min: settings?.elo_min ?? null,
            elo_max: settings?.elo_max ?? null,
            allow_outside_availability:
              settings?.allow_outside_availability ?? false,
          };
          if (this.isDirty) {
            return;
          }
          this.applyLoaded();
        },
      },
    },
  },
  mounted() {
    this.loadMaps();
  },
  methods: {
    setHydrated(mutator: () => void) {
      this.hydrating = true;
      mutator();
      this.$nextTick(() => {
        this.hydrating = false;
      });
    },
    defaultMapIds(): string[] {
      return this.mapOptions
        .filter((map) => map.active_pool && map.patch)
        .map((map) => map.id);
    },
    applyLoaded() {
      if (!this.loaded) {
        return;
      }
      this.setHydrated(() => {
        const mapIds = this.loaded.map_ids.length
          ? [...this.loaded.map_ids]
          : this.defaultMapIds();
        this.form = {
          enabled: this.loaded.enabled,
          regions: [...this.loaded.regions],
          map_ids: mapIds,
          notes: this.loaded.notes,
          allow_outside_availability: this.loaded.allow_outside_availability,
        };
        this.eloRange = [
          this.loaded.elo_min ?? 0,
          this.loaded.elo_max ?? ELO_MAX,
        ];
      });
    },
    async loadMaps() {
      const { data } = await this.$apollo.query({
        query: typedGql("query")({
          maps: [
            {
              where: { type: { _eq: "Competitive" } },
              order_by: [{ name: order_by.asc }],
            },
            mapFields,
          ],
        }),
      });
      this.mapOptions = data.maps ?? [];

      if (
        this.loaded &&
        this.loaded.map_ids.length === 0 &&
        this.form.map_ids.length === 0 &&
        !this.formDirty
      ) {
        this.setHydrated(() => {
          this.form.map_ids = this.defaultMapIds();
        });
      }
    },
    discard() {
      this.applyLoaded();
      this.availabilityDirty = false;
      (this.$refs.availabilityGrid as any)?.reset();
      this.$nextTick(() => {
        this.formDirty = false;
      });
    },
    onAvailabilityChange() {
      this.availabilityDirty = true;
    },
    toggleMap(mapId: string) {
      const index = this.form.map_ids.indexOf(mapId);
      if (index === -1) {
        this.form.map_ids.push(mapId);
      } else {
        this.form.map_ids.splice(index, 1);
      }
    },
    cleanName(map: any): string {
      return mapLabel(map);
    },
    async save() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        await this.$apollo.mutate({
          mutation: generateMutation({
            insert_team_scrim_settings_one: [
              {
                object: {
                  team_id: this.teamId,
                  enabled: this.form.enabled,
                  regions: this.form.regions,
                  map_ids: this.form.map_ids,
                  notes: this.form.notes,
                  allow_outside_availability:
                    this.form.allow_outside_availability,
                  elo_min: eloMin(this.eloRange),
                  elo_max: eloMax(this.eloRange),
                },
                on_conflict: {
                  constraint: "team_scrim_settings_team_id_key",
                  update_columns: [
                    "enabled",
                    "regions",
                    "map_ids",
                    "notes",
                    "allow_outside_availability",
                    "elo_min",
                    "elo_max",
                  ],
                },
              },
              { id: true },
            ],
          }),
        });

        await (this.$refs.availabilityGrid as any)?.save();

        this.availabilityDirty = false;
        this.formDirty = false;
        toast({ title: this.$t("scrim.settings_saved") });
      } catch (error) {
        toast({ title: this.$t("scrim.settings_save_error"), variant: "destructive" });
        throw error;
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>

<template>
  <div class="space-y-7">
    <div
      role="button"
      tabindex="0"
      class="flex cursor-pointer select-none items-center justify-between gap-4 rounded-md border p-4 transition-colors"
      :class="
        form.enabled
          ? 'border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.07)]'
          : 'border-border bg-muted/30'
      "
      @click="form.enabled = !form.enabled"
      @keydown.enter.prevent="form.enabled = !form.enabled"
      @keydown.space.prevent="form.enabled = !form.enabled"
    >
      <div>
        <div
          class="text-[0.7rem] font-semibold uppercase tracking-[0.2em]"
          :class="
            form.enabled ? 'text-[hsl(var(--tac-amber))]' : 'text-muted-foreground'
          "
        >
          {{ form.enabled ? $t("scrim.open_to_scrims") : $t("scrim.closed") }}
        </div>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ $t("scrim.discoverable_help") }}
        </p>
      </div>
      <Switch v-model="form.enabled" @click.stop />
    </div>

    <section class="space-y-4">
      <div class="flex items-center gap-3">
        <span :class="sectionLabel">{{ $t("scrim.regions_section") }}</span>
        <span class="h-px flex-1 bg-border" />
      </div>
      <ScrimRegionPicker
        v-model:regions="form.regions"
        :empty-text="$t('scrim.no_regions_available')"
      />
    </section>

    <section class="space-y-3">
      <div class="flex items-center gap-3">
        <span :class="sectionLabel">{{ $t("scrim.maps_section") }}</span>
        <span class="h-px flex-1 bg-border" />
        <button
          type="button"
          class="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
          @click="editingMaps = !editingMaps"
        >
          {{ editingMaps ? $t("common.done") : $t("common.edit") }}
        </button>
      </div>

      <div
        class="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/40 p-3"
      >
        <div
          v-for="map in selectedMaps"
          :key="map.id"
          class="flex items-center gap-1.5 rounded border border-border bg-background/60 px-2 py-1"
          :title="cleanName(map)"
        >
          <img
            v-if="map.patch"
            :src="map.patch"
            :alt="cleanName(map)"
            class="h-6 w-6 object-contain"
          />
          <span class="text-xs">{{ cleanName(map) }}</span>
        </div>
        <span
          v-if="selectedMaps.length === 0"
          class="text-sm text-muted-foreground"
        >
          {{ $t("scrim.no_maps_selected") }}
        </span>
      </div>

      <div
        v-if="editingMaps"
        class="space-y-3 rounded-md border border-border bg-card/40 p-3"
      >
        <div class="flex flex-wrap items-center gap-2">
          <Input
            v-model="mapSearch"
            :placeholder="$t('scrim.search_maps')"
            class="h-8 w-full sm:w-56"
          />
          <button
            type="button"
            class="rounded-md border px-3 py-1.5 text-xs transition-colors"
            :class="
              mapFilters.official
                ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                : 'border-border text-muted-foreground hover:bg-muted/40'
            "
            @click="mapFilters.official = !mapFilters.official"
          >
            {{ $t("scrim.official") }}
          </button>
          <button
            type="button"
            class="rounded-md border px-3 py-1.5 text-xs transition-colors"
            :class="
              mapFilters.workshop
                ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                : 'border-border text-muted-foreground hover:bg-muted/40'
            "
            @click="mapFilters.workshop = !mapFilters.workshop"
          >
            {{ $t("scrim.workshop") }}
          </button>
          <button
            type="button"
            class="rounded-md border px-3 py-1.5 text-xs transition-colors"
            :class="
              mapFilters.activeDuty
                ? 'border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] text-[hsl(var(--tac-amber))]'
                : 'border-border text-muted-foreground hover:bg-muted/40'
            "
            @click="mapFilters.activeDuty = !mapFilters.activeDuty"
          >
            {{ $t("scrim.active_duty") }}
          </button>
        </div>

        <div class="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          <button
            v-for="map in filteredMaps"
            :key="map.id"
            type="button"
            class="flex flex-col items-center gap-1 rounded-md border p-2 transition-all"
            :class="
              form.map_ids.includes(map.id)
                ? 'border-[hsl(var(--tac-amber)/0.6)] bg-[hsl(var(--tac-amber)/0.1)]'
                : 'border-border opacity-70 hover:opacity-100'
            "
            @click="toggleMap(map.id)"
          >
            <img
              :src="map.patch"
              :alt="cleanName(map)"
              class="h-10 w-10 object-contain"
            />
            <span class="w-full truncate text-center text-[0.65rem]">
              {{ cleanName(map) }}
            </span>
          </button>
          <p
            v-if="filteredMaps.length === 0"
            class="col-span-full py-4 text-center text-sm text-muted-foreground"
          >
            {{ $t("scrim.no_maps_match") }}
          </p>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <div class="flex items-center gap-3">
        <span :class="sectionLabel">{{ $t("scrim.accepted_elo_range") }}</span>
        <span class="h-px flex-1 bg-border" />
      </div>
      <ScrimEloRange v-model="eloRange" :label="$t('scrim.fivestack_elo')" />
    </section>

    <section class="space-y-4">
      <div class="flex items-center gap-3">
        <span :class="sectionLabel">{{ $t("scrim.weekly_availability") }}</span>
        <span class="h-px flex-1 bg-border" />
      </div>
      <TeamScrimAvailabilityGrid
        ref="availabilityGrid"
        :team-id="teamId"
        @change="onAvailabilityChange"
      />

      <label
        class="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-card/40 p-3"
      >
        <span class="flex flex-col gap-0.5">
          <span class="text-sm font-medium">{{ $t("scrim.allow_outside_hours") }}</span>
          <span class="text-xs text-muted-foreground">
            {{ $t("scrim.outside_hours_help") }}
          </span>
        </span>
        <Switch v-model="form.allow_outside_availability" />
      </label>
    </section>

    <section class="space-y-4">
      <div class="flex items-center gap-3">
        <span :class="sectionLabel">{{ $t("scrim.notes_section") }}</span>
        <span class="h-px flex-1 bg-border" />
      </div>
      <Textarea
        v-model="form.notes"
        :placeholder="$t('scrim.notes_placeholder')"
      />
    </section>

    <SettingsSaveBar
      :dirty="isDirty"
      :submitting="submitting"
      @save="save"
      @discard="discard"
    />
  </div>
</template>
