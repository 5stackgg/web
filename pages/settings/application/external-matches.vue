<script setup lang="ts">
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <SettingsSection
        id="external-matches"
        :title="$t('pages.settings.application.external_matches.section')"
      >
        <div
          class="flex cursor-pointer flex-row items-center justify-between"
          @click="save('public.external_matches_enabled', !enabled)"
        >
          <div class="space-y-0.5">
            <h4 class="text-base font-medium">
              {{ $t("pages.settings.application.external_matches.enabled") }}
            </h4>
            <p class="text-sm text-muted-foreground">
              {{
                $t(
                  "pages.settings.application.external_matches.enabled_description",
                )
              }}
            </p>
          </div>
          <Switch
            :model-value="enabled"
            @update:model-value="
              (v) => save('public.external_matches_enabled', v)
            "
          />
        </div>

        <div
          class="mt-5 flex cursor-pointer flex-row items-center justify-between border-t border-border/60 pt-5"
          @click="save('public.faceit_import_enabled', !faceitEnabled)"
        >
          <div class="space-y-0.5">
            <h4 class="text-base font-medium">
              {{
                $t(
                  "pages.settings.application.external_matches.faceit_enabled",
                  "Import Faceit Matches",
                )
              }}
            </h4>
            <p class="text-sm text-muted-foreground">
              {{
                $t(
                  "pages.settings.application.external_matches.faceit_enabled_description",
                  "Off by default. Poll linked players' Faceit match history (last 30 days) and import their matches. Requires External Matches enabled and a Faceit API key — demo download also needs Downloads API access.",
                )
              }}
            </p>
            <p class="text-xs text-muted-foreground" @click.stop>
              <a
                href="https://docs.5stack.gg/advanced/faceit-integration"
                target="_blank"
                rel="noopener"
                class="underline hover:text-foreground"
                >{{
                  $t(
                    "pages.settings.application.external_matches.faceit_setup_guide",
                  )
                }}</a
              >
              ·
              <a
                href="https://fce.gg/downloads-api-application"
                target="_blank"
                rel="noopener"
                class="underline hover:text-foreground"
                >{{
                  $t(
                    "pages.settings.application.external_matches.faceit_downloads_api_link",
                  )
                }}</a
              >
            </p>
          </div>
          <Switch
            :model-value="faceitEnabled"
            @update:model-value="(v) => save('public.faceit_import_enabled', v)"
          />
        </div>

        <div class="mt-5 flex flex-col gap-3 border-t border-border/60 pt-5">
          <div class="flex flex-row items-center justify-between">
            <div class="space-y-0.5">
              <h4 class="text-base font-medium">
                {{
                  $t(
                    "pages.settings.application.external_matches.faceit_test",
                    "Test Faceit Integration",
                  )
                }}
              </h4>
              <p class="text-sm text-muted-foreground">
                {{
                  $t(
                    "pages.settings.application.external_matches.faceit_test_description",
                    "Verify the Faceit API key works and whether it can download demos.",
                  )
                }}
              </p>
            </div>
            <Button
              variant="outline"
              :disabled="testing"
              @click.stop="testFaceit"
            >
              {{
                testing
                  ? $t(
                      "pages.settings.application.external_matches.faceit_testing",
                    )
                  : $t(
                      "pages.settings.application.external_matches.faceit_test_button",
                    )
              }}
            </Button>
          </div>
          <div
            v-if="testResult"
            class="space-y-1 rounded border border-border/60 bg-card/40 p-3 font-mono text-sm"
          >
            <div
              :class="
                testResult.dataApi.ok ? 'text-green-500' : 'text-destructive'
              "
            >
              {{ testResult.dataApi.ok ? "✓" : "✗" }}
              {{
                $t(
                  "pages.settings.application.external_matches.faceit_data_api",
                )
              }}
              — {{ testResult.dataApi.detail }}
            </div>
            <div
              :class="
                testResult.downloadApi.ok === true
                  ? 'text-green-500'
                  : testResult.downloadApi.ok === false
                    ? 'text-destructive'
                    : 'text-yellow-500'
              "
            >
              {{
                testResult.downloadApi.ok === true
                  ? "✓"
                  : testResult.downloadApi.ok === false
                    ? "✗"
                    : "⚠"
              }}
              {{
                $t(
                  "pages.settings.application.external_matches.faceit_downloads_api",
                )
              }}
              — {{ testResult.downloadApi.detail }}
            </div>
          </div>
        </div>
      </SettingsSection>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

type FaceitTestResult = {
  dataApi: { ok: boolean; detail: string };
  downloadApi: { ok: boolean | null; detail: string };
};

export default {
  data() {
    return {
      testing: false,
      testResult: null as FaceitTestResult | null,
    };
  },
  computed: {
    settings(): { name: string; value: string }[] {
      return useApplicationSettingsStore().settings;
    },
    enabled(): boolean {
      return (
        this.settings.find((s) => s.name === "public.external_matches_enabled")
          ?.value === "true"
      );
    },
    faceitEnabled(): boolean {
      return (
        this.settings.find((s) => s.name === "public.faceit_import_enabled")
          ?.value === "true"
      );
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
        title: this.$t("pages.settings.application.external_matches.updated"),
      });
    },
    async testFaceit() {
      this.testing = true;
      this.testResult = null;
      try {
        const { data } = await (this.$apollo as any).mutate({
          mutation: generateMutation({
            testFaceitIntegration: {
              dataApi: { ok: true, detail: true },
              downloadApi: { ok: true, detail: true },
            },
          }),
        });
        this.testResult = data.testFaceitIntegration as FaceitTestResult;
      } catch (error) {
        toast({
          title: this.$t(
            "pages.settings.application.external_matches.faceit_test_failed",
          ),
          description: (error as Error)?.message ?? String(error),
          variant: "destructive",
        });
      } finally {
        this.testing = false;
      }
    },
  },
};
</script>
