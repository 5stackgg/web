<script setup lang="ts">
import { FormControl, FormField, FormItem } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import ImageUploadTile from "~/components/ImageUploadTile.vue";
import AddressSearch from "~/components/AddressSearch.vue";
import CategorySelect from "~/components/tournament/CategorySelect.vue";
import DateTimePicker from "~/components/tournament/DateTimePicker.vue";
import { ExternalLink, Lock } from "lucide-vue-next";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import TournamentRegistrationForm from "~/components/tournament/TournamentRegistrationForm.vue";

import {
  tacticalSectionLabelClasses as sectionLabelClasses,
  tacticalSectionTickClasses as sectionTickClasses,
} from "~/utilities/tacticalClasses";
</script>

<template>
  <form @submit.prevent="save" class="mx-auto grid max-w-3xl gap-8">
    <!-- Branding -->
    <section class="grid gap-4">
      <div :class="[sectionLabelClasses, 'mb-0']">
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
      <div :class="[sectionLabelClasses, 'mb-0']">
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
    </section>

    <!-- Schedule -->
    <section class="grid gap-4">
      <div :class="[sectionLabelClasses, 'mb-0']">
        <span :class="sectionTickClasses"></span>
        {{ $t("tournament.form.section.schedule") }}
      </div>

      <FormField v-slot="{ value }" name="start">
        <FormItem>
          <FormLabel>{{ $t("tournament.form.start") }}</FormLabel>
          <FormControl>
            <DateTimePicker
              :disabled="scheduleFrozen"
              :model-value="value"
              @update:model-value="(date) => form.setFieldValue('start', date)"
            />
          </FormControl>
          <p
            v-if="scheduleFrozen"
            class="flex items-start gap-2.5 border-l-2 border-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.07)] px-3.5 py-2.5 text-[0.82rem] leading-snug"
          >
            <Lock
              class="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]"
            />
            <span>{{ $t("tournament.check_in.frozen") }}</span>
          </p>
          <FormMessage />
        </FormItem>
      </FormField>
    </section>

    <!-- Classification & Venue -->
    <section class="grid gap-4">
      <div :class="[sectionLabelClasses, 'mb-0']">
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

    <!-- The same panel the create wizard's Registration step renders, so the
         rules an organizer set at creation are edited in exactly one UI.
         Held back until the subscription lands: rendering the column defaults
         first would show "check-in off" on a tournament that requires it, and
         a toggle flipped in that window would be overwritten a tick later. -->
    <TournamentRegistrationForm
      v-if="registrationSettings"
      :form="form"
      :tournament="registrationSettings"
      :min-players-per-lineup="tournament.min_players_per_lineup ?? null"
    />

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
import { generateMutation, generateSubscription } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { tournamentRegistrationFields } from "~/graphql/simpleTournamentFields";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { isTournamentScheduleFrozen } from "~/utilities/tournamentCheckIn";
import {
  registrationColumns,
  registrationFormValues,
  registrationSchemaShape,
} from "~/utilities/tournamentRegistration";
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
      registrationSettings: null as Record<string, any> | null,
      registrationSeeded: false,
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
            ...registrationSchemaShape(this),
          }),
        ),
      }),
    };
  },
  apollo: {
    $subscribe: {
      tournaments_by_pk: {
        // The registration columns are not part of the selection the tournament
        // page hands down as `tournament`, and `check_in_started` has to stay
        // live: the freeze must engage while an organizer has this form open.
        query: generateSubscription({
          tournaments_by_pk: [
            { id: $("tournamentId", "uuid!") },
            {
              id: true,
              start: true,
              ...tournamentRegistrationFields,
            } as any,
          ],
        }),
        variables: function (this: any) {
          return { tournamentId: this.tournament.id };
        },
        result: function (this: any, { data }: { data: any }) {
          this.registrationSettings = data?.tournaments_by_pk ?? null;
          if (this.baseline === null || !this.isDirty) {
            this.populate();
            return;
          }
          // Dirty already (the organizer started typing before this landed):
          // repopulating would throw their edit away, but the registration half
          // has never been seeded, so patch just that in — including into the
          // dirty baseline, or the untouched panel counts as a change.
          if (!this.registrationSeeded) {
            this.seedRegistration();
          }
        },
      },
    },
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
    // Only the live subscription carries `check_in_started`; the page's own
    // tournament object never selects it, and a missing field would read as
    // "not frozen" and quietly drop the lock explanation.
    scheduleFrozen(): boolean {
      return isTournamentScheduleFrozen(this.registrationSettings);
    },
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
        ...registrationFormValues(this.registrationSettings ?? {}),
      });
      this.registrationSeeded = this.registrationSettings !== null;
      this.$nextTick(() => {
        this.baseline = JSON.stringify(this.form.values);
        this.isDirty = false;
      });
    },
    // Seeds only the registration half, leaving the organizer's in-flight edits
    // to the other sections alone. The baseline is patched in the same shape so
    // JSON.stringify's key order still matches — a re-serialised baseline built
    // from scratch would compare unequal and pin the form permanently dirty.
    seedRegistration() {
      const values = registrationFormValues(this.registrationSettings ?? {});
      this.form.setValues(values);
      this.registrationSeeded = true;
      this.$nextTick(() => {
        if (this.baseline === null) {
          return;
        }
        const baseline = JSON.parse(this.baseline);
        Object.assign(baseline, values);
        this.baseline = JSON.stringify(baseline);
        this.isDirty = JSON.stringify(this.form.values) !== this.baseline;
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
        const variables: Record<string, any> = {
          name: this.form.values.name,
          start: this.form.values.start,
          description: this.form.values.description,
          homepage: this.form.values.homepage || null,
          location: this.form.values.location || null,
          latitude: this.form.values.latitude ?? null,
          longitude: this.form.values.longitude ?? null,
        };
        const set: Record<string, any> = {
          name: $("name", "String!"),
          description: $("description", "String"),
          homepage: $("homepage", "String"),
          location: $("location", "String"),
          latitude: $("latitude", "float8"),
          longitude: $("longitude", "float8"),
        };

        // `start` is dropped rather than resent unchanged while frozen: the
        // trigger rejects the whole statement on any distinct value, and a
        // Date rebuilt in JS loses the column's sub-millisecond precision, so
        // "the same time" is not guaranteed to compare equal.
        if (!this.scheduleFrozen) {
          set.start = $("start", "timestamptz!");
        } else {
          delete variables.start;
        }

        // Omitted entirely until the registration subscription has landed —
        // writing the panel's fallback defaults over a tournament whose real
        // settings were never loaded would silently switch check-in off.
        if (this.registrationSettings) {
          const columns = registrationColumns(this.form.values);
          Object.assign(variables, columns);
          Object.assign(set, {
            // Cast: the enum type only enters Zeus's GraphQLVariableType union
            // once codegen has run against the migrated schema.
            registration_type: $(
              "registration_type",
              "e_tournament_registration_types_enum!" as any,
            ),
            min_role: $("min_role", "e_player_roles_enum"),
            min_elo: $("min_elo", "Int"),
            max_elo: $("max_elo", "Int"),
            invite_only: $("invite_only", "Boolean!"),
            regions: $("regions", "[String!]!"),
            check_in_required: $("check_in_required", "Boolean!"),
            check_in_setting: $(
              "check_in_setting",
              "e_check_in_settings_enum!",
            ),
          });
          // Frozen along with `start`, and for the same reason.
          if (!this.scheduleFrozen) {
            Object.assign(set, {
              check_in_opens_before_minutes: $(
                "check_in_opens_before_minutes",
                "Int!",
              ),
              check_in_closes_before_minutes: $(
                "check_in_closes_before_minutes",
                "Int!",
              ),
            });
          } else {
            delete variables.check_in_opens_before_minutes;
            delete variables.check_in_closes_before_minutes;
          }
        }

        await this.$apollo.mutate({
          variables,
          mutation: generateMutation({
            update_tournaments_by_pk: [
              {
                pk_columns: { id: this.tournament.id },
                // Cast: the registration columns arrive with the API migration
                // and the generated Zeus types only learn them after codegen.
                _set: set as any,
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
