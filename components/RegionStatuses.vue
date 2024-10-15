<script lang="ts" setup></script>

<template>
  <Table>
    <TableBody>
      <TableRow v-for="region in regions" :key="region.value">
        <TableCell class="flex items-center gap-4">
          <span
            class="inline-block h-2 w-2 rounded-full"
            :class="{
              'bg-red-600': region.status === 'Offline',
              'bg-green-600': region.status === 'Online',
              'bg-yellow-600': region.status === 'Partial',
            }"
          ></span>
          <span>{{ region.description }}</span>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>

<script lang="ts">
import { useApplicationSettingsStore } from "~/stores/applicationSettings";

export default {
  computed: {
    regions() {
      return useApplicationSettingsStore().availableRegions;
    },
  },
};
</script>
