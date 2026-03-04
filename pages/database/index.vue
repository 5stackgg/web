<template>
  <PageTransition :delay="100">
    <div class="space-y-4">
      <h1 class="text-2xl font-semibold">{{ $t("pages.database.title") }}</h1>

      <Tabs v-model="activeTab" default-value="queries" class="w-full">
        <div class="flex items-center justify-between gap-4 mb-4">
          <!-- Mobile: dropdown select -->
          <div class="lg:hidden w-full">
            <Select v-model="activeTab">
              <SelectTrigger class="w-full" aria-label="Database section">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="tab in tabItems"
                  :key="tab.value"
                  :value="tab.value"
                >
                  {{ tab.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <!-- Desktop: horizontal tabs -->
          <TabsList class="hidden lg:flex">
            <TabsTrigger
              v-for="tab in tabItems"
              :key="tab.value"
              :value="tab.value"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>

          <div class="flex items-center gap-2">
            <!-- Refresh Interval with Pause Icon -->
            <ButtonGroup>
              <Button
                variant="outline"
                size="sm"
                class="px-3 h-9"
                @click="forceRefresh"
              >
                <RefreshCwIcon
                  :class="[
                    'w-4 h-4 transition-transform',
                    isRefreshing && 'animate-spin',
                  ]"
                />
              </Button>
              <Select v-model="refreshInterval" :disabled="isPaused">
                <SelectTrigger
                  data-slot="select-trigger"
                  class="w-14 h-9 [&>svg]:hidden text-center justify-center"
                >
                  <SelectValue
                    :placeholder="$t('pages.database.auto_refresh.interval')"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3s</SelectItem>
                  <SelectItem value="5">5s</SelectItem>
                  <SelectItem value="10">10s</SelectItem>
                  <SelectItem value="15">15s</SelectItem>
                  <SelectItem value="30">30s</SelectItem>
                  <SelectItem value="60">60s</SelectItem>
                </SelectContent>
              </Select>
              <Button
                :variant="isPaused ? 'default' : 'outline'"
                size="sm"
                class="px-3 h-9"
                @click="togglePause"
              >
                <component
                  :is="isPaused ? PlayIcon : PauseIcon"
                  class="w-4 h-4"
                />
              </Button>
            </ButtonGroup>
          </div>
        </div>

        <Transition name="database-tab-fade" mode="out-in">
          <component :is="activeTabComponent" :key="activeTab" />
        </Transition>
      </Tabs>
    </div>
  </PageTransition>
</template>

<script lang="ts">
import {
  PlayIcon,
  PauseIcon,
  ChevronDownIcon,
  RefreshCwIcon,
} from "lucide-vue-next";
import PageTransition from "@/components/ui/transitions/PageTransition.vue";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QueryPerformanceTab from "@/components/database/QueryPerformanceTab.vue";
import ConnectionsTab from "@/components/database/ConnectionsTab.vue";
import LocksTransactionsTab from "@/components/database/LocksTransactionsTab.vue";
import IOBufferStatsTab from "@/components/database/IOBufferStatsTab.vue";
import IndexUsageTab from "@/components/database/IndexUsageTab.vue";
import StorageTab from "@/components/database/StorageTab.vue";
import TimescaleTab from "@/components/database/TimescaleTab.vue";
import BackupsTab from "@/components/database/BackupsTab.vue";

export default {
  components: {
    PageTransition,
    Button,
    ButtonGroup,
    Card,
    CardContent,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tabs,
    TabsList,
    TabsTrigger,
    QueryPerformanceTab,
    ConnectionsTab,
    LocksTransactionsTab,
    IOBufferStatsTab,
    IndexUsageTab,
    StorageTab,
    TimescaleTab,
    BackupsTab,
    PlayIcon,
    PauseIcon,
    RefreshCwIcon,
  },
  data() {
    return {
      activeTab: "queries",
      refreshInterval: "5",
      isPaused: false,
      refreshTrigger: 0,
      loadingCount: 0,
      PlayIcon,
      PauseIcon,
      RefreshCwIcon,
    };
  },
  computed: {
    tabItems() {
      return [
        { value: "queries", label: this.$t("pages.database.tabs.queries") },
        {
          value: "connections",
          label: this.$t("pages.database.tabs.connections"),
        },
        { value: "locks", label: this.$t("pages.database.tabs.locks") },
        { value: "io", label: this.$t("pages.database.tabs.io") },
        {
          value: "index-usage",
          label: this.$t("pages.database.tabs.index_usage"),
        },
        { value: "storage", label: this.$t("pages.database.tabs.storage") },
        { value: "timescale", label: this.$t("pages.database.tabs.timescale") },
        { value: "backups", label: this.$t("pages.database.tabs.backups") },
      ];
    },
    activeTabComponent() {
      const map: Record<string, any> = {
        queries: QueryPerformanceTab,
        connections: ConnectionsTab,
        locks: LocksTransactionsTab,
        io: IOBufferStatsTab,
        "index-usage": IndexUsageTab,
        storage: StorageTab,
        timescale: TimescaleTab,
        backups: BackupsTab,
      };
      return map[this.activeTab] || QueryPerformanceTab;
    },
    pollInterval() {
      if (this.isPaused) {
        return 0; // 0 disables polling in Apollo
      }
      return parseInt(this.refreshInterval) * 1000;
    },
    isRefreshing() {
      return this.loadingCount > 0;
    },
  },
  provide() {
    return {
      pollInterval: () => this.pollInterval,
      refreshTrigger: () => this.refreshTrigger,
    };
  },
  methods: {
    togglePause() {
      this.isPaused = !this.isPaused;
    },
    forceRefresh() {
      // Show spinning animation
      this.loadingCount++;
      // Increment trigger to force child components to refresh
      this.refreshTrigger++;
      // Stop animation after 1 second
      setTimeout(() => {
        this.loadingCount = Math.max(0, this.loadingCount - 1);
      }, 1000);
    },
  },
};
</script>
<style scoped>
.database-tab-fade-enter-active,
.database-tab-fade-leave-active {
  transition:
    opacity 150ms ease-out,
    transform 150ms ease-out;
}

.database-tab-fade-enter-from,
.database-tab-fade-leave-to {
  opacity: 0;
  transform: translateY(2px);
}
</style>
