<script setup lang="ts">
import { AlertTriangle } from "lucide-vue-next";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import SettingsPage from "~/components/settings/SettingsPage.vue";
import SettingsSection from "~/components/settings/SettingsSection.vue";
import AnimatedFilters from "~/components/common/AnimatedFilters.vue";

definePageMeta({
  middleware: "admin",
});
</script>

<template>
  <SettingsPage>
    <PageTransition :delay="0">
      <div class="space-y-6">
        <SettingsSection
          id="release-channel"
          :title="$t('pages.settings.application.release_channel.section')"
          :description="
            $t('pages.settings.application.release_channel.description')
          "
        >
          <AnimatedFilters
            :model-value="currentChannel"
            :options="channelOptions"
            square
            size="lg"
            @update:model-value="selectChannel"
          />

          <div
            v-if="onBeta"
            class="flex items-start gap-3 rounded-lg border border-[hsl(var(--tac-amber))]/40 bg-[hsl(var(--tac-amber))]/10 p-4 text-sm"
          >
            <AlertTriangle
              class="h-5 w-5 mt-0.5 flex-shrink-0 text-[hsl(var(--tac-amber))]"
            />
            <p class="text-muted-foreground">
              {{ $t("pages.settings.application.release_channel.beta_warning") }}
            </p>
          </div>

          <div v-if="onBeta && serviceStatuses.length > 0" class="space-y-3">
            <h4
              class="text-sm font-semibold uppercase tracking-wider text-foreground"
            >
              {{ $t("pages.settings.application.release_channel.service_status") }}
            </h4>
            <ul class="space-y-2">
              <li
                v-for="service in serviceStatuses"
                :key="service.service"
                class="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-2 text-sm"
              >
                <span class="font-mono">{{ service.service }}</span>
                <span
                  v-if="service.fellBack"
                  class="text-[hsl(var(--tac-amber))]"
                >
                  {{
                    $t("pages.settings.application.release_channel.fell_back")
                  }}
                </span>
                <span v-else class="capitalize text-muted-foreground">{{
                  service.tag
                }}</span>
              </li>
            </ul>
          </div>
        </SettingsSection>
      </div>
    </PageTransition>
  </SettingsPage>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { toast } from "@/components/ui/toast";

interface ReleaseChannelServiceStatus {
  service: string;
  tag: string;
  fellBack: boolean;
}

export default {
  data() {
    return {
      submitting: false,
    };
  },
  methods: {
    async selectChannel(channel: string) {
      if (this.submitting || channel === this.currentChannel) {
        return;
      }
      this.submitting = true;
      try {
        await (this as any).$apollo.mutate({
          mutation: generateMutation({
            setReleaseChannel: [
              {
                channel,
              },
              {
                success: true,
              },
            ],
          }),
        });

        toast({
          title: this.$t(
            "pages.settings.application.release_channel.updated",
          ) as string,
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
    currentChannel(): string {
      const value = this.settings.find(
        (setting: { name: string; value: string | null }) =>
          setting.name === "release_channel",
      )?.value;

      return value === "beta" ? "beta" : "latest";
    },
    onBeta(): boolean {
      return this.currentChannel === "beta";
    },
    channelOptions() {
      return [
        {
          key: "latest",
          label: this.$t("pages.settings.application.release_channel.latest"),
          disabled: this.submitting,
        },
        {
          key: "beta",
          label: this.$t("pages.settings.application.release_channel.beta"),
          disabled: this.submitting,
        },
      ];
    },
    releaseChannelStatus(): {
      channel: string;
      services: ReleaseChannelServiceStatus[];
    } | null {
      const raw = this.settings.find(
        (setting: { name: string; value: string | null }) =>
          setting.name === "release_channel_status",
      )?.value;

      if (!raw) {
        return null;
      }

      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    serviceStatuses(): ReleaseChannelServiceStatus[] {
      return this.releaseChannelStatus?.services ?? [];
    },
  },
};
</script>
