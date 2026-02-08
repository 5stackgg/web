<template>
  <PageTransition :delay="100">
    <div class="space-y-4">
      <h1 class="text-2xl font-semibold">{{ $t("pages.database.title") }}</h1>

      <Tabs default-value="queries" class="w-full">
        <div class="flex items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="queries">{{
              $t("pages.database.tabs.queries")
            }}</TabsTrigger>
            <TabsTrigger value="connections">{{
              $t("pages.database.tabs.connections")
            }}</TabsTrigger>
            <TabsTrigger value="locks">{{
              $t("pages.database.tabs.locks")
            }}</TabsTrigger>
            <TabsTrigger value="io">{{
              $t("pages.database.tabs.io")
            }}</TabsTrigger>
            <TabsTrigger value="index-usage">{{
              $t("pages.database.tabs.index_usage")
            }}</TabsTrigger>
            <TabsTrigger value="storage">{{
              $t("pages.database.tabs.storage")
            }}</TabsTrigger>
            <TabsTrigger value="timescale">{{
              $t("pages.database.tabs.timescale")
            }}</TabsTrigger>
          </TabsList>

          <div class="flex items-center gap-2">
            <!-- Schema Filter -->
            <Popover>
              <PopoverTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  class="justify-between w-[180px]"
                >
                  <span
                    v-if="selectedSchemas.length === 0"
                    class="text-muted-foreground text-xs"
                  >
                    {{ $t("pages.database.filters.select_schemas") }}
                  </span>
                  <span
                    v-else-if="selectedSchemas.length === 1"
                    class="text-xs"
                  >
                    {{ selectedSchemas[0] }}
                  </span>
                  <span v-else class="text-xs">
                    {{ selectedSchemas.length }}
                    {{ $t("pages.database.filters.schemas_selected") }}
                  </span>
                  <ChevronDownIcon class="ml-2 h-4 w-4 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[200px] p-0">
                <Command>
                  <CommandInput
                    :placeholder="$t('pages.database.filters.search_schemas')"
                  />
                  <CommandEmpty>{{
                    $t("pages.database.filters.no_schemas")
                  }}</CommandEmpty>
                  <CommandList>
                    <CommandGroup>
                      <CommandItem
                        v-for="schema in availableSchemas"
                        :key="schema"
                        :value="schema"
                        @select="toggleSchema(schema)"
                      >
                        <div class="flex items-center pointer-events-none mr-2">
                          <Checkbox :model-value="selectedSchemas.includes(schema)" />
                        </div>
                        {{ schema }}
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <!-- Refresh Interval with Pause Icon -->
            <ButtonGroup>
              <Button
                variant="outline"
                size="sm"
                class="px-3 h-9"
                @click="forceRefresh"
              >
                <RefreshCwIcon
                  :class="['w-4 h-4 transition-transform', isRefreshing && 'animate-spin']"
                />
              </Button>
              <Select v-model="refreshInterval" :disabled="isPaused">
                <SelectTrigger data-slot="select-trigger" class="w-14 h-9 [&>svg]:hidden text-center justify-center">
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

        <TabsContent value="queries">
          <QueryPerformanceTab />
        </TabsContent>
        <TabsContent value="connections">
          <ConnectionsTab />
        </TabsContent>
        <TabsContent value="locks">
          <LocksTransactionsTab />
        </TabsContent>
        <TabsContent value="io">
          <IOBufferStatsTab />
        </TabsContent>
        <TabsContent value="index-usage">
          <IndexUsageTab />
        </TabsContent>
        <TabsContent value="storage">
          <StorageTab />
        </TabsContent>
        <TabsContent value="timescale">
          <TimescaleTab />
        </TabsContent>
      </Tabs>
    </div>
  </PageTransition>
</template>

<script lang="ts">
import { PlayIcon, PauseIcon, ChevronDownIcon, RefreshCwIcon } from "lucide-vue-next";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QueryPerformanceTab from "@/components/database/QueryPerformanceTab.vue";
import ConnectionsTab from "@/components/database/ConnectionsTab.vue";
import LocksTransactionsTab from "@/components/database/LocksTransactionsTab.vue";
import IOBufferStatsTab from "@/components/database/IOBufferStatsTab.vue";
import IndexUsageTab from "@/components/database/IndexUsageTab.vue";
import StorageTab from "@/components/database/StorageTab.vue";
import TimescaleTab from "@/components/database/TimescaleTab.vue";
import { generateQuery } from "~/graphql/graphqlGen";

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
    Popover,
    PopoverContent,
    PopoverTrigger,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Checkbox,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    QueryPerformanceTab,
    ConnectionsTab,
    LocksTransactionsTab,
    IOBufferStatsTab,
    IndexUsageTab,
    StorageTab,
    TimescaleTab,
    PlayIcon,
    PauseIcon,
    ChevronDownIcon,
    RefreshCwIcon,
  },
  data() {
    return {
      refreshInterval: "5",
      isPaused: false,
      availableSchemas: [] as string[],
      selectedSchemas: ["public"] as string[],
      refreshTrigger: 0,
      loadingCount: 0,
      PlayIcon,
      PauseIcon,
      RefreshCwIcon,
    };
  },
  computed: {
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
      selectedSchemas: () => this.selectedSchemas,
      refreshTrigger: () => this.refreshTrigger,
    };
  },
  methods: {
    togglePause() {
      this.isPaused = !this.isPaused;
    },
    toggleSchema(schema: string) {
      const index = this.selectedSchemas.indexOf(schema);
      if (index > -1) {
        this.selectedSchemas.splice(index, 1);
      } else {
        this.selectedSchemas.push(schema);
      }
    },
    resetSchemaFilter() {
      this.selectedSchemas = ["public"];
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
  apollo: {
    availableSchemas: {
      query: generateQuery({
        getSchemas: true,
      }),
      update: (data: any) => data.getSchemas || [],
      pollInterval: 0, // Only fetch once
    },
  },
};
</script>
