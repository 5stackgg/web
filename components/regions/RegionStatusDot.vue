<script lang="ts" setup>
defineProps<{
  status?: string | null;
}>();
</script>

<template>
  <span
    class="inline-block h-2 w-2 rounded-full shrink-0"
    :class="{
      'bg-red-500': status === 'Offline' || status === 'Disabled',
      'bg-green-500': status === 'Online',
      'bg-yellow-500': status === 'Partial',
      'bg-gray-500':
        !status ||
        !['Offline', 'Disabled', 'Online', 'Partial'].includes(status),
    }"
  />
</template>
