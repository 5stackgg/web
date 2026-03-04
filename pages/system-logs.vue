<script setup lang="ts">
import ServiceLogs from "~/components/ServiceLogs.vue";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
</script>

<template>
  <PageTransition :delay="100">
    <Tabs v-model="activeService" default-value="api" orientation="vertical">
      <div class="flex items-center justify-between flex-col lg:flex-row">
        <TabsList class="lg:inline-flex grid grid-cols-1 w-full lg:w-fit">
          <TabsTrigger
            class="capitalize"
            v-for="service in services"
            :key="service"
            :value="service"
          >
            {{ service }}
          </TabsTrigger>
        </TabsList>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <Switch
              class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
              :model-value="followLogs"
              @click="followLogs = !followLogs"
            >
            </Switch>
            {{ $t("pages.system_logs.follow_logs") }}
          </div>

          <div class="flex items-center gap-2">
            <Switch
              class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
              :model-value="timestamps"
              @click="timestamps = !timestamps"
            >
            </Switch>
            {{ $t("pages.system_logs.timestamps") }}
          </div>
        </div>
      </div>

      <Transition name="system-logs-tab-fade" mode="out-in">
        <TabsContent :key="activeService" :value="activeService">
          <ServiceLogs
            :service="activeService"
            :timestamps="timestamps"
            :follow-logs="followLogs"
            @follow-logs-changed="(value: boolean) => (followLogs = value)"
          />
        </TabsContent>
      </Transition>
    </Tabs>
  </PageTransition>
</template>

<script lang="ts">
export default {
  data() {
    return {
      activeService: "api",
      _timestamps: true,
      _followLogs: true,
      services: [
        `api`,
        "web",
        "game-server-node",
        "hasura",
        "typesense",
        "timescaledb",
        "redis",
        "minio",
      ],
    };
  },
  created() {
    this.syncServiceFromRoute();
  },
  watch: {
    "$route.query.service"() {
      this.syncServiceFromRoute();
    },
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
  methods: {
    syncServiceFromRoute() {
      const service = this.$route?.query?.service as string | undefined;
      if (service && this.services.includes(service)) {
        this.activeService = service;
      }
    },
  },
};
</script>

<style scoped>
.system-logs-tab-fade-enter-active,
.system-logs-tab-fade-leave-active {
  transition:
    opacity 150ms ease-out,
    transform 150ms ease-out;
}

.system-logs-tab-fade-enter-from,
.system-logs-tab-fade-leave-to {
  opacity: 0;
  transform: translateY(2px);
}
</style>
