<script setup lang="ts">
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { RefreshCw } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
import { FormSection } from "~/components/ui/form";
import SettingHeader from "~/components/match/SettingHeader.vue";
import RegionLatency from "~/components/matchmaking/RegionLatency.vue";
</script>

<template>
  <div class="space-y-4">
    <FormSection
      :title="$t('pages.settings.matchmaking.show_match_ready_modal.title')"
    >
      <div class="flex items-center justify-between gap-4">
        <p class="flex-1 text-sm text-muted-foreground">
          {{
            $t("pages.settings.matchmaking.show_match_ready_modal.description")
          }}
        </p>
        <Switch
          :model-value="showMatchReadyModal"
          :disabled="!me"
          @update:model-value="updateShowMatchReadyModal"
        />
      </div>
    </FormSection>

    <FormSection>
      <div class="flex items-center justify-between gap-4 mb-4">
        <SettingHeader>
          {{ $t("pages.settings.matchmaking.max_acceptable_latency") }}
        </SettingHeader>
        <span class="text-xl font-medium">{{ playerMaxAcceptablelatnecy }}ms</span>
      </div>
      <input
        type="range"
        v-model="playerMaxAcceptablelatnecy"
        min="5"
        :max="maxAcceptableLatency"
        step="5"
        class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        @change="updateMaxAcceptableLatency"
      />
      <p class="text-sm text-muted-foreground mt-2">
        {{ $t("pages.settings.matchmaking.max_latency_description") }}
      </p>
    </FormSection>

    <FormSection
      :title="$t('common.region')"
      v-if="availableRegions.length > 0"
    >
      <template #actions>
        <Button
          variant="outline"
          size="sm"
          @click="refreshLatencies"
          :disabled="isRefreshing"
        >
          <Spinner v-if="isRefreshing" class="h-4 w-4 mr-2" />
          <RefreshCw v-else class="h-4 w-4 mr-2" />
          {{ $t("common.refresh") }}
        </Button>
      </template>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-border">
          <thead>
            <tr>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {{ $t("common.region") }}
              </th>
              <th
                class="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {{ $t("pages.settings.matchmaking.average_latency") }}
              </th>
              <th
                class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
              >
                {{ $t("pages.settings.matchmaking.preferred") }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <template v-for="region in availableRegions" :key="region.value">
              <tr
                v-if="
                  !region.is_lan || getRegionlatencyResult(region.value)?.isLan
                "
                class="hover:bg-muted/50 transition-colors"
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  {{ region.description || region.value }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                  <RegionLatency :region="region.value" />
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <Switch
                    class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
                    :model-value="isPreferredRegion(region.value)"
                    @click="togglePreferredRegion(region.value)"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </FormSection>
  </div>
</template>

<script lang="ts">
import { generateMutation } from "~/graphql/graphqlGen";
import { $ } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";
import { toast } from "@/components/ui/toast";

export default {
  data() {
    return {
      playerMaxAcceptablelatnecy: 75,
    };
  },
  mounted() {
    this.playerMaxAcceptablelatnecy =
      useMatchmakingStore().playerMaxAcceptableLatency || 75;
  },
  methods: {
    async refreshLatencies() {
      await useMatchmakingStore().refreshLatencies();
    },
    async updateShowMatchReadyModal(value: boolean) {
      if (!this.me) return;
      await this.$apollo.mutate({
        variables: { show: value },
        mutation: generateMutation({
          update_players_by_pk: [
            {
              pk_columns: { steam_id: this.me.steam_id },
              _set: { show_match_ready_modal: $("show", "Boolean!") },
            },
            { steam_id: true, show_match_ready_modal: true },
          ],
        }),
      });
      toast({ title: this.$t("pages.settings.account.update_success") });
    },
    togglePreferredRegion(region: string) {
      useMatchmakingStore().togglePreferredRegion(region);
    },
    updateMaxAcceptableLatency() {
      useMatchmakingStore().updateMaxAcceptableLatency(
        this.playerMaxAcceptablelatnecy,
      );
    },
    getRegionlatencyResult(region: string):
      | {
          isLan: boolean;
          latency: string;
        }
      | undefined {
      return useMatchmakingStore().getRegionlatencyResult(region);
    },
    isPreferredRegion(region: string): boolean {
      return (
        this.storedRegions.find((storedRegion) => {
          return storedRegion === region;
        }) !== undefined
      );
    },
  },
  computed: {
    me() {
      return useAuthStore().me;
    },
    showMatchReadyModal(): boolean {
      return this.me?.show_match_ready_modal !== false;
    },
    isRefreshing() {
      return useMatchmakingStore().isRefreshing;
    },
    storedRegions() {
      return useMatchmakingStore().storedRegions;
    },
    availableRegions() {
      return (
        useApplicationSettingsStore()?.availableRegions.filter(
          (region) => region.has_node,
        ) || []
      );
    },
    maxAcceptableLatency() {
      return useApplicationSettingsStore().maxAcceptableLatency || 100;
    },
  },
};
</script>
