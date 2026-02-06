<template>
  <div class="flex flex-col h-[calc(100svh-6rem)]">
    <PageTransition>
      <PageHeading>
        <template #title>
          <span class="capitalize">
            {{ node?.label || nodeId }}
          </span>
          Game Server Node Files
        </template>
        <template #description>
          {{ $t("common.manage_custom_plugins_and_shared_files") }}
        </template>
      </PageHeading>
    </PageTransition>

    <PageTransition :delay="100" class="mt-6">
      <div class="flex-1 overflow-hidden">
        <Card class="h-full">
          <FileManagerContainer :node-id="nodeId" />
        </Card>
      </div>
    </PageTransition>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { Card } from "@/components/ui/card";
import PageHeading from "~/components/PageHeading.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FileManagerContainer from "~/components/file-manager/FileManagerContainer.vue";
import { generateQuery } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";

const route = useRoute();
const router = useRouter();

const nodeId = computed(() => route.params.nodeId as string);

const node = ref<{
  id: string;
  label: string;
} | null>(null);

onMounted(async () => {
  const authStore = useAuthStore();
  if (!authStore.isAdmin) {
    void router.push("/");
  }

  const response = await getGraphqlClient().query({
    query: generateQuery({
      game_server_nodes_by_pk: [
        {
          id: nodeId.value,
        },
        {
          id: true,
          label: true,
        },
      ],
    }),
  });

  if (response.data.game_server_nodes_by_pk) {
    node.value = response.data.game_server_nodes_by_pk;
  }
});
</script>

<style scoped>
.flex-1 {
  min-height: 0;
}
</style>
