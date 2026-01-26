<template>
  <div class="flex flex-col h-screen">
    <PageHeading>
      <template #title>Game Server Node Files</template>
      <template #description>
        Manage custom plugins and shared files for node {{ nodeId }}
      </template>
      <template #actions>
        <Button variant="outline" @click="navigateBack">
          <ArrowLeft class="w-4 h-4 mr-2" />
          Back
        </Button>
      </template>
    </PageHeading>

    <div class="flex-1 overflow-hidden">
      <Card class="h-full">
        <FileManagerContainer :node-id="nodeId" />
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageHeading from "~/components/PageHeading.vue";
import FileManagerContainer from "~/components/file-manager/FileManagerContainer.vue";
import { ArrowLeft } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();

const nodeId = computed(() => route.params.nodeId as string);

onMounted(() => {
  // Check if user is administrator
  const authStore = useAuthStore();
  if (!authStore.isAdmin) {
    void router.push("/");
  }
});

function navigateBack() {
  router.back();
}
</script>

<style scoped>
.flex-1 {
  min-height: 0;
}
</style>
