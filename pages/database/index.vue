<template>
  <div class="relative space-y-6 [--tac-clip:14px] [--tac-clip-sm:10px]">
    <div
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 -z-10 opacity-[0.04] [background-image:linear-gradient(hsl(var(--tac-amber))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--tac-amber))_1px,transparent_1px)] [background-size:64px_64px]"
    />

    <PageTransition :delay="0">
      <Tabs v-model="activeTab" default-value="queries" class="w-full">
        <div
          class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="lg:hidden">
            <Select v-model="activeTab">
              <SelectTrigger
                class="w-full"
                :aria-label="$t('ui.tooltips.database_section')"
              >
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

          <TabsList :class="[tacticalTabsListClasses, 'hidden lg:flex']">
            <TabsTrigger
              v-for="tab in tabItems"
              :key="tab.value"
              :value="tab.value"
              :class="tacticalTabsTriggerClasses"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>

          <div
            class="flex items-stretch gap-[1px] rounded-md border border-border bg-border overflow-hidden"
          >
            <button
              class="grid place-items-center bg-card/80 px-2.5 py-2 text-muted-foreground transition-colors hover:text-[hsl(var(--tac-amber))]"
              @click="forceRefresh"
            >
              <RefreshCwIcon
                :class="[
                  'h-3.5 w-3.5 transition-transform',
                  isRefreshing && 'animate-spin',
                ]"
              />
            </button>

            <div class="bg-card/80">
              <Select v-model="refreshInterval" :disabled="isPaused">
                <SelectTrigger
                  class="h-full w-14 border-none bg-transparent font-mono text-[0.65rem] tracking-widest shadow-none focus:ring-0 [&>svg]:hidden"
                >
                  <SelectValue />
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
            </div>

            <button
              class="grid place-items-center px-2.5 py-2 transition-colors"
              :class="
                isPaused
                  ? 'bg-[hsl(var(--tac-amber)/0.18)] text-[hsl(var(--tac-amber))]'
                  : 'bg-card/80 text-muted-foreground hover:text-[hsl(var(--tac-amber))]'
              "
              @click="togglePause"
            >
              <component
                :is="isPaused ? PlayIcon : PauseIcon"
                class="h-3.5 w-3.5"
              />
            </button>
          </div>
        </div>

        <div class="mt-4">
          <Transition v-bind="databaseTabFadeTransition" mode="out-in">
            <component :is="activeTabComponent" :key="activeTab" />
          </Transition>
        </div>
      </Tabs>
    </PageTransition>
  </div>
</template>

<script lang="ts">
import {
  PlayIcon,
  PauseIcon,
  ChevronDownIcon,
  RefreshCwIcon,
  DatabaseIcon,
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
import {
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";
import QueryPerformanceTab from "@/components/database/QueryPerformanceTab.vue";
import ConnectionsTab from "@/components/database/ConnectionsTab.vue";
import LocksTransactionsTab from "@/components/database/LocksTransactionsTab.vue";
import IOBufferStatsTab from "@/components/database/IOBufferStatsTab.vue";
import IndexUsageTab from "@/components/database/IndexUsageTab.vue";
import StorageTab from "@/components/database/StorageTab.vue";
import TimescaleTab from "@/components/database/TimescaleTab.vue";
import BackupsTab from "@/components/database/BackupsTab.vue";

const databaseTabFadeTransition = {
  enterActiveClass: "transition-all duration-150 ease-out",
  leaveActiveClass: "transition-all duration-150 ease-out",
  enterFromClass: "translate-y-[2px] opacity-0",
  leaveToClass: "translate-y-[2px] opacity-0",
};

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
    DatabaseIcon,
  },
  setup() {
    const activeTab = useRouteTab({
      defaultTab: "queries",
      tabs: [
        "queries",
        "connections",
        "locks",
        "io",
        "index-usage",
        "storage",
        "timescale",
        "backups",
      ],
    });

    return { activeTab };
  },
  data() {
    return {
      refreshInterval: "5",
      isPaused: false,
      refreshTrigger: 0,
      loadingCount: 0,
      PlayIcon,
      PauseIcon,
      RefreshCwIcon,
      databaseTabFadeTransition,
      tacticalTabsListClasses,
      tacticalTabsTriggerClasses,
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
        return 0;
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
      this.loadingCount++;
      this.refreshTrigger++;
      setTimeout(() => {
        this.loadingCount = Math.max(0, this.loadingCount - 1);
      }, 1000);
    },
  },
};
</script>
