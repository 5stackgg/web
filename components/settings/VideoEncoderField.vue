<script setup lang="ts">
defineProps<{ disabled?: boolean }>();
</script>

<template>
<FormField v-slot="{ componentField }" name="video_encoder">
  <FormItem>
    <FormLabel>{{
      $t("pages.settings.application.streaming.video_encoder")
    }}</FormLabel>
    <FormDescription>{{
      $t(
        "pages.settings.application.streaming.video_encoder_description",
      )
    }}</FormDescription>
    <Select v-bind="componentField" :disabled="disabled">
      <FormControl>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        <SelectItem value="auto">
          {{ $t("pages.settings.application.streaming.encoder_auto") }}
        </SelectItem>
        <SelectItem value="gpu">
          {{ $t("pages.settings.application.streaming.encoder_gpu") }}
        </SelectItem>
        <SelectItem value="cpu">
          {{ $t("pages.settings.application.streaming.encoder_cpu") }}
        </SelectItem>
      </SelectContent>
    </Select>
    <FormMessage />
  </FormItem>
</FormField>
</template>
