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

        <SettingsSection
          id="chat-attachments"
          :title="$t('pages.settings.application.chat.attachments_title')"
          :description="
            $t('pages.settings.application.chat.attachments_description')
          "
        >
          <FormField v-slot="{ componentField }" name="chat_attachment_max_mb">
            <FormItem>
              <FormLabel>
                {{ $t("pages.settings.application.chat.attachment_max_mb") }}
              </FormLabel>
              <FormControl>
                <Input
                  v-bind="componentField"
                  type="number"
                  min="1"
                  max="1024"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          id="chat-gifs"
          :title="$t('pages.settings.application.chat.gifs_title')"
          :description="$t('pages.settings.application.chat.gifs_description')"
        >
          <FormField v-slot="{ componentField }" name="giphy_api_key">
            <FormItem>
              <FormLabel>
                {{ $t("pages.settings.application.chat.giphy_api_key") }}
              </FormLabel>
              <div class="flex items-center gap-2">
                <FormControl>
                  <Input
                    v-bind="componentField"
                    type="password"
                    autocomplete="off"
                    :placeholder="
                      $t('pages.settings.application.chat.giphy_key_placeholder')
                    "
                  />
                </FormControl>
                <Button
                  v-if="giphyKeySet"
                  type="button"
                  variant="outline"
                  class="shrink-0"
                  @click="removeGiphyKey"
                >
                  {{ $t("pages.settings.application.chat.giphy_key_remove") }}
                </Button>
              </div>
              <FormDescription>
                {{
                  giphyKeySet
                    ? $t("pages.settings.application.chat.giphy_key_set")
                    : $t("pages.settings.application.chat.giphy_key_missing")
                }}
              </FormDescription>
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
import { useChatAttachmentConfig } from "~/composables/useChatAttachmentConfig";

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
  { key: "chat_ttl_tournament", label: "ttl_tournament", fallback: 604800 },
  { key: "chat_ttl_organizers", label: "ttl_organizers", fallback: 86400 },
];

const DIRECT_RETENTION = {
  key: "chat_retention_direct_days",
  fallback: 365,
};

const ALL_SETTINGS = [...ROOMS, DIRECT_RETENTION];

// Admin-only, so not `public.`: the api enforces the limit and hands the
// composer only what it needs.
const ATTACHMENT_MAX_MB = { name: "chat_attachment_max_mb", fallback: 100 };

// Write-only: the administrator role cannot read it back
// (public_settings.yaml), so the field only ever holds a new key.
const GIPHY_API_KEY = "giphy_api_key";

const settingName = (key: string) => `public.${key}`;

export default {
  data() {
    return {
      rooms: ROOMS.map((room) => ({ ...room, name: settingName(room.key) })),
      submitting: false,
      mediaConfig: useChatAttachmentConfig(),
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
            chat_attachment_max_mb: z
              .number()
              .int()
              .min(1)
              .max(1024)
              .default(ATTACHMENT_MAX_MB.fallback),
            giphy_api_key: z.string().trim().max(200).optional(),
          }),
        ),
        initialValues: {
          public: Object.fromEntries(
            ALL_SETTINGS.map(({ key, fallback }) => [key, fallback]),
          ),
          chat_attachment_max_mb: ATTACHMENT_MAX_MB.fallback,
          giphy_api_key: "",
        },
      }),
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler(newVal: Array<{ name: string; value: string | null }>) {
        for (const setting of newVal) {
          if (setting.name === ATTACHMENT_MAX_MB.name) {
            const megabytes = Number(setting.value);
            if (Number.isInteger(megabytes) && megabytes > 0) {
              (this.form.setFieldValue as any)(
                ATTACHMENT_MAX_MB.name,
                megabytes,
              );
            }
            continue;
          }

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
        const maxMb =
          (this.form.values as any).chat_attachment_max_mb ??
          ATTACHMENT_MAX_MB.fallback;
        const giphyKey = String(
          (this.form.values as any).giphy_api_key ?? "",
        ).trim();

        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings: [
              {
                objects: [
                  ...ALL_SETTINGS.map(({ key, fallback }) => ({
                    name: settingName(key),
                    value: String(values[key] ?? fallback),
                  })),
                  { name: ATTACHMENT_MAX_MB.name, value: String(maxMb) },
                  ...(giphyKey ? [{ name: GIPHY_API_KEY, value: giphyKey }] : []),
                ],
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

        if (giphyKey) {
          (this.form.setFieldValue as any)(GIPHY_API_KEY, "");
          this.form.resetForm({ values: this.form.values });
          await this.mediaConfig.load(true);
        }

        toast({
          title: this.$t("pages.settings.application.chat.updated"),
        });
      } finally {
        this.submitting = false;
      }
    },
    // An empty key is how the api reads "no key": the role cannot delete a
    // row it is not allowed to select.
    async removeGiphyKey() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings: [
            {
              objects: [{ name: GIPHY_API_KEY, value: "" }],
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

      await this.mediaConfig.load(true);

      toast({
        title: this.$t("pages.settings.application.chat.giphy_key_removed"),
      });
    },
  },
  mounted() {
    void this.mediaConfig.load(true);
  },
  computed: {
    giphyKeySet(): boolean {
      return !!this.mediaConfig.config?.gifs;
    },
    settings() {
      return useApplicationSettingsStore().settings;
    },
  },
};
</script>
