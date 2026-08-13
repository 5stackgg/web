<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
</script>

<template>
  <SettingsPage>
    <!-- Cameras have no on/off of their own: an organizer turns them on per
         match. These only decide what a newly created match starts with. -->
    <PageTransition :delay="0">
      <SettingsSection
        id="camera-defaults"
        :title="$t('pages.settings.application.cameras.defaults_section')"
        :description="
          $t('pages.settings.application.cameras.defaults_description')
        "
      >
        <div class="space-y-4">
          <div
            class="flex cursor-pointer items-center justify-between gap-4"
            @click="
              save('public.camera_required_default', !cameraRequiredDefault)
            "
          >
            <div class="space-y-0.5">
              <p class="text-sm font-medium">
                {{ $t("pages.settings.application.cameras.required_default") }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{
                  $t(
                    "pages.settings.application.cameras.required_default_description",
                  )
                }}
              </p>
            </div>
            <Switch
              class="pointer-events-none"
              :model-value="cameraRequiredDefault"
            />
          </div>

          <!-- Meaningless on its own: there is nothing to watch unless a match
               requires cameras in the first place. -->
          <div
            class="flex items-center justify-between gap-4"
            :class="
              cameraRequiredDefault
                ? 'cursor-pointer'
                : 'cursor-not-allowed opacity-50'
            "
            @click="
              cameraRequiredDefault &&
              save('public.camera_allow_teammates_default', !teammatesDefault)
            "
          >
            <div class="space-y-0.5">
              <p class="text-sm font-medium">
                {{ $t("pages.settings.application.cameras.teammates_default") }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{
                  $t(
                    "pages.settings.application.cameras.teammates_default_description",
                  )
                }}
              </p>
            </div>
            <Switch
              class="pointer-events-none"
              :disabled="!cameraRequiredDefault"
              :model-value="teammatesDefault"
            />
          </div>
        </div>
      </SettingsSection>
    </PageTransition>

    <PageTransition :delay="120">
      <SettingsSection
        id="voice-chat"
        :title="$t('pages.settings.application.cameras.voice_section')"
        :description="$t('pages.settings.application.cameras.voice_description')"
        clickable-header
        @header-click="save('public.voice_chat_enabled', !voiceEnabled)"
      >
        <template #action>
          <Switch
            :model-value="voiceEnabled"
            @update:model-value="
              (value) => save('public.voice_chat_enabled', value)
            "
          />
        </template>
      </SettingsSection>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

export default {
  computed: {
    cameraRequiredDefault(): boolean {
      return useApplicationSettingsStore().cameraRequiredDefault;
    },
    teammatesDefault(): boolean {
      return useApplicationSettingsStore().cameraAllowTeammatesDefault;
    },
    voiceEnabled(): boolean {
      return useApplicationSettingsStore().voiceChatEnabled;
    },
  },
  methods: {
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
            {
              __typename: true,
            },
          ],
        }),
      });

      toast({
        title: this.$t("pages.settings.application.cameras.updated"),
      });
    },
  },
};
</script>
