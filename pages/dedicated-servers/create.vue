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
    <Card class="w-1/2 p-4">
      <server-form></server-form>
    </Card>
  </div>
</template>
