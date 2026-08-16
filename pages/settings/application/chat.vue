<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <form @submit.prevent="updateSettings" class="space-y-6">
        <SettingsSection
          id="chat"
          :title="$t('pages.settings.application.chat.lobby_title')"
          :description="$t('pages.settings.application.chat.lobby_description')"
        >
          <FormField
            v-for="room in rooms"
            :key="room.name"
            v-slot="{ componentField }"
            :name="room.name"
          >
            <FormItem>
              <FormLabel>
                {{ $t(`pages.settings.application.chat.${room.label}`) }}
              </FormLabel>
              <FormControl>
                <Input v-bind="componentField" type="number" min="0" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          id="chat-direct"
          :title="$t('pages.settings.application.chat.direct_title')"
          :description="$t('pages.settings.application.chat.direct_description')"
        >
          <FormField
            v-slot="{ componentField }"
            name="public.chat_retention_direct_days"
          >
            <FormItem>
              <FormLabel>
                {{
                  $t("pages.settings.application.chat.retention_direct_days")
                }}
              </FormLabel>
              <FormControl>
                <Input v-bind="componentField" type="number" min="0" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSaveBar
          :form="form"
          :submitting="submitting"
          @save="updateSettings"
        />
      </form>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { useForm } from "vee-validate";
import { toTypedSchema } from "~/utilities/vee-validate-zod";
import { z } from "zod";
import { toast } from "@/components/ui/toast";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

// One entry per lobby type, matching ChatService.TTL_SETTINGS in the API.
// There was a single setting before, and it wrote a name the API never read --
// so nothing an operator typed here had ever taken effect.
// `key` is the settings-table name minus the `public.` prefix. vee-validate
// reads a dot in a field name as a nested path, so the form is shaped
// `{ public: { chat_ttl_match: ... } }` while the setting is written flat.
const ROOMS = [
  { key: "chat_ttl_match", label: "ttl_match", fallback: 3600 },
  { key: "chat_ttl_match_team", label: "ttl_match_team", fallback: 3600 },
  { key: "chat_ttl_matchmaking", label: "ttl_matchmaking", fallback: 3600 },
  { key: "chat_ttl_draft", label: "ttl_draft", fallback: 3600 },
  { key: "chat_ttl_tournament", label: "ttl_tournament", fallback: 86400 },
  { key: "chat_ttl_organizers", label: "ttl_organizers", fallback: 86400 },
];

const DIRECT_RETENTION = {
  key: "chat_retention_direct_days",
  fallback: 365,
};

const ALL_SETTINGS = [...ROOMS, DIRECT_RETENTION];

const settingName = (key: string) => `public.${key}`;

export default {
  data() {
    return {
      rooms: ROOMS.map((room) => ({ ...room, name: settingName(room.key) })),
      submitting: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            public: z.object(
              Object.fromEntries(
                ALL_SETTINGS.map(({ key, fallback }) => [
                  key,
                  z.number().int().min(0).default(fallback),
                ]),
              ),
            ),
          }),
        ),
        initialValues: {
          public: Object.fromEntries(
            ALL_SETTINGS.map(({ key, fallback }) => [key, fallback]),
          ),
        },
      }),
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler(newVal: Array<{ name: string; value: string | null }>) {
        for (const setting of newVal) {
          if (
            !ALL_SETTINGS.some(({ key }) => settingName(key) === setting.name)
          ) {
            continue;
          }

          const parsed = Number(setting.value);
          if (!Number.isNaN(parsed)) {
            (this.form.setFieldValue as any)(setting.name, parsed);
          }
        }
        this.form.resetForm({ values: this.form.values });
      },
    },
  },
  methods: {
    async updateSettings() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        const values =
          ((this.form.values as any).public as Record<string, number>) ?? {};

        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings: [
              {
                objects: ALL_SETTINGS.map(({ key, fallback }) => ({
                  name: settingName(key),
                  value: String(values[key] ?? fallback),
                })),
                on_conflict: {
                  constraint: settings_constraint.settings_pkey,
                  update_columns: [settings_update_column.value],
                },
              },
              {
                __typename: true,
              },
            ],
          }),
        });

        toast({
          title: this.$t("pages.settings.application.chat.updated"),
        });
      } finally {
        this.submitting = false;
      }
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
  },
};
</script>
