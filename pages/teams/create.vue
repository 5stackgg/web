<script setup lang="ts">
import PageHeading from "~/components/PageHeading.vue";
import TeamForm from "~/components/teams/TeamForm.vue";
PageHeading;
</script>

<template>
  <div class="w-1/2">
    <PageHeading>
      <template #title> Create Team </template>
    </PageHeading>
    <team-form></team-form>
  </div>
</template>
