<script setup lang="ts">
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { RefreshCw } from "lucide-vue-next";
import { Spinner } from "~/components/ui/spinner";
</script>

<template>
  <div class="space-y-4">
    <div
      class="flex items-center justify-between gap-4 p-8 border border-border rounded-lg bg-card"
    >
      <div class="flex-1">
        <Label class="text-lg font-semibold">
          {{ $t("pages.settings.matchmaking.show_match_ready_modal.title") }}
        </Label>
        <p class="text-sm text-muted-foreground mt-1">
          {{
            $t("pages.settings.matchmaking.show_match_ready_modal.description")
          }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Spinner
          v-if="savingShowMatchReadyModal"
          class="h-4 w-4 text-muted-foreground"
        />
        <Switch
          :model-value="showMatchReadyModal"
          :disabled="savingShowMatchReadyModal || !me"
          @update:model-value="updateShowMatchReadyModal"
        />
      </div>
    </div>

    <div class="flex items-center p-8 border border-border rounded-lg bg-card">
      <div class="flex-1">
        <div class="flex justify-between mb-4">
          <Label class="text-lg font-semibold">
            {{ $t("pages.settings.matchmaking.max_acceptable_latency") }}
          </Label>

          <span class="text-xl font-medium"
            >{{ playerMaxAcceptablelatnecy }}ms</span
          >
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
      </div>
    </div>

    <div
      class="border border-border rounded-lg bg-card"
      v-if="availableRegions.length > 0"
    >
      <div class="p-4 flex justify-end">
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
      </div>
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
                class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
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
            <tr
              v-for="region in availableRegions"
              :key="region.value"
              :class="{
                'hover:bg-muted/50 transition-colors': true,
                'opacity-50':
                  !availableRegions.includes(region) &&
                  !isPreferredRegion(region.value),
              }"
            >
              <template
                v-if="
                  !region.is_lan || getRegionlatencyResult(region.value)?.isLan
                "
              >
                <td class="px-6 py-4 whitespace-nowrap">
                  {{ region.description || region.value }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <div
                      class="px-3 py-1 rounded-full text-xs font-medium"
                      :class="{
                        'bg-green-500/20 text-green-400':
                          getLatencyStatus(region.value) === 'Excellent',
                        'bg-blue-500/20 text-blue-400':
                          getLatencyStatus(region.value) === 'Good',
                        'bg-yellow-500/20 text-yellow-400':
                          getLatencyStatus(region.value) === 'Fair',
                        'bg-red-500/20 text-red-400':
                          getLatencyStatus(region.value) === 'Poor',
                        'bg-gray-500/20 text-gray-400':
                          getLatencyStatus(region.value) === 'Measuring',
                      }"
                    >
                      {{ getRegionLatency(region.value) }} ms
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <Switch
                    class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
                    :model-value="isPreferredRegion(region.value)"
                    @click="togglePreferredRegion(region.value)"
                  />
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
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
      savingShowMatchReadyModal: false,
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
      this.savingShowMatchReadyModal = true;
      try {
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
      } finally {
        this.savingShowMatchReadyModal = false;
      }
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
    getRegionLatency(region: string): number | undefined {
      const regionLatency = this.getRegionlatencyResult(region);
      if (!regionLatency) {
        return;
      }
      return Number(regionLatency.latency);
    },
    getLatencyStatus(region: string): string {
      const regionLatency = this.getRegionLatency(region);
      if (!regionLatency) {
        return this.$t("latency_status.measuring");
      }

      if (regionLatency < 30) {
        return this.$t("latency_status.excellent");
      }

      if (regionLatency < 50) {
        return this.$t("latency_status.good");
      }

      if (regionLatency < this.maxAcceptableLatency) {
        return this.$t("latency_status.fair");
      }

      return this.$t("latency_status.poor");
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
