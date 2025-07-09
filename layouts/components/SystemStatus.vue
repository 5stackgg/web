<script setup lang="ts">
import RegionStatuses from "~/components/RegionStatuses.vue";
</script>

<template>
  <Popover>
    <PopoverTrigger>
      <div class="flex items-center gap-2 text-sm text-muted-foreground">
        <div class="relative inline-flex">
          <span
            class="absolute inline-flex h-2 w-2 rounded-full animate-ping"
            :class="{
              'bg-red-500': overalRegionStatus === 'Offline',
              'bg-yellow-500': overalRegionStatus === 'Degraded',
            }"
            v-if="overalRegionStatus !== 'Online'"
          ></span>
          <span
            class="relative inline-flex h-2 w-2 rounded-full"
            :class="{
              'bg-green-500': overalRegionStatus === 'Online',
              'bg-red-500': overalRegionStatus === 'Offline',
              'bg-yellow-500': overalRegionStatus === 'Degraded',
            }"
            :title="overalRegionStatus"
          ></span>
        </div>
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
  },
};
</script>
