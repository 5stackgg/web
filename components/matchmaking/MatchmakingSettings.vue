<script setup lang="ts">
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { Button } from "~/components/ui/button";
import { RefreshCw } from "lucide-vue-next";
import { Loader2 } from "lucide-vue-next";
</script>

<template>
  <div class="space-y-4">
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
          <Loader2 v-if="isRefreshing" class="h-4 w-4 mr-2 animate-spin" />
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
                {{ $t("pages.settings.matchmaking.region") }}
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
        return "Measuring...";
      }

      if (regionLatency < 30) {
        return "Excellent";
      }

      if (regionLatency < 50) {
        return "Good";
      }

      if (regionLatency < this.maxAcceptableLatency) {
        return "Fair";
      }

      return "Poor";
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
