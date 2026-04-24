<script setup lang="ts">
import ServiceLogs from "~/components/ServiceLogs.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Radio } from "lucide-vue-next";
import {
  tacticalTabsListClasses,
  tacticalTabsTriggerClasses,
} from "~/utilities/tacticalClasses";

const SYSTEM_LOG_SERVICES = [
  "api",
  "web",
  "game-server-node",
  "hasura",
  "typesense",
  "timescaledb",
  "redis",
  "minio",
];

const services = SYSTEM_LOG_SERVICES;

const activeService = useRouteTab({
  defaultTab: "api",
  tabs: SYSTEM_LOG_SERVICES,
  legacyParams: ["service"],
});
</script>

<template>
  <div class="relative space-y-6 [--tac-clip:14px] [--tac-clip-sm:10px]">
    <div
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 -z-10 opacity-[0.04] [background-image:linear-gradient(hsl(var(--tac-amber))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--tac-amber))_1px,transparent_1px)] [background-size:64px_64px]"
    />

    <PageTransition :delay="0">
      <div
        class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <Tabs v-model="activeService">
          <TabsList :class="tacticalTabsListClasses">
            <TabsTrigger
              v-for="service in services"
              :key="service"
              :value="service"
              :class="tacticalTabsTriggerClasses"
            >
              {{ service }}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div class="flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-2">
            <Switch
              :model-value="followLogs"
              @click="followLogs = !followLogs"
            />
            <Label class="text-sm cursor-pointer">
              {{ $t("pages.system_logs.follow_logs") }}
            </Label>
          </div>

          <div class="flex items-center gap-2">
            <Switch
              :model-value="timestamps"
              @click="timestamps = !timestamps"
            />
            <Label class="text-sm cursor-pointer">
              {{ $t("pages.system_logs.timestamps") }}
            </Label>
          </div>
        </div>
      </div>
    </PageTransition>

    <PageTransition :delay="60">
      <Transition v-bind="systemLogsTabFadeTransition" mode="out-in">
        <div :key="activeService">
          <ServiceLogs
            :service="activeService"
            :timestamps="timestamps"
            :follow-logs="followLogs"
            @follow-logs-changed="(value: boolean) => (followLogs = value)"
          />
        </div>
      </Transition>
    </PageTransition>
  </div>
</template>

<script lang="ts">
const systemLogsTabFadeTransition = {
  enterActiveClass: "transition-all duration-150 ease-out",
  leaveActiveClass: "transition-all duration-150 ease-out",
  enterFromClass: "translate-y-[2px] opacity-0",
  leaveToClass: "translate-y-[2px] opacity-0",
};

export default {
  data() {
    return {
      _timestamps: true,
      _followLogs: true,
      systemLogsTabFadeTransition,
    };
  },
  computed: {
    timestamps: {
      get() {
        return this._timestamps;
      },
      set(value: boolean) {
        this._timestamps = value;
      },
    },
    followLogs: {
      get() {
        return this._followLogs;
      },
      set(value: boolean) {
        this._followLogs = value;
      },
    },
  },
};
</script>
