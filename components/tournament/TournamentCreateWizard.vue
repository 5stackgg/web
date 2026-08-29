<script setup lang="ts">
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-vue-next";

import {
  tacticalSectionLabelClasses as wizardSectionLabelClasses,
  tacticalSectionTickClasses as wizardSectionTickClasses,
} from "~/utilities/tacticalClasses";
import MatchOptions from "~/components/MatchOptions.vue";
import SettingHeader from "~/components/match/SettingHeader.vue";
import AddressSearch from "~/components/AddressSearch.vue";
import CategorySelect from "~/components/tournament/CategorySelect.vue";
import DateTimePicker from "~/components/tournament/DateTimePicker.vue";
import ImageUploadTile from "~/components/ImageUploadTile.vue";
import PrizeRowsEditor from "~/components/tournament/PrizeRowsEditor.vue";
import TournamentRegistrationForm from "~/components/tournament/TournamentRegistrationForm.vue";
import { HeightMorph, Fold } from "~/components/ui/transitions";
</script>

<template>
  <div class="grid gap-6">
    <!-- Step indicator -->
    <ol class="flex flex-wrap items-center gap-2">
      <li
        v-for="(step, index) in steps"
        :key="step.key"
        class="flex items-center gap-2"
      >
        <button
          type="button"
          class="flex items-center gap-2 rounded-sm border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] transition-colors"
          :class="
            index === currentStep
              ? 'border-[hsl(var(--tac-amber))] bg-[hsl(var(--tac-amber)_/_0.12)] text-[hsl(var(--tac-amber))]'
              : index < currentStep
                ? 'border-border bg-muted/30 text-foreground'
                : 'border-border bg-background/40 text-muted-foreground'
          "
          :disabled="index > furthestStep"
          @click="goTo(index)"
        >
          <!-- Stacked glyphs crossfade: the check used to hard-cut against
               the button's own color transition. -->
          <span class="grid place-items-center">
            <Check
              class="col-start-1 row-start-1 h-3 w-3 transition-opacity duration-200"
              :class="index < currentStep ? '' : 'opacity-0'"
            />
            <span
              class="col-start-1 row-start-1 transition-opacity duration-200"
              :class="index < currentStep ? 'opacity-0' : ''"
            >
              {{ index + 1 }}
            </span>
          </span>
          {{ step.label }}
        </button>
        <ChevronRight
          v-if="index < steps.length - 1"
          class="h-3 w-3 text-muted-foreground/40"
        />
      </li>
    </ol>

    <!-- The steps are wildly different heights (a banner + schedule vs
         one address field vs the whole MatchOptions tree). The shell eases
         between them while the leaver fades out of flow, so the navigation
         bar below glides instead of teleporting out from under the pointer.
         v-show keeps the panels mounted so their state survives. -->
    <HeightMorph :state="currentStep">
    <!-- Step 1: Information -->
    <Transition name="wiz-step">
    <div v-show="currentStep === 0" class="grid gap-4">
      <div class="grid gap-1.5">
        <Label>{{ $t("tournament.banner.label") }}</Label>
        <ImageUploadTile
          class="max-w-md"
          aspect="banner"
          fit="contain"
          allow-fit-whole
          mode="deferred"
          :hint="$t('tournament.banner.hint')"
          @apply="onBannerApply"
          @removed="onBannerRemoved"
        />
      </div>

      <FormField v-slot="{ componentField }" name="name">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.name") }}</FormLabel>
          <FormControl>
            <Input v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="homepage">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.homepage.label") }}</FormLabel>
          <FormControl>
            <Input v-bind="componentField" type="url" placeholder="https://" />
          </FormControl>
          <FormDescription class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{{ $t("tournament.form.homepage.description") }}</span>
            <a
              href="/events/create"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 text-[hsl(var(--tac-amber))] hover:underline"
            >
              {{ $t("tournament.form.homepage.create_event") }}
              <ExternalLink class="h-3 w-3" />
            </a>
          </FormDescription>
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="description">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.description") }}</FormLabel>
          <FormControl>
            <Input v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ value }" name="categories">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.categories.label") }}</FormLabel>
          <CategorySelect
            :model-value="value"
            @update:model-value="
              (categories) => form.setFieldValue('categories', categories)
            "
          />
        </FormItem>
      </FormField>

      <div class="mt-2 grid gap-4 border-t border-border pt-4">
        <div :class="[wizardSectionLabelClasses, 'mb-0']">
          <span :class="wizardSectionTickClasses"></span>
          {{ $t("tournament.form.section.schedule") }}
        </div>

        <FormField v-slot="{ value }" name="start">
          <FormItem>
            <FormLabel>{{ $t("tournament.form.start") }}</FormLabel>
            <FormControl>
              <DateTimePicker
                disable-past-dates
                :model-value="value"
                @update:model-value="
                  (date) => form.setFieldValue('start', date)
                "
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </div>
    </Transition>

    <!-- Step 2: Location -->
    <Transition name="wiz-step">
    <div v-show="currentStep === 1" class="grid gap-4">
      <FormField name="location">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.location.label") }}</FormLabel>
          <FormControl>
            <AddressSearch
              :model-value="form.values.location"
              @selected="onLocationSelected"
              @cleared="onLocationCleared"
            />
          </FormControl>
          <FormDescription>{{
            $t("tournament.form.location.description")
          }}</FormDescription>
        </FormItem>
      </FormField>
    </div>
    </Transition>

    <!-- Step 3: Registration -->
    <Transition name="wiz-step">
    <div v-show="currentStep === 2" class="grid gap-4">
      <TournamentRegistrationForm
        :form="form"
        :min-players-per-lineup="minPlayersPerLineup"
      />
    </div>
    </Transition>

    <!-- Step 4: Match Options -->
    <Transition name="wiz-step">
    <div v-show="currentStep === 3" class="grid gap-4">
      <MatchOptions
        :form="form"
        :force-veto="true"
        :hide-best-of="true"
        :hide-match-mode="true"
        :lock-substitutes="true"
      >
        <FormField
          v-slot="{ value, handleChange }"
          name="negotiated_scheduling"
        >
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

        <!-- Folds under the switch that controls it instead of popping while
             the switch thumb is still sliding. -->
        <Fold :open="!form.values.negotiated_scheduling">
        <FormField
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
        </Fold>
      </MatchOptions>
    </div>
    </Transition>

    <!-- Step 5: Prizes -->
    <Transition name="wiz-step">
    <div v-show="currentStep === 4" class="grid gap-4">
      <p class="text-sm text-muted-foreground">
        {{ $t("tournament.prizes.manage_hint") }}
      </p>
      <PrizeRowsEditor
        :rows="prizes"
        @move="movePrizeRow"
        @remove="removePrizeRow"
        @add="addPrizeRow"
      />
    </div>
    </Transition>
    </HeightMorph>

    <!-- Navigation -->
    <div class="flex items-center justify-between border-t border-border pt-4">
      <Button
        type="button"
        variant="outline"
        :disabled="currentStep === 0 || submitting"
        @click="back"
      >
        <ChevronLeft class="mr-1 h-4 w-4" />
        {{ $t("common.back") }}
      </Button>

      <Button v-if="currentStep < steps.length - 1" type="button" @click="next">
        {{ $t("common.next") }}
        <ChevronRight class="ml-1 h-4 w-4" />
      </Button>
      <Button v-else type="button" :loading="submitting" @click="create">
        {{ $t("tournament.form.create") }}
      </Button>
    </div>
  </div>
</template>

<script lang="ts">
import * as z from "zod";
import { useForm } from "vee-validate";
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import matchOptionsValidator from "~/utilities/match-options-validator";
import { EXPECTED_PLAYERS } from "~/utilities/matchmakingPartySize";
import {
  REGISTRATION_FIELD,
  canManageRegistrationPasscode,
  registrationColumns,
  registrationSchemaShape,
} from "~/utilities/tournamentRegistration";
import { effectivePlace, normalizePrize } from "~/utilities/prizes";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { toast } from "@/components/ui/toast";
import {
  setupOptionsVariables,
  setupOptionsSetMutation,
} from "~/utilities/setupOptions";

export default {
  data() {
    return {
      currentStep: 0,
      furthestStep: 0,
      submitting: false,
      prizeRowSeq: 0,
      prizes: [] as Array<{ id: number; place: string; prize: string }>,
      bannerBlob: null as Blob | null,
      form: useForm({
        keepValuesOnUnmount: true,
        // Most organizers run the tournament on this instance, so seed the
        // homepage with its own origin rather than leaving the field blank.
        initialValues: { homepage: useRequestURL().origin },
        validationSchema: toTypedSchema(
          matchOptionsValidator(
            this,
            {
              name: z.string().min(1),
              start: z.date().refine((date) => date > new Date(), {
                message: this.$t("validation.date_must_be_future"),
              }),
              description: z.string().nullable().default(null),
              homepage: z.string().nullable().default(null),
              location: z.string().nullable().default(null),
              latitude: z.number().nullable().default(null),
              longitude: z.number().nullable().default(null),
              categories: z.string().array().default([]),
              auto_start: z.boolean().default(true),
              negotiated_scheduling: z.boolean().default(false),
              ...registrationSchemaShape(this),
            },
            useApplicationSettingsStore().settings,
          ),
        ),
      }),
    };
  },
  computed: {
    steps() {
      return [
        { key: "information", label: this.$t("tournament.wizard.information") },
        { key: "location", label: this.$t("tournament.wizard.location") },
        {
          key: "registration",
          label: this.$t("tournament.wizard.registration"),
        },
        {
          key: "match_options",
          label: this.$t("tournament.wizard.match_options"),
        },
        { key: "prizes", label: this.$t("tournament.wizard.prizes") },
      ];
    },
    // There is no tournament row yet, so the lineup minimum comes from the
    // match type the organizer picked (EXPECTED_PLAYERS counts both lineups).
    minPlayersPerLineup(): number | null {
      const expected =
        EXPECTED_PLAYERS[
          this.form.values.type as keyof typeof EXPECTED_PLAYERS
        ];
      return expected ? expected / 2 : null;
    },
  },
  methods: {
    addPrizeRow(prize: string, place: string) {
      this.prizes.push({ id: ++this.prizeRowSeq, place, prize });
    },
    removePrizeRow(row: { id: string | number }) {
      this.prizes = this.prizes.filter((prize) => prize.id !== row.id);
    },
    movePrizeRow(from: number, to: number) {
      const [moved] = this.prizes.splice(from, 1);
      this.prizes.splice(to, 0, moved);
    },
    // The ImageUploadTile (deferred mode) crops and previews the banner; we just
    // hold the resulting blob until the tournament exists.
    onBannerApply(blob: Blob) {
      this.bannerBlob = blob;
    },
    onBannerRemoved() {
      this.bannerBlob = null;
    },
    // The banner endpoint keys off the tournament id, so the crop is captured
    // during setup and uploaded once the tournament row exists.
    async uploadBanner(tournamentId: string) {
      if (!this.bannerBlob) {
        return;
      }
      try {
        const formData = new FormData();
        formData.append("file", this.bannerBlob, "banner.webp");
        const response = await fetch(
          `https://${useRuntimeConfig().public.apiDomain}/avatars/tournaments/${tournamentId}/banner`,
          { method: "POST", body: formData, credentials: "include" },
        );
        if (!response.ok) {
          throw new Error(
            (await response.text()) ||
              `${response.status} ${response.statusText}`,
          );
        }
      } catch (error: any) {
        // Non-fatal: the tournament is already created, so surface the failure
        // but let the redirect proceed — the banner can be added from settings.
        toast({
          variant: "destructive",
          title: this.$t("tournament.banner.upload_failed"),
          description: error?.message,
        });
      }
    },
    onLocationSelected(result: {
      label: string;
      latitude: number;
      longitude: number;
    }) {
      this.form.setValues({
        location: result.label,
        latitude: result.latitude,
        longitude: result.longitude,
      });
    },
    onLocationCleared() {
      this.form.setValues({
        location: null,
        latitude: null,
        longitude: null,
      });
    },
    async validateStep(step: number): Promise<boolean> {
      // Every field on the remaining steps has a default; only Information
      // (required) and Registration (a range that can contradict itself) can
      // be left in a state worth stopping on.
      const fields: Record<number, string[]> = {
        0: ["name", "start"],
        2: [
          REGISTRATION_FIELD.max_elo,
          REGISTRATION_FIELD.check_in_opens_before_minutes,
          REGISTRATION_FIELD.check_in_closes_before_minutes,
        ],
      };
      if (!fields[step]) {
        return true;
      }
      const results = await Promise.all(
        fields[step].map((field) => this.form.validateField(field)),
      );
      return results.every((result) => result.valid);
    },
    // Sync on purpose — returning a promise here makes ui/Button flash its
    // auto-spinner (and lock for minLoadingMs) on every step advance.
    next() {
      void this.advance();
    },
    async advance() {
      if (!(await this.validateStep(this.currentStep))) {
        return;
      }
      this.currentStep = Math.min(this.currentStep + 1, this.steps.length - 1);
      this.furthestStep = Math.max(this.furthestStep, this.currentStep);
    },
    back() {
      this.currentStep = Math.max(this.currentStep - 1, 0);
    },
    async goTo(step: number) {
      if (step > this.furthestStep) {
        return;
      }
      if (
        step > this.currentStep &&
        !(await this.validateStep(this.currentStep))
      ) {
        return;
      }
      this.currentStep = step;
    },
    async create() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        const { valid, errors } = await this.form.validate();
        if (!valid) {
          toast({
            variant: "destructive",
            title: this.$t("common.error"),
            description: Object.values(errors ?? {})[0] as string,
          });
          this.submitting = false;
          return;
        }

        this.form.setFieldValue(
          "number_of_substitutes",
          useApplicationSettingsStore().teamMaxSubs,
        );
        if (this.form.values.negotiated_scheduling) {
          this.form.setFieldValue("match_mode", "admin");
        }
        const form = this.form.values;
        const canSetPasscode = canManageRegistrationPasscode();

        const { data } = await this.$apollo.mutate({
          variables: setupOptionsVariables(form),
          mutation: generateMutation({
            insert_tournaments_one: [
              {
                // Cast: the registration/check-in columns ship with the API
                // migration, and the generated Zeus types only learn about them
                // once `yarn codegen` runs against a migrated stack. Drop the
                // cast then — it is hiding nothing else.
                object: {
                  name: form.name,
                  start: form.start,
                  description: form.description,
                  homepage: form.homepage || null,
                  location: form.location || null,
                  latitude: form.latitude ?? null,
                  longitude: form.longitude ?? null,
                  auto_start: form.negotiated_scheduling
                    ? false
                    : form.auto_start,
                  scheduling_mode: form.negotiated_scheduling
                    ? "negotiated"
                    : "auto",
                  ...registrationColumns(form, {
                    includePasscode: canSetPasscode,
                  }),
                  options: {
                    data: setupOptionsSetMutation(!!form.map_pool_id),
                  },
                } as any,
              },
              { id: true },
            ],
          }),
        });

        const tournamentId = data.insert_tournaments_one.id;
        // The tournament row exists past this point: follow-up failures must
        // still navigate to it, or a retried Create inserts a duplicate.
        try {
          await this.persistCategoriesAndPrizes(tournamentId);
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: this.$t("common.error"),
            description: error?.message,
          });
        }
        await this.uploadBanner(tournamentId);

        await this.$router.push(`/tournaments/${tournamentId}`);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: this.$t("common.error"),
          description: error?.message,
        });
        this.submitting = false;
      }
    },
    async persistCategoriesAndPrizes(tournamentId: string) {
      const categories: string[] = this.form.values.categories ?? [];
      if (categories.length > 0) {
        await this.$apollo.mutate({
          variables: {
            objects: categories.map((category) => ({
              tournament_id: tournamentId,
              category,
            })),
          },
          mutation: generateMutation({
            insert_tournament_categories: [
              {
                objects: $("objects", "[tournament_categories_insert_input!]!"),
              },
              { affected_rows: true },
            ],
          }),
        });
      }

      const prizes = this.prizes
        .filter((prize) => prize.prize.trim())
        .map((prize, index) => ({
          tournament_id: tournamentId,
          place: effectivePlace(prize.place, index),
          prize: normalizePrize(prize.prize),
          order: index,
        }));

      if (prizes.length > 0) {
        await this.$apollo.mutate({
          variables: { objects: prizes },
          mutation: generateMutation({
            insert_tournament_prizes: [
              { objects: $("objects", "[tournament_prizes_insert_input!]!") },
              { affected_rows: true },
            ],
          }),
        });
      }
    },
  },
};
</script>

<style scoped>
/* The leaver goes out of flow so two steps never stack; the HeightMorph shell
   owns the height while they trade. Opacity/transform only, so the fades keep
   playing even when the entering step is heavy. */
.wiz-step-enter-active {
  transition:
    opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}
.wiz-step-leave-active {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  transition: opacity 0.11s ease-in;
}
.wiz-step-enter-from {
  opacity: 0;
  transform: translateX(12px);
}
.wiz-step-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .wiz-step-enter-active,
  .wiz-step-leave-active {
    transition-duration: 1ms;
  }
}
</style>
