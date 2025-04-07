<script setup lang="ts">
import ServiceLogs from "~/components/ServiceLogs.vue";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
</script>

<template>
  <div class="flex flex-col space-y-4">
    <Tabs default-value="api" orientation="vertical">
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
              :checked="followLogs"
              @click="followLogs = !followLogs"
            >
            </Switch>
            {{ $t("pages.system_logs.follow_logs") }}
          </div>

          <div class="flex items-center gap-2">
            <Switch
              class="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
              :checked="timestamps"
              @click="timestamps = !timestamps"
            >
            </Switch>
            {{ $t("pages.system_logs.timestamps") }}
          </div>
        </div>
      </div>

      <TabsContent v-for="service in services" :key="service" :value="service">
        <ServiceLogs
          :service="service"
          :timestamps="timestamps"
          :follow-logs="followLogs"
        />
      </TabsContent>
    </Tabs>
  </div>
</template>

<script lang="ts">
export default {
  data() {
    return {
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
