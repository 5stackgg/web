<script setup lang="ts">
import { e_player_roles_enum } from "~/generated/zeus";
import { Switch } from "@/components/ui/switch";
import { ExternalLink } from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";

definePageMeta({
  layout: "application-settings",
});
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

        <div class="flex justify-start">
          <Button
            type="submit"
            :disabled="Object.keys(form.errors).length > 0 || !form.meta.dirty"
            class="my-3"
          >
            {{ $t("common.update") }}
          </Button>
        </div>
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
            live_video_codec: z.enum(["h265", "h264"]).default("h265"),
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
              setting.value === "h264" ? "h264" : "h265",
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
    async updateSettings() {
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
                  value: this.form.values.live_video_codec ?? "h265",
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
  },
};
</script>
