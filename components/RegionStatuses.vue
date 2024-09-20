<script lang="ts" setup>
import PageHeading from "~/components/PageHeading.vue";
</script>

<template>
  <Table>
    <TableBody>
      <TableRow v-for="region in regions" :key="region.value">
        <TableCell>
          <span
            class="ml-1 inline-block h-2 w-2 rounded-full"
            :class="{
              'bg-red-600': region.status === 'Offline',
              'bg-green-600': region.status === 'Online',
              'bg-yellow-600': region.status === 'Partial',
            }"
          >
          </span>
          {{ region.description }}
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>

<script lang="ts">
import { useMatchMakingStore } from "~/stores/MatchMakingStore";

export default {
  computed: {
    regions() {
      return useMatchMakingStore().regions;
    },
  },
};
</script>
