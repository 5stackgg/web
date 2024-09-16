<script setup lang="ts">
import TimezoneFlag from "~/components/TimezoneFlag.vue";

definePageMeta({
  layout: "settings",
});
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">Appearance</h3>
    <p class="text-sm text-muted-foreground">
      Customize the appearance of the app. Automatically switch between day and
      night themes.
    </p>
  </div>
  <Separator />

  <form>I AM TIMEXONE: <TimezoneFlag></TimezoneFlag></form>
</template>

<script lang="ts">
export default {};
</script>
