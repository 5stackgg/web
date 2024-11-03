<script setup lang="ts">
import SystemLogs from "~/components/SystemLogs.vue";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
</script>

<template>
  <div class="flex flex-col space-y-4">
    <Tabs default-value="api" class="w-full">
      <TabsList>
        <TabsTrigger
          v-for="service in services"
          :key="service"
          :value="service"
        >
          {{ service }}
        </TabsTrigger>
      </TabsList>

      <TabsContent v-for="service in services" :key="service" :value="service">
          <SystemLogs :service="service" />
      </TabsContent>
    </Tabs>
  </div>
</template>

<script lang="ts">
export default {
  data() {
    return {
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
};
</script>
