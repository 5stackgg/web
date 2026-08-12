<script setup lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";
import { Switch } from "@/components/ui/switch";
import { ExternalLink } from "lucide-vue-next";
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
          id="access"
          :title="$t('pages.settings.application.streaming.access_section')"
        >
          <FormField
            v-slot="{ componentField }"
            name="public.minimum_role_to_spectate"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.streaming.minimum_role_to_spectate",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.streaming.minimum_role_to_spectate_description",
                )
              }}</FormDescription>
              <FormControl>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem
                        :value="role.value"
                        v-for="role in roles"
                        :key="role.value"
                      >
                        <span class="capitalize">{{ role.display }}</span>
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField
            v-slot="{ componentField }"
            name="public.minimum_role_to_stream"
          >
            <FormItem>
              <FormLabel>{{
                $t(
                  "pages.settings.application.streaming.minimum_role_to_stream",
                )
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.streaming.minimum_role_to_stream_description",
                )
              }}</FormDescription>
              <FormControl>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem
                        :value="role.value"
                        v-for="role in roles"
                        :key="role.value"
                      >
                        <span class="capitalize">{{ role.display }}</span>
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          id="require-login"
          :title="
            $t('pages.settings.application.streaming.require_login_section')
          "
          :description="
            $t('pages.settings.application.streaming.require_login_description')
          "
          clickable-header
          @header-click="toggleRequireLogin"
        >
          <template #action>
            <Switch
              :model-value="requireLoginEnabled"
              @update:model-value="toggleRequireLogin"
            />
          </template>
        </SettingsSection>

        <SettingsSection
          id="voice-chat"
          :title="$t('pages.settings.application.streaming.voice_chat_section')"
          :description="
            $t('pages.settings.application.streaming.voice_chat_description')
          "
          clickable-header
          @header-click="toggleVoiceChat"
        >
          <template #action>
            <Switch
              :model-value="voiceChatEnabled"
              @update:model-value="toggleVoiceChat"
            />
          </template>
        </SettingsSection>

        <SettingsSection
          id="player-cameras"
          :title="
            $t('pages.settings.application.streaming.player_cameras_section')
          "
          :description="
            $t('pages.settings.application.streaming.player_cameras_description')
          "
          clickable-header
          @header-click="togglePlayerCameras"
        >
          <template #action>
            <Switch
              :model-value="playerCamerasEnabled"
              @update:model-value="togglePlayerCameras"
            />
          </template>

          <!-- Platform defaults for newly created matches. Existing matches
               keep whatever they were set up with. -->
          <div v-if="playerCamerasEnabled" class="mt-4 space-y-4 border-t pt-4">
            <div
              class="flex cursor-pointer items-center justify-between gap-4"
              @click="toggleCameraRequiredDefault"
            >
              <div class="space-y-0.5">
                <p class="text-sm font-medium">
                  {{
                    $t("pages.settings.application.streaming.camera_default")
                  }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.application.streaming.camera_default_description",
                    )
                  }}
                </p>
              </div>
              <Switch
                class="pointer-events-none"
                :model-value="cameraRequiredDefault"
              />
            </div>

            <div
              class="flex items-center justify-between gap-4"
              :class="
                cameraRequiredDefault
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed opacity-50'
              "
              @click="cameraRequiredDefault && toggleCameraTeammatesDefault()"
            >
              <div class="space-y-0.5">
                <p class="text-sm font-medium">
                  {{
                    $t("pages.settings.application.streaming.teammates_default")
                  }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{
                    $t(
                      "pages.settings.application.streaming.teammates_default_description",
                    )
                  }}
                </p>
              </div>
              <Switch
                class="pointer-events-none"
                :disabled="!cameraRequiredDefault"
                :model-value="cameraTeammatesDefault"
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          id="encoding"
          :title="$t('pages.settings.application.streaming.encoding_section')"
        >
          <FormField v-slot="{ componentField }" name="live_video_codec">
            <FormItem>
              <FormLabel>{{
                $t("pages.settings.application.streaming.live_video_codec")
              }}</FormLabel>
              <FormDescription>{{
                $t(
                  "pages.settings.application.streaming.live_video_codec_description",
                )
              }}</FormDescription>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="h265">
                    {{ $t("pages.settings.application.streaming.codec_h265") }}
                  </SelectItem>
                  <SelectItem value="h264">
                    {{ $t("pages.settings.application.streaming.codec_h264") }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <SettingsSection
          id="playcast"
          :title="$t('pages.settings.application.streaming.playcast')"
          :description="
            $t('pages.settings.application.streaming.playcast_description')
          "
          clickable-header
          @header-click="togglePlaycast"
        >
          <template #action>
            <Switch
              :model-value="playcastEnabled"
              @update:model-value="togglePlaycast"
            />
          </template>

          <a
            href="https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive_Broadcast"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            {{ $t("pages.settings.application.streaming.playcast_learn_more") }}
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
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

export default {
  data() {
    return {
      submitting: false,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            public: z.object({
              minimum_role_to_stream: z
                .string()
                .default(e_player_roles_enum.verified_user),
              minimum_role_to_spectate: z
                .string()
                .default(e_player_roles_enum.streamer),
            }),
            live_video_codec: z.enum(["h265", "h264"]).default("h264"),
          }),
        ),
      }),
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler(newVal) {
        for (const setting of newVal) {
          if (setting.name === "live_video_codec") {
            this.form.setFieldValue(
              setting.name,
              setting.value === "h265" ? "h265" : "h264",
            );
            continue;
          }
          this.form.setFieldValue(setting.name, setting.value);
        }
        this.form.resetForm({ values: this.form.values });
      },
    },
  },
  methods: {
    async togglePlaycast() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "use_playcast",
                value: this.playcastEnabled ? "false" : "true",
              },
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
        title: this.$t("pages.settings.application.streaming.updated"),
      });
    },
    async toggleRequireLogin() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.require_login_for_live_streams",
                value: this.requireLoginEnabled ? "false" : "true",
              },
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
        title: this.$t("pages.settings.application.streaming.updated"),
      });
    },
    async toggleVoiceChat() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.voice_chat_enabled",
                value: this.voiceChatEnabled ? "false" : "true",
              },
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
        title: this.$t("pages.settings.application.streaming.updated"),
      });
    },
    async setSetting(name: string, value: boolean) {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: { name, value: value ? "true" : "false" },
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
        title: this.$t("pages.settings.application.streaming.updated"),
      });
    },
    toggleCameraRequiredDefault() {
      return this.setSetting(
        "public.camera_required_default",
        !this.cameraRequiredDefault,
      );
    },
    toggleCameraTeammatesDefault() {
      return this.setSetting(
        "public.camera_allow_teammates_default",
        !this.cameraTeammatesDefault,
      );
    },
    async togglePlayerCameras() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.player_cameras_enabled",
                value: this.playerCamerasEnabled ? "false" : "true",
              },
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
        title: this.$t("pages.settings.application.streaming.updated"),
      });
    },
    async updateSettings() {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      try {
        const roleToStream =
          this.form.values.public?.minimum_role_to_stream ??
          e_player_roles_enum.verified_user;
        const roleToSpectate =
          this.form.values.public?.minimum_role_to_spectate ??
          e_player_roles_enum.streamer;

        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings: [
              {
                objects: [
                  {
                    name: "public.minimum_role_to_stream",
                    value: roleToStream,
                  },
                  {
                    name: "public.minimum_role_to_spectate",
                    value: roleToSpectate,
                  },
                  {
                    name: "live_video_codec",
                    value: this.form.values.live_video_codec ?? "h264",
                  },
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

        toast({
          title: this.$t("pages.settings.application.streaming.updated"),
        });
      } finally {
        this.submitting = false;
      }
    },
  },
  computed: {
    roles() {
      return [
        { value: e_player_roles_enum.user, display: this.$t("roles.user") },
        {
          value: e_player_roles_enum.verified_user,
          display: this.$t("roles.verified_user"),
        },
        {
          value: e_player_roles_enum.streamer,
          display: this.$t("roles.streamer"),
        },
        {
          value: e_player_roles_enum.match_organizer,
          display: this.$t("roles.match_organizer"),
        },
        {
          value: e_player_roles_enum.tournament_organizer,
          display: this.$t("roles.tournament_organizer"),
        },
        {
          value: e_player_roles_enum.administrator,
          display: this.$t("roles.administrator"),
        },
      ];
    },
    settings() {
      return useApplicationSettingsStore().settings;
    },
    playcastEnabled() {
      const playcastSetting = this.settings.find(
        (setting: { name: string; value: string | null }) =>
          setting.name === "use_playcast",
      );

      if (playcastSetting) {
        return playcastSetting.value === "true";
      }

      return false;
    },
    voiceChatEnabled() {
      return useApplicationSettingsStore().voiceChatEnabled;
    },
    cameraRequiredDefault() {
      return useApplicationSettingsStore().cameraRequiredDefault;
    },
    cameraTeammatesDefault() {
      return useApplicationSettingsStore().cameraAllowTeammatesDefault;
    },
    playerCamerasEnabled() {
      return useApplicationSettingsStore().playerCamerasEnabled;
    },
    requireLoginEnabled() {
      return useApplicationSettingsStore().requireLoginForLiveStreams;
    },
  },
};
</script>
