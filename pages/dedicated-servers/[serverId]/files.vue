<template>
  <div class="flex flex-col h-screen">
    <PageHeading>
      <template #title>Dedicated Server Files</template>
      <template #description>
        Manage files for dedicated server {{ serverId }}
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
        <FileManagerContainer
          v-if="nodeId"
          :node-id="nodeId"
          :server-id="serverId"
        />
        <div v-else class="p-8 text-center text-muted-foreground">
          Loading server information...
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageHeading from "~/components/PageHeading.vue";
import { generateQuery } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import FileManagerContainer from "~/components/file-manager/FileManagerContainer.vue";

const route = useRoute();
const router = useRouter();

const serverId = computed(() => route.params.serverId as string);
const nodeId = ref<string | null>(null);

onMounted(async () => {
  // Check if user is administrator
  const authStore = useAuthStore();
  if (!authStore.isAdmin) {
    await router.push("/");
    return;
  }

  // Fetch server information to get node_id
  try {
    const response = await getGraphqlClient().query({
      query: generateQuery({
        servers_by_pk: [
          {
            id: serverId.value,
          },
          {
            id: true,
            game_server_node_id: true,
            game_server_node: {
              id: true,
              node_ip: true,
            },
          },
        ],
      }),
    });

    if (response.data.servers_by_pk) {
      nodeId.value = response.data.servers_by_pk.game_server_node_id;
    }
  } catch (error) {
    console.error("Error fetching server:", error);
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
