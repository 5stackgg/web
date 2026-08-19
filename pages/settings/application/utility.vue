<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
import { Input } from "~/components/ui/input";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import UtilityImportPanel from "~/components/utility/UtilityImportPanel.vue";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <SettingsSection
        id="library"
        :title="$t('pages.settings.application.utility.library_section')"
        :description="
          $t('pages.settings.application.utility.library_description')
        "
        clickable-header
        @header-click="save('public.utility_library_enabled', !libraryEnabled)"
      >
        <template #action>
          <Switch
            :model-value="libraryEnabled"
            @update:model-value="
              (value) => save('public.utility_library_enabled', value)
            "
          />
        </template>

        <div v-if="libraryEnabled" class="space-y-2">
          <label
            class="font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
          >
            {{ $t("pages.settings.application.utility.lineup_daily_limit") }}
          </label>
          <p class="text-sm text-muted-foreground">
            {{
              $t(
                "pages.settings.application.utility.lineup_daily_limit_description",
              )
            }}
          </p>
          <Input
            :model-value="drafts['public.utility_lineup_daily_limit']"
            type="number"
            min="0"
            :placeholder="$t('pages.settings.application.utility.server_default')"
            @update:model-value="
              (value) => onNumberInput('public.utility_lineup_daily_limit', value)
            "
          />
          <p
            v-if="invalid['public.utility_lineup_daily_limit']"
            class="text-[0.8rem] font-medium text-destructive"
          >
            {{ $t("pages.settings.application.utility.invalid_number") }}
          </p>
        </div>
      </SettingsSection>
    </PageTransition>

    <PageTransition :delay="60">
      <SettingsSection
        id="practice"
        :title="$t('pages.settings.application.utility.practice_section')"
        :description="
          $t('pages.settings.application.utility.practice_description')
        "
        clickable-header
        @header-click="save('public.utility_practice_enabled', !practiceEnabled)"
      >
        <template #action>
          <Switch
            :model-value="practiceEnabled"
            @update:model-value="
              (value) => save('public.utility_practice_enabled', value)
            "
          />
        </template>

        <template v-if="practiceEnabled">
          <div
            v-for="field of practiceFields"
            :key="field.name"
            class="space-y-2"
          >
            <label
              class="font-mono text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
            >
              {{ $t(`pages.settings.application.utility.${field.label}`) }}
            </label>
            <p class="text-sm text-muted-foreground">
              {{
                $t(`pages.settings.application.utility.${field.label}_description`)
              }}
            </p>
            <Input
              :model-value="drafts[field.name]"
              type="number"
              min="0"
              :placeholder="
                field.fallbackLabel
                  ? $t(
                      `pages.settings.application.utility.${field.fallbackLabel}`,
                    )
                  : $t('pages.settings.application.utility.server_default')
              "
              @update:model-value="(value) => onNumberInput(field.name, value)"
            />
            <p
              v-if="invalid[field.name]"
              class="text-[0.8rem] font-medium text-destructive"
            >
              {{ $t("pages.settings.application.utility.invalid_number") }}
            </p>
          </div>
        </template>
      </SettingsSection>
    </PageTransition>

    <PageTransition :delay="120">
      <SettingsSection
        id="import"
        :title="$t('pages.settings.application.utility.import_section')"
        :description="$t('pages.settings.application.utility.import_description')"
        clickable-header
        @header-click="save('public.utility_import_enabled', !importEnabled)"
      >
        <template #action>
          <Switch
            :model-value="importEnabled"
            @update:model-value="
              (value) => save('public.utility_import_enabled', value)
            "
          />
        </template>

        <UtilityImportPanel v-if="importEnabled" />
      </SettingsSection>
    </PageTransition>

    <SettingsSaveBar
      :dirty="dirty"
      :submitting="submitting"
      @save="updateSettings"
      @discard="seedDrafts(true)"
    />
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

/**
 * Every numeric knob the utility feature reads. An empty field is not zero — it
 * means "leave the row alone and keep whatever the API defaults to", which is
 * why nothing here carries a hardcoded default value. The one number the UI
 * does know is the success radius, and it is stated in its own copy rather
 * than pre-filled into the box.
 */
const NUMBER_SETTINGS = [
  {
    name: "public.utility_lineup_daily_limit",
    label: "lineup_daily_limit",
    fallbackLabel: null,
  },
  {
    name: "public.utility_practice_idle_minutes",
    label: "practice_idle_minutes",
    fallbackLabel: null,
  },
  {
    name: "public.utility_practice_daily_limit",
    label: "practice_daily_limit",
    fallbackLabel: null,
  },
  {
    name: "public.utility_practice_reserved_servers",
    label: "practice_reserved_servers",
    fallbackLabel: null,
  },
  {
    name: "public.utility_success_radius",
    label: "success_radius",
    fallbackLabel: "success_radius_default",
  },
] as const;

const PRACTICE_FIELDS = NUMBER_SETTINGS.filter(
  (field) => field.name !== "public.utility_lineup_daily_limit",
);

export default {
  data() {
    return {
      submitting: false,
      practiceFields: PRACTICE_FIELDS,
      drafts: {} as Record<string, string>,
      // Which fields the operator has typed in. Toggling a switch pushes a new
      // settings payload down the subscription, and re-seeding every box from
      // it would wipe numbers that are still being typed.
      touched: {} as Record<string, boolean>,
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler() {
        this.seedDrafts(false);
      },
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings as Array<{
        name: string;
        value: string | null;
      }>;
    },
    libraryEnabled(): boolean {
      return this.isEnabled("public.utility_library_enabled");
    },
    practiceEnabled(): boolean {
      return this.isEnabled("public.utility_practice_enabled");
    },
    importEnabled(): boolean {
      return this.isEnabled("public.utility_import_enabled");
    },
    changed(): string[] {
      return NUMBER_SETTINGS.map((field) => field.name).filter((name) => {
        const draft = (this.drafts[name] ?? "").trim();
        return draft.length > 0 && draft !== this.stored(name);
      });
    },
    invalid(): Record<string, boolean> {
      const out: Record<string, boolean> = {};
      for (const name of this.changed) {
        const value = Number(this.drafts[name]);
        out[name] = !Number.isFinite(value) || value < 0;
      }
      return out;
    },
    dirty(): boolean {
      return this.changed.length > 0;
    },
  },
  methods: {
    stored(name: string): string {
      return (
        this.settings.find((setting) => setting.name === name)?.value ?? ""
      );
    },
    isEnabled(name: string): boolean {
      return this.stored(name) === "true";
    },
    seedDrafts(force: boolean) {
      const drafts: Record<string, string> = { ...this.drafts };
      for (const field of NUMBER_SETTINGS) {
        if (force || !this.touched[field.name]) {
          drafts[field.name] = this.stored(field.name);
        }
      }
      this.drafts = drafts;
      if (force) {
        this.touched = {};
      }
    },
    onNumberInput(name: string, value: string | number) {
      this.drafts = { ...this.drafts, [name]: String(value ?? "") };
      this.touched = { ...this.touched, [name]: true };
    },
    async save(name: string, value: boolean) {
      await (this.$apollo as any).mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [{ name, value: value ? "true" : "false" }],
              on_conflict: {
                constraint: settings_constraint.settings_pkey,
                update_columns: [settings_update_column.value],
              },
            },
            { __typename: true },
          ],
        }),
      });

      toast({ title: this.$t("pages.settings.application.utility.updated") });
    },
    async updateSettings() {
      if (this.submitting) {
        return;
      }
      if (Object.values(this.invalid).some(Boolean)) {
        toast({
          title: this.$t("pages.settings.application.utility.invalid_number"),
          variant: "destructive",
        });
        return;
      }
      this.submitting = true;
      try {
        await (this.$apollo as any).mutate({
          mutation: generateMutation({
            insert_settings: [
              {
                objects: this.changed.map((name) => ({
                  name,
                  value: String(Math.round(Number(this.drafts[name]))),
                })),
                on_conflict: {
                  constraint: settings_constraint.settings_pkey,
                  update_columns: [settings_update_column.value],
                },
              },
              { __typename: true },
            ],
          }),
        });

        this.touched = {};
        toast({ title: this.$t("pages.settings.application.utility.updated") });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>
