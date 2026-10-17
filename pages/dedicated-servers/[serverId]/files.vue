<template>
  <div class="flex h-[calc(100svh-6rem)] min-w-0 flex-col gap-4">
    <PageTransition :delay="0">
      <h1 class="flex min-w-0 items-baseline gap-2">
        <span class="min-w-0 truncate text-xl font-semibold leading-tight">
          <template v-if="server">{{ server.label }}</template>
          <Skeleton v-else class="inline-block h-5 w-40 align-middle" />
        </span>
        <span class="shrink-0 text-sm text-muted-foreground">{{
          $t("pages.dedicated_servers.detail.files")
        }}</span>
      </h1>
    </PageTransition>

    <PageTransition :delay="60" class="min-h-0 flex-1">
      <div
        class="h-full overflow-hidden rounded-md border border-border bg-card/20"
      >
        <p
          v-if="isMigrating"
          class="p-8 text-center text-sm text-muted-foreground"
        >
          {{ $t("file_manager.server_moving") }}
        </p>
        <FileManagerContainer
          v-else-if="server && nodeId"
          :key="nodeId"
          :node-id="nodeId"
          :server-id="serverId"
        />
        <p v-else class="p-8 text-center text-sm text-muted-foreground">
          {{ $t("file_manager.loading_server_info") }}
        </p>
      </div>
    </PageTransition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Skeleton } from "~/components/ui/skeleton";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { generateQuery } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import FileManagerContainer from "~/components/file-manager/FileManagerContainer.vue";
import { useServerMigration } from "~/composables/useServerMigration";

definePageMeta({ middleware: "admin" });

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

const { server: migratingServer, isMigrating } = useServerMigration(
  serverId,
  computed(() => useAuthStore().isAdmin),
);

const nodeId = computed(
  () =>
    migratingServer.value?.game_server_node_id ??
    server.value?.game_server_node_id,
);

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
</script>
