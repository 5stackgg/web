<template>
  <div class="flex flex-col h-[calc(100svh-6rem)]">
    <PageTransition>
      <PageHeading>
        <template #title>
          <span class="capitalize">
            {{ server?.label }}
          </span>
          Dedicated Server Files
        </template>
        <template #description>
          {{ $t("common.manage_custom_plugins_and_shared_files") }}
        </template>
      </PageHeading>
    </PageTransition>

    <PageTransition :delay="100" class="mt-6">
      <div class="flex-1 overflow-hidden">
        <Card class="h-full">
          <FileManagerContainer
            v-if="server"
            :node-id="server.game_server_node_id"
            :server-id="serverId"
          />
          <div v-else class="p-8 text-center text-muted-foreground">
            Loading server information...
          </div>
        </Card>
      </div>
    </PageTransition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Card } from "@/components/ui/card";
import PageHeading from "~/components/PageHeading.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { generateQuery } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import FileManagerContainer from "~/components/file-manager/FileManagerContainer.vue";

const route = useRoute();
const router = useRouter();

const serverId = computed(() => route.params.serverId as string);
const server = ref<{
  id: string;
  label: string;
  game_server_node_id: string;
  game_server_node: {
    id: string;
    node_ip: string;
  };
} | null>(null);

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
            label: true,
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
      server.value = response.data.servers_by_pk;
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
