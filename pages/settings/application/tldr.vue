<script setup lang="ts">
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import { Newspaper, ExternalLink, RefreshCw } from "lucide-vue-next";
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="tldr"
          :title="$t('pages.settings.application.tldr.section')"
          :description="$t('pages.settings.application.tldr.description')"
          clickable-header
          @header-click="toggleEnabled"
        >
          <template #action>
            <Switch
              :model-value="tldrNewsEnabled"
              @update:model-value="toggleEnabled"
            />
          </template>

          <div
            class="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm"
          >
            <Newspaper class="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
            <div class="space-y-2">
              <p class="text-muted-foreground">
                {{ $t("pages.settings.application.tldr.attribution") }}
              </p>
              <div class="flex flex-wrap gap-x-4 gap-y-1">
                <a
                  href="https://readtldr.gg"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  readtldr.gg
                  <ExternalLink class="h-3 w-3" />
                </a>
                <a
                  href="https://shop.readtldr.gg"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {{ $t("pages.settings.application.tldr.shop") }}
                  <ExternalLink class="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <div
            v-if="tldrNewsEnabled"
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-sm text-muted-foreground">
              {{ $t("pages.settings.application.tldr.rescan_description") }}
            </p>
            <Button variant="outline" class="gap-2 shrink-0" @click="rescan">
              <RefreshCw class="h-4 w-4" />
              {{ $t("pages.settings.application.tldr.rescan") }}
            </Button>
          </div>
        </SettingsSection>
      </div>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { settings_constraint, settings_update_column } from "~/generated/zeus";
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

export default {
  methods: {
    async toggleEnabled() {
      await (this as any).$apollo.mutate({
        mutation: generateMutation({
          insert_settings_one: [
            {
              object: {
                name: "public.tldr_news_enabled",
                value: this.tldrNewsEnabled ? "false" : "true",
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
        title: this.$t("pages.settings.application.tldr.updated"),
      });
    },
    async rescan() {
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            rescanTldrNews: {
              success: true,
            },
          }),
        });

        toast({
          title: this.$t("pages.settings.application.tldr.rescan_started"),
        });
      } catch (error) {
        toast({
          title: this.$t("pages.settings.application.tldr.rescan_failed"),
          variant: "destructive",
        });
      }
    },
  },
  computed: {
    tldrNewsEnabled() {
      return useApplicationSettingsStore().tldrNewsEnabled;
    },
  },
};
</script>
