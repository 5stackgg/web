<script setup lang="ts">
import { TriangleAlert } from "lucide-vue-next";
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Fold } from "~/components/ui/transitions";
import FiveStackToolTip from "~/components/FiveStackToolTip.vue";
import MatchOptions from "~/components/MatchOptions.vue";
import SettingHeader from "~/components/match/SettingHeader.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
</script>

<template>
  <form @submit.prevent="save" class="grid gap-4">
    <MatchOptions
      :form="form"
      :force-veto="true"
      :hide-best-of="true"
      :hide-match-mode="true"
      :lock-substitutes="true"
      :lock-map-pool="mapPoolLocked"
    >
      <FormField v-slot="{ value, handleChange }" name="negotiated_scheduling">
        <FormItem>
          <div
            class="flex flex-row items-center justify-between cursor-pointer"
            @click="handleChange(!value)"
          >
            <div class="space-y-0.5">
              <SettingHeader>{{
                $t("tournament.form.negotiated_scheduling.label")
              }}</SettingHeader>
              <FormDescription>{{
                $t("tournament.form.negotiated_scheduling.description")
              }}</FormDescription>
            </div>
            <FormControl>
              <Switch
                class="pointer-events-none"
                :model-value="value"
                @update:model-value="handleChange"
              />
            </FormControl>
          </div>
        </FormItem>
      </FormField>

      <FormField
        v-if="!form.values.negotiated_scheduling"
        v-slot="{ value, handleChange }"
        name="auto_start"
      >
        <FormItem>
          <div
            class="flex flex-row items-center justify-between cursor-pointer"
            @click="handleChange(!value)"
          >
            <div class="space-y-0.5">
              <SettingHeader>{{
                $t("tournament.form.auto_start.label")
              }}</SettingHeader>
              <FormDescription>{{
                $t("tournament.form.auto_start.description")
              }}</FormDescription>
            </div>
            <FormControl>
              <Switch
                class="pointer-events-none"
                :model-value="value"
                @update:model-value="handleChange"
              />
            </FormControl>
          </div>
        </FormItem>
      </FormField>

      <FormField
        v-if="form.values.type !== 'Duel'"
        v-slot="{ value, handleChange }"
        name="substitutes_enabled"
      >
        <FormItem>
          <div
            class="flex flex-row items-center justify-between"
            :class="substitutesLocked ? 'cursor-not-allowed' : 'cursor-pointer'"
            @click="!substitutesLocked && handleChange(!value)"
          >
            <div class="space-y-0.5">
              <SettingHeader>{{
                $t("tournament.form.substitutes_enabled.label")
              }}</SettingHeader>
              <FormDescription>{{
                substitutesLocked
                  ? $t("tournament.form.substitutes_enabled.locked")
                  : $t("tournament.form.substitutes_enabled.description")
              }}</FormDescription>
            </div>
            <FormControl>
              <Switch
                class="pointer-events-none"
                :model-value="value"
                :disabled="substitutesLocked"
                @update:model-value="handleChange"
              />
            </FormControl>
          </div>
        </FormItem>
      </FormField>

      <Fold :open="mapPoolLocked">
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{{ $t("tournament.form.map_pool_locked_label") }}</span>
          <FiveStackToolTip as-child :delay-duration="120">
            <template #trigger>
              <span
                class="inline-flex cursor-help text-[hsl(var(--tac-amber))]"
                tabindex="0"
                role="img"
                :aria-label="$t('tournament.form.map_pool_locked')"
                @click.prevent
              >
                <TriangleAlert class="h-3.5 w-3.5" />
              </span>
            </template>
            <p class="max-w-[16rem]">
              {{ $t("tournament.form.map_pool_locked") }}
            </p>
          </FiveStackToolTip>
        </div>
      </Fold>
    </MatchOptions>

    <div class="pb-24"></div>

    <SettingsSaveBar
      :dirty="isDirty"
      :submitting="submitting"
      @save="save"
      @discard="discardChanges"
    />
  </form>
</template>

<script lang="ts">
import { useForm } from "vee-validate";
import { generateMutation, generateQuery } from "~/graphql/graphqlGen";
import { mapFields } from "~/graphql/mapGraphql";
import {
  $,
  e_map_pool_types_enum,
  e_tournament_status_enum,
} from "~/generated/zeus";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { toast } from "@/components/ui/toast";
import {
  setupOptions,
  setupOptionsVariables,
  setupOptionsSetMutation,
} from "~/utilities/setupOptions";
import { isTournamentBracketDrawn } from "~/utilities/tournamentBracketDrawn";
import * as z from "zod";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
    },
  },
  inject: {
    refetchTournamentStatic: {
      default: () => () => {},
    },
  },
  apollo: {
    map_pools: {
      query: generateQuery({
        map_pools: [
          {
            where: {
              enabled: { _eq: true },
              seed: { _eq: true },
            },
          },
          {
            id: true,
            type: true,
            maps: [{}, mapFields],
          },
        ],
      }),
    },
  },
  data() {
    return {
      submitting: false,
      baseline: null as string | null,
      isDirty: false,
      form: useForm({
        keepValuesOnUnmount: true,
        validationSchema: toTypedSchema(
          matchOptionsValidator(
            this,
            {
              auto_start: z.boolean().default(true),
              negotiated_scheduling: z.boolean().default(false),
              substitutes_enabled: z.boolean().default(true),
            },
            useApplicationSettingsStore().settings,
          ),
        ),
      }),
    };
  },
  watch: {
    tournament: {
      immediate: true,
      handler() {
        if (this.baseline === null || !this.isDirty) {
          this.populate();
        }
      },
    },
    ["form.values"]: {
      deep: true,
      handler() {
        this.isDirty =
          this.baseline !== null &&
          JSON.stringify(this.form.values) !== this.baseline;
      },
    },
    map_pools: {
      handler() {
        this.takeSnapshot();
      },
    },
    isDefaultMapPool: {
      immediate: true,
      handler(isDefaultMapPool) {
        if (isDefaultMapPool) {
          return;
        }
        this.form.setValues({
          custom_map_pool: true,
          map_pool_id: this.tournament?.options.map_pool.id,
          map_pool: this.tournament?.options.map_pool.maps.map(({ id }) => id),
        });
      },
    },
  },
  computed: {
    mapPoolLocked() {
      return isTournamentBracketDrawn(this.tournament);
    },
    substitutesLocked() {
      return (
        this.tournament.substitutes_enabled &&
        ![
          e_tournament_status_enum.Setup,
          e_tournament_status_enum.RegistrationOpen,
        ].includes(this.tournament.status)
      );
    },
    defaultMapPool() {
      return this.map_pools?.find((pool) => {
        return pool.type === this.form.values.type;
      });
    },
    isDefaultMapPool() {
      if (!this.defaultMapPool) {
        return true;
      }
      return this.defaultMapPool.id === this.tournament.options.map_pool.id;
    },
  },
  methods: {
    populate() {
      this.form.setValues({
        map_veto: true,
        auto_start: this.tournament.auto_start,
        negotiated_scheduling: this.tournament.scheduling_mode === "negotiated",
        substitutes_enabled: this.tournament.substitutes_enabled,
      });

      setupOptions(this.form, this.tournament.options);

      if (this.defaultMapPool) {
        const pool = this.tournament.options.map_pool;
        if (this.defaultMapPool.id === pool.id) {
          this.form.setValues({ custom_map_pool: false });
        } else {
          this.form.setValues({
            custom_map_pool: true,
            map_pool_id: pool.id,
            map_pool: pool.maps.map(({ id }: { id: string }) => id),
          });
        }
      }

      this.takeSnapshot();
    },
    takeSnapshot() {
      this.$nextTick(() => {
        this.baseline = JSON.stringify(this.form.values);
        this.isDirty = false;
      });
    },
    discardChanges() {
      this.populate();
    },
    holdsCustomMapPool(mapIds: string[]) {
      const pool = this.tournament.options.map_pool;
      if (pool.type !== e_map_pool_types_enum.Custom) {
        return false;
      }

      const current = new Set(pool.maps.map(({ id }: { id: string }) => id));
      const selected = new Set(mapIds);
      return (
        current.size === selected.size &&
        [...selected].every((id) => current.has(id))
      );
    },
    async save() {
      if (this.submitting) {
        return;
      }

      const { valid, errors } = await this.form.validate();
      if (!valid) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: Object.values(errors ?? {})[0] as string,
        });
        return;
      }

      this.submitting = true;
      try {
        this.form.setFieldValue(
          "number_of_substitutes",
          useApplicationSettingsStore().teamMaxSubs,
        );
        // Negotiated scheduling keeps brackets dormant until a time is agreed.
        if (this.form.values.negotiated_scheduling) {
          this.form.setFieldValue("match_mode", "admin");
        }
        const form = this.form.values;

        await this.$apollo.mutate({
          variables: {
            auto_start: form.negotiated_scheduling ? false : form.auto_start,
            scheduling_mode: form.negotiated_scheduling ? "negotiated" : "auto",
            substitutes_enabled: form.substitutes_enabled,
          },
          mutation: generateMutation({
            update_tournaments_by_pk: [
              {
                pk_columns: { id: this.tournament.id },
                _set: {
                  auto_start: $("auto_start", "Boolean!"),
                  scheduling_mode: $("scheduling_mode", "String!"),
                  substitutes_enabled: $("substitutes_enabled", "Boolean!"),
                },
              },
              { __typename: true },
            ],
          }),
        });

        const mapPoolLocked = this.mapPoolLocked;
        let mapPoolId = form.map_pool_id;

        if (
          mapPoolLocked ||
          (form.custom_map_pool && this.holdsCustomMapPool(form.map_pool))
        ) {
          mapPoolId = this.tournament.options.map_pool.id;
        } else if (form.custom_map_pool) {
          const { data } = await this.$apollo.mutate({
            variables: {
              map_pool: {
                type: e_map_pool_types_enum.Custom,
                maps: {
                  data: form.map_pool.map((map_id: string) => ({ id: map_id })),
                },
              },
            },
            mutation: generateMutation({
              insert_map_pools_one: [
                { object: $("map_pool", "map_pools_insert_input!") },
                { id: true },
              ],
            }),
          });
          mapPoolId = data.insert_map_pools_one.id;
        }

        await this.$apollo.mutate({
          variables: {
            id: this.tournament.options.id,
            // The api keeps a drawn tournament's pool but would take a new
            // type, so one picked before the draw is not sent.
            ...setupOptionsVariables(
              mapPoolLocked
                ? { ...form, type: this.tournament.options.type }
                : form,
              { mapPoolId },
            ),
          },
          mutation: generateMutation({
            update_match_options_by_pk: [
              {
                pk_columns: { id: $("id", "uuid!") },
                _set: setupOptionsSetMutation(!!mapPoolId),
              },
              { __typename: true },
            ],
          }),
        });

        await this.refetchTournamentStatic();

        toast({ title: this.$t("tournament.updated") as string });

        this.takeSnapshot();
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>
