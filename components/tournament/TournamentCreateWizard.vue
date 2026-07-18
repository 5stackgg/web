<script setup lang="ts">
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "~/components/ui/card";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-vue-next";
import MatchOptions from "~/components/MatchOptions.vue";
import SettingHeader from "~/components/match/SettingHeader.vue";
import AddressSearch from "~/components/AddressSearch.vue";
import CategorySelect from "~/components/tournament/CategorySelect.vue";
import DateTimePicker from "~/components/tournament/DateTimePicker.vue";
import ImageUploadTile from "~/components/ImageUploadTile.vue";
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
          <Check v-if="index < currentStep" class="h-3 w-3" />
          <span v-else>{{ index + 1 }}</span>
          {{ step.label }}
        </button>
        <ChevronRight
          v-if="index < steps.length - 1"
          class="h-3 w-3 text-muted-foreground/40"
        />
      </li>
    </ol>

    <!-- Step 1: Information -->
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

      <FormField v-slot="{ componentField }" name="description">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.description") }}</FormLabel>
          <FormControl>
            <Input v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ value }" name="start">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.start") }}</FormLabel>
          <FormControl>
            <DateTimePicker
              disable-past-dates
              :model-value="value"
              @update:model-value="(date) => form.setFieldValue('start', date)"
            />
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
          <FormDescription>{{
            $t("tournament.form.homepage.description")
          }}</FormDescription>
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
    </div>

    <!-- Step 2: Location -->
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

    <!-- Step 3: Match Options -->
    <div v-show="currentStep === 2" class="grid gap-4">
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
      </MatchOptions>
    </div>

    <!-- Step 4: Prizes -->
    <div v-show="currentStep === 3" class="grid gap-4">
      <p class="text-sm text-muted-foreground">
        {{ $t("tournament.prizes.manage_hint") }}
      </p>
      <div class="flex flex-col gap-2">
        <div
          v-for="(prize, index) in prizes"
          :key="index"
          class="flex items-center gap-2 rounded-sm border border-border/60 bg-background/40 p-2"
        >
          <Input
            v-model="prize.place"
            :placeholder="$t('tournament.prizes.place_placeholder')"
            maxlength="40"
            class="h-8 w-28 font-mono text-xs"
          />
          <Input
            v-model="prize.prize"
            :placeholder="$t('tournament.prizes.prize_placeholder')"
            maxlength="120"
            class="h-8 flex-1 text-xs"
          />
          <Button
            size="icon"
            variant="ghost"
            class="h-8 w-8 text-destructive"
            @click="prizes.splice(index, 1)"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="justify-self-start"
          @click="prizes.push({ place: '', prize: '' })"
        >
          <Plus class="mr-1 h-4 w-4" />
          {{ $t("tournament.prizes.add") }}
        </Button>
      </div>
    </div>

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
      prizes: [] as Array<{ place: string; prize: string }>,
      bannerBlob: null as Blob | null,
      form: useForm({
        keepValuesOnUnmount: true,
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
          key: "match_options",
          label: this.$t("tournament.wizard.match_options"),
        },
        { key: "prizes", label: this.$t("tournament.wizard.prizes") },
      ];
    },
  },
  methods: {
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
      // Only the Information step has required fields; the rest have defaults.
      if (step !== 0) {
        return true;
      }
      const results = await Promise.all([
        this.form.validateField("name"),
        this.form.validateField("start"),
      ]);
      return results.every((result) => result.valid);
    },
    async next() {
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

        const { data } = await this.$apollo.mutate({
          variables: setupOptionsVariables(form),
          mutation: generateMutation({
            insert_tournaments_one: [
              {
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
                  options: {
                    data: setupOptionsSetMutation(!!form.map_pool_id),
                  },
                },
              },
              { id: true },
            ],
          }),
        });

        const tournamentId = data.insert_tournaments_one.id;
        await this.persistCategoriesAndPrizes(tournamentId);
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
        .map((prize, index) => ({
          tournament_id: tournamentId,
          place: prize.place.trim(),
          prize: prize.prize.trim(),
          order: index,
        }))
        .filter((prize) => prize.place && prize.prize);

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
