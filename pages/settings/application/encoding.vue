<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import VideoEncoderField from "~/components/settings/VideoEncoderField.vue";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <form @submit.prevent="updateSettings" class="space-y-6">
        <SettingsSection
          id="encoding"
          :title="$t('pages.settings.application.encoding.title')"
          :description="$t('pages.settings.application.encoding.description')"
        >
          <VideoEncoderField :disabled="submitting" />
        </SettingsSection>
        <SettingsSaveBar
          :dirty="form.meta.dirty"
          :submitting="submitting"
          @save="updateSettings"
          @discard="form.resetForm()"
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
            video_encoder: z.enum(["auto", "gpu", "cpu"]).default("auto"),
          }),
        ),
      }),
    };
  },
  computed: {
    storedEncoder(): "auto" | "gpu" | "cpu" {
      const value = useApplicationSettingsStore().settings
        .find((setting) => setting.name === "video_encoder")
        ?.value?.trim().toLowerCase();
      return value === "gpu" || value === "cpu" ? value : "auto";
    },
  },
  watch: {
    storedEncoder: {
      immediate: true,
      handler(video_encoder: "auto" | "gpu" | "cpu") {
        this.form.resetForm({ values: { video_encoder } });
      },
    },
  },
  methods: {
    async updateSettings() {
      if (this.submitting) return;
      this.submitting = true;
      try {
        const { valid } = await this.form.validate();
        if (!valid) return;
        const video_encoder = this.form.values.video_encoder ?? "auto";
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            insert_settings_one: [
              {
                object: {
                  name: "video_encoder",
                  value: video_encoder,
                },
                on_conflict: {
                  constraint: settings_constraint.settings_pkey,
                  update_columns: [settings_update_column.value],
                },
              },
              { __typename: true },
            ],
          }),
        });
        this.form.resetForm({ values: { video_encoder } });
        toast({ title: this.$t("pages.settings.application.encoding.updated") });
      } finally {
        this.submitting = false;
      }
    },
  },
};
</script>
