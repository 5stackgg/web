<script setup lang="ts">
import { useApolloClient } from "@vue/apollo-composable";
import { useForm } from "vee-validate";
import { z } from "zod";
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "~/components/ui/toast";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import VideoEncoderField from "~/components/settings/VideoEncoderField.vue";

const schema = z.object({
  video_encoder: z.enum(["auto", "gpu", "cpu"]).default("auto"),
  live_video_codec: z.enum(["h264", "h265"]).default("h264"),
  clip_video_codec: z.enum(["h264", "h265"]).default("h264"),
  clip_fps: z.enum(["30", "60"]).default("60"),
  clip_resolution: z.enum(["720p", "1080p"]).default("1080p"),
});
type Values = z.infer<typeof schema>;
const names = Object.keys(schema.shape) as (keyof Values)[];
const store = useApplicationSettingsStore();
const { client } = useApolloClient();
const { t } = useI18n();
const submitting = ref(false);
const storedValues = computed(() => {
  const rows = Object.fromEntries(
    store.settings.map(({ name, value }) => [name, value]),
  );
  const mode = rows.video_encoder?.trim().toLowerCase();
  return {
    video_encoder: mode === "gpu" || mode === "cpu" ? mode : "auto",
    live_video_codec: rows.live_video_codec === "h265" ? "h265" : "h264",
    clip_video_codec: rows.clip_video_codec === "h265" ? "h265" : "h264",
    clip_fps: rows.clip_fps === "30" ? "30" : "60",
    clip_resolution: rows.clip_resolution === "720p" ? "720p" : "1080p",
  } satisfies Values;
});
const form = useForm<Values>({
  validationSchema: Object.fromEntries(
    Object.entries(schema.shape).map(([name, field]) => [
      name,
      (value: unknown) => {
        const result = field.safeParse(value);
        return result.success || result.error.issues[0].message;
      },
    ]),
  ),
  initialValues: storedValues.value,
});
// Reconcile only the field that changed in the subscription. Updates to access,
// storage or a different output setting must not discard an unsaved draft.
for (const name of names) {
  watch(
    () => storedValues.value[name],
    (value) => form.resetField(name, { value }),
  );
}
const fields = [
  {
    name: "live_video_codec",
    description: "live_codec_description",
    options: ["h264", "h265"],
  },
  {
    name: "clip_video_codec",
    description: "clip_codec_description",
    options: ["h264", "h265"],
  },
  {
    name: "clip_fps",
    description: "clip_fps_description",
    options: ["60", "30"],
  },
  {
    name: "clip_resolution",
    description: "clip_resolution_description",
    options: ["1080p", "720p"],
  },
] as const;
const labelKey = (name: string) =>
  `pages.settings.application.${name === "live_video_codec" ? "streaming" : "demo_settings"}.${name}`;
const descriptionKey = (field: (typeof fields)[number]) =>
  `pages.settings.application.${field.name.endsWith("codec") ? "encoding" : "demo_settings"}.${field.description}`;
function optionLabel(name: string, value: string) {
  if (name.endsWith("codec"))
    return t(`pages.settings.application.streaming.codec_${value}`);
  return name === "clip_fps" ? `${value} FPS` : value;
}
async function updateSettings() {
  if (submitting.value) return;
  submitting.value = true;
  try {
    if (!(await form.validate()).valid) return;
    const values = schema.parse(form.values);
    const objects = names
      .filter((name) => values[name] !== storedValues.value[name])
      .map((name) => ({ name, value: values[name] }));
    if (!objects.length) return;
    await client.mutate({
      mutation: generateMutation({
        insert_settings: [
          {
            objects,
            on_conflict: {
              constraint: settings_constraint.settings_pkey,
              update_columns: [settings_update_column.value],
            },
          },
          { __typename: true },
        ],
      }),
    });
    for (const { name, value } of objects) form.resetField(name, { value });
    toast({ title: t("pages.settings.application.encoding.updated") });
  } catch {
    toast({
      title: t("pages.settings.application.encoding.save_failed"),
      variant: "destructive",
    });
  } finally {
    submitting.value = false;
  }
}
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
          <p class="text-sm text-muted-foreground">
            {{ $t("pages.settings.application.encoding.hardware_description") }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ $t("pages.settings.application.encoding.apply_description") }}
          </p>
        </SettingsSection>

        <SettingsSection
          v-for="section in ['live', 'clips']"
          :key="section"
          :id="section"
          :title="$t(`pages.settings.application.encoding.${section}_section`)"
        >
          <FormField
            v-for="field in fields.filter((field) =>
              section === 'live'
                ? field.name === 'live_video_codec'
                : field.name !== 'live_video_codec',
            )"
            :key="field.name"
            v-slot="{ componentField }"
            :name="field.name"
          >
            <FormItem>
              <FormLabel>{{ $t(labelKey(field.name)) }}</FormLabel>
              <FormDescription>{{ $t(descriptionKey(field)) }}</FormDescription>
              <Select v-bind="componentField" :disabled="submitting">
                <FormControl
                  ><SelectTrigger><SelectValue /></SelectTrigger
                ></FormControl>
                <SelectContent>
                  <SelectItem
                    v-for="option in field.options"
                    :key="option"
                    :value="option"
                    >{{ optionLabel(field.name, option) }}</SelectItem
                  >
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>
        </SettingsSection>

        <p class="text-sm text-muted-foreground">
          {{ $t("pages.settings.application.encoding.nodes_description") }}
          <NuxtLink
            to="/gpu-nodes"
            class="font-medium text-primary hover:underline"
            >{{ $t("pages.gpu_nodes.title") }}</NuxtLink
          >
        </p>
        <SettingsSaveBar
          :dirty="form.meta.value.dirty"
          :submitting="submitting"
          @save="updateSettings"
          @discard="form.resetForm()"
        />
      </form>
    </PageTransition>
  </SettingsPage>
</template>
