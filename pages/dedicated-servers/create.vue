<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import ServerForm from "~/components/servers/ServerForm.vue";
</script>

<template>
  <div class="flex-grow flex flex-col gap-4">
    <PageHeading>
      <template #title>{{
        $t("pages.dedicated_servers.create.title")
      }}</template>
    </PageHeading>
    <div class="w-1/2">
      <server-form></server-form>
    </div>
  </div>
</template>
