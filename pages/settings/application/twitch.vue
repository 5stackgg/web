<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import SettingsSaveBar from "~/components/settings/SettingsSaveBar.vue";
import FadeSwap from "~/components/ui/transitions/FadeSwap.vue";
import { ExternalLink } from "lucide-vue-next";

const TWITCH_CONSOLE_URL = "https://dev.twitch.tv/console/apps";
</script>

<template>
  <SettingsPage>
    <PageTransition>
      <form @submit.prevent="updateSettings" class="space-y-6">
        <SettingsSection
          id="twitch-app"
          :title="$t('pages.settings.application.twitch.app_section')"
          :description="
            $t('pages.settings.application.twitch.app_section_description')
          "
        >
          <div class="space-y-2">
            <Label for="twitch-redirect-url">
              {{ $t("pages.settings.application.twitch.redirect_url") }}
            </Label>
            <Input
              id="twitch-redirect-url"
              :model-value="redirectUrl"
              readonly
              class="font-mono text-xs"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <p class="text-sm text-muted-foreground">
              {{
                $t("pages.settings.application.twitch.redirect_url_description")
              }}
              <a
                :href="TWITCH_CONSOLE_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 font-medium text-[hsl(var(--tac-amber))] underline-offset-2 hover:underline"
              >
                {{ $t("pages.settings.application.twitch.console_link") }}
                <ExternalLink class="h-3.5 w-3.5" />
              </a>
            </p>
          </div>

          <FormField v-slot="{ componentField }" name="twitch_client_id">
            <FormItem>
              <FormLabel>
                {{ $t("pages.settings.application.twitch.client_id") }}
              </FormLabel>
              <FormControl>
                <Input
                  v-bind="componentField"
                  autocomplete="off"
                  spellcheck="false"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="twitch_client_secret">
            <FormItem>
              <FormLabel>
                {{ $t("pages.settings.application.twitch.client_secret") }}
              </FormLabel>
              <div class="flex items-center gap-2">
                <FormControl>
                  <Input
                    v-bind="componentField"
                    type="password"
                    autocomplete="new-password"
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    :placeholder="
                      $t(
                        'pages.settings.application.twitch.client_secret_placeholder',
                      )
                    "
                  />
                </FormControl>
                <Button
                  v-if="secretState !== 'none'"
                  type="button"
                  variant="outline"
                  class="shrink-0"
                  @click="removeSecret"
                >
                  {{ $t("pages.settings.application.twitch.secret_remove") }}
                </Button>
              </div>
              <FormDescription>
                <FadeSwap>
                  <span :key="secretState">{{ secretStatus }}</span>
                </FadeSwap>
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

const CLIENT_ID = "twitch_client_id";

// Write-only: the administrator role cannot read it back
// (public_settings.yaml), so the field only ever holds a new secret.
const CLIENT_SECRET = "twitch_client_secret";

function upsertSettings(objects: Array<{ name: string; value: string }>) {
  return generateMutation({
    insert_settings: [
      {
        objects,
        on_conflict: {
          constraint: settings_constraint.settings_pkey,
          update_columns: [settings_update_column.value],
        },
      },
      {
        __typename: true,
      },
    ],
  });
}

export default {
  data() {
    return {
      submitting: false,
      secretWritten: null as boolean | null,
      form: useForm({
        validationSchema: toTypedSchema(
          z.object({
            twitch_client_id: z.string().trim().max(200).optional(),
            twitch_client_secret: z.string().trim().max(200).optional(),
          }),
        ),
        initialValues: {
          twitch_client_id: "",
          twitch_client_secret: "",
        },
      }),
    };
  },
  watch: {
    settings: {
      immediate: true,
      handler(newVal: Array<{ name: string; value: string | null }>) {
        const clientId = newVal.find(({ name }) => name === CLIENT_ID);
        (this.form.setFieldValue as any)(CLIENT_ID, clientId?.value ?? "");
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
        const values = this.form.values as Record<string, string | undefined>;
        const secret = String(values[CLIENT_SECRET] ?? "").trim();

        await (this as any).$apollo.mutate({
          mutation: upsertSettings([
            { name: CLIENT_ID, value: String(values[CLIENT_ID] ?? "").trim() },
            ...(secret ? [{ name: CLIENT_SECRET, value: secret }] : []),
          ]),
        });

        if (secret) {
          this.secretWritten = true;
          (this.form.setFieldValue as any)(CLIENT_SECRET, "");
          this.form.resetForm({ values: this.form.values });
        }

        toast({
          title: this.$t("pages.settings.application.twitch.updated"),
        });
      } finally {
        this.submitting = false;
      }
    },
    // An empty secret is how the api reads "no secret": the role cannot
    // delete a row it is not allowed to select.
    async removeSecret() {
      await (this as any).$apollo.mutate({
        mutation: upsertSettings([{ name: CLIENT_SECRET, value: "" }]),
      });

      this.secretWritten = false;

      toast({
        title: this.$t("pages.settings.application.twitch.secret_removed"),
      });
    },
  },
  computed: {
    settings() {
      return useApplicationSettingsStore().settings;
    },
    // Nothing the browser can read says whether a secret alone is saved:
    // public.supports_twitch needs the client ID as well, so without it the
    // page only knows what it wrote itself.
    secretState(): "set" | "saved" | "none" | "unknown" {
      if (this.secretWritten === true) {
        return "saved";
      }
      if (this.secretWritten === false) {
        return "none";
      }
      return useApplicationSettingsStore().supportsTwitch ? "set" : "unknown";
    },
    secretStatus(): string {
      return this.$t(
        `pages.settings.application.twitch.secret_${this.secretState}`,
      );
    },
    redirectUrl(): string {
      return `https://${useRuntimeConfig().public.webDomain}/auth/twitch/callback`;
    },
  },
};
</script>
