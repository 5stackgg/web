<script lang="ts" setup>
import StatusDot from "~/components/admin/StatusDot.vue";
import { regionTone } from "~/components/regions/regionStatus";

defineProps<{
  status?: string | null;
}>();
</script>

<template>
  <StatusDot :tone="regionTone(status)" />
</template>
