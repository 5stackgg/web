<script setup lang="ts">
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import ImageUploadTile from "~/components/ImageUploadTile.vue";
import AddressSearch from "~/components/AddressSearch.vue";
import CategorySelect from "~/components/tournament/CategorySelect.vue";
import DateTimePicker from "~/components/tournament/DateTimePicker.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";

const sectionLabelClasses =
  "inline-flex items-center gap-2 font-mono text-[0.72rem] uppercase tracking-[0.24em] text-muted-foreground";
const sectionTickClasses =
  "inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]";
</script>

<template>
  <form @submit.prevent="save" class="mx-auto grid max-w-3xl gap-8">
    <!-- Branding -->
    <section class="grid gap-4">
      <div :class="sectionLabelClasses">
        <span :class="sectionTickClasses"></span>
        {{ $t("tournament.form.section.branding") }}
      </div>
      <div class="grid gap-4 sm:grid-cols-[minmax(0,10rem)_1fr] sm:items-start">
        <div class="grid gap-1.5">
          <Label>{{ $t("tournament.form.logo.label") }}</Label>
          <ImageUploadTile
            aspect="square"
            fit="contain"
            :upload-url="`https://${apiDomain}/avatars/tournaments/${tournament.id}`"
            :delete-url="`https://${apiDomain}/avatars/tournaments/${tournament.id}`"
            :has-custom="!!tournament.logo"
            :current-src="tournamentLogoSrc"
          />
        </div>
        <div class="grid gap-1.5">
          <Label>{{ $t("tournament.banner.label") }}</Label>
          <ImageUploadTile
            aspect="banner"
            fit="contain"
            allow-fit-whole
            filename="banner.webp"
            :hint="$t('tournament.banner.hint')"
            :upload-url="`https://${apiDomain}/avatars/tournaments/${tournament.id}/banner`"
            :delete-url="`https://${apiDomain}/avatars/tournaments/${tournament.id}/banner`"
            :has-custom="!!tournament.banner"
            :current-src="tournamentBannerSrc"
          />
        </div>
      </div>
    </section>

    <!-- Details -->
    <section class="grid gap-4">
      <div :class="sectionLabelClasses">
        <span :class="sectionTickClasses"></span>
        {{ $t("tournament.form.section.details") }}
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
            <Textarea v-bind="componentField" rows="3" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField v-slot="{ value }" name="start">
          <FormItem>
            <FormLabel>{{ $t("tournament.form.start") }}</FormLabel>
            <FormControl>
              <DateTimePicker
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
              <Input
                v-bind="componentField"
                type="url"
                placeholder="https://"
              />
            </FormControl>
            <FormDescription>{{
              $t("tournament.form.homepage.description")
            }}</FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>
      </div>
    </section>

    <!-- Classification & Venue -->
    <section class="grid gap-4">
      <div :class="sectionLabelClasses">
        <span :class="sectionTickClasses"></span>
        {{ $t("tournament.form.section.classification") }}
      </div>

      <FormField v-slot="{ value }" name="categories">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.categories.label") }}</FormLabel>
          <CategorySelect
            :model-value="value"
            @update:model-value="
              (categories) => form.setFieldValue('categories', categories)
            "
          />
          <FormMessage />
        </FormItem>
      </FormField>

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
          <FormMessage />
        </FormItem>
      </FormField>
    </section>

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
import * as z from "zod";
import { useForm } from "vee-validate";
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { toast } from "@/components/ui/toast";

export default {
  props: {
    tournament: {
      type: Object,
      required: true,
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
          z.object({
            name: z.string().min(1),
            start: z.date(),
            description: z.string().nullable().default(null),
            homepage: z.string().nullable().default(null),
            location: z.string().nullable().default(null),
            latitude: z.number().nullable().default(null),
            longitude: z.number().nullable().default(null),
            categories: z.string().array().default([]),
          }),
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
  },
  computed: {
    apiDomain() {
      return useRuntimeConfig().public.apiDomain;
    },
    tournamentLogoSrc() {
      if (!this.tournament?.logo) {
        return null;
      }
      return `https://${this.apiDomain}/${this.tournament.logo}`;
    },
    tournamentBannerSrc() {
      if (!this.tournament?.banner) {
        return null;
      }
      return `https://${this.apiDomain}/${this.tournament.banner}`;
    },
  },
  methods: {
    populate() {
      this.form.setValues({
        name: this.tournament.name,
        start: new Date(this.tournament.start),
        description: this.tournament.description,
        homepage: this.tournament.homepage ?? null,
        location: this.tournament.location ?? null,
        // Hasura's float8 scalar arrives as a string; coerce so the numeric
        // schema (and the mutation's float8 vars) get real numbers.
        latitude:
          this.tournament.latitude != null
            ? Number(this.tournament.latitude)
            : null,
        longitude:
          this.tournament.longitude != null
            ? Number(this.tournament.longitude)
            : null,
        categories: (this.tournament.categories ?? []).map(
          (category: any) => category.category,
        ),
      });
      this.$nextTick(() => {
        this.baseline = JSON.stringify(this.form.values);
        this.isDirty = false;
      });
    },
    discardChanges() {
      this.populate();
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
    async syncCategories() {
      const existing: string[] = (this.tournament.categories ?? []).map(
        (category: any) => category.category,
      );
      const selected: string[] = this.form.values.categories ?? [];
      const toDelete = existing.filter(
        (category) => !selected.includes(category),
      );
      const toInsert = selected.filter(
        (category) => !existing.includes(category),
      );

      if (toDelete.length > 0) {
        await this.$apollo.mutate({
          variables: { tournamentId: this.tournament.id, categories: toDelete },
          mutation: generateMutation({
            delete_tournament_categories: [
              {
                where: {
                  tournament_id: { _eq: $("tournamentId", "uuid!") },
                  category: { _in: $("categories", "[String!]!") },
                },
              },
              { affected_rows: true },
            ],
          }),
        });
      }

      if (toInsert.length > 0) {
        await this.$apollo.mutate({
          variables: {
            objects: toInsert.map((category) => ({
              tournament_id: this.tournament.id,
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
        await this.$apollo.mutate({
          variables: {
            name: this.form.values.name,
            start: this.form.values.start,
            description: this.form.values.description,
            homepage: this.form.values.homepage || null,
            location: this.form.values.location || null,
            latitude: this.form.values.latitude ?? null,
            longitude: this.form.values.longitude ?? null,
          },
          mutation: generateMutation({
            update_tournaments_by_pk: [
              {
                pk_columns: { id: this.tournament.id },
                _set: {
                  name: $("name", "String!"),
                  start: $("start", "timestamptz!"),
                  description: $("description", "String"),
                  homepage: $("homepage", "String"),
                  location: $("location", "String"),
                  latitude: $("latitude", "float8"),
                  longitude: $("longitude", "float8"),
                },
              },
              { __typename: true },
            ],
          }),
        });

        await this.syncCategories();

        toast({ title: this.$t("tournament.updated") as string });

        this.$nextTick(() => {
          this.baseline = JSON.stringify(this.form.values);
          this.isDirty = false;
        });
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
