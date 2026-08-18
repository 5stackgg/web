<script setup lang="ts">
import RegionStatuses from "~/components/RegionStatuses.vue";
import { Globe } from "lucide-vue-next";
</script>

<template>
  <Popover>
    <PopoverTrigger>
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe
          class="h-4 w-4"
          :class="{
            'text-green-500': overalRegionStatus === 'Online',
            'text-red-500': overalRegionStatus === 'Offline',
            'text-yellow-500': overalRegionStatus === 'Degraded',
          }"
          :title="statusLabel"
        />
      </div>
    </PopoverTrigger>
    <PopoverContent>
      <RegionStatuses></RegionStatuses>
    </PopoverContent>
  </Popover>
</template>

<script lang="ts">
export default {
  computed: {
    regions() {
      return useApplicationSettingsStore().availableRegions;
    },
    overalRegionStatus() {
      const statuses = this.regions?.map((region) => region.status);

      if (!statuses) {
        return;
      }

      if (statuses.every((status) => status === "Online")) {
        return "Online";
      } else if (statuses.every((status) => status === "Offline")) {
        return "Offline";
      } else {
        return "Degraded";
      }
    },
    statusLabel(): string {
      switch (this.overalRegionStatus) {
        case "Online":
          return this.$t("common.online");
        case "Offline":
          return this.$t("common.offline");
        case "Degraded":
          return this.$t("common.degraded");
        default:
          return "";
      }
    },
  },
};
</script>
