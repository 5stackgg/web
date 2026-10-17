<template>
  <div class="flex h-[calc(100svh-6rem)] min-w-0 flex-col gap-4">
    <PageTransition :delay="0">
      <h1 class="flex min-w-0 items-baseline gap-2">
        <span
          class="min-w-0 truncate text-xl font-semibold leading-tight"
          :class="!node?.label && 'font-mono text-base font-medium'"
          >{{ node?.label || nodeId }}</span
        >
        <span class="shrink-0 text-sm text-muted-foreground">{{
          $t("game_server.files")
        }}</span>
      </h1>
    </PageTransition>

    <PageTransition :delay="60" class="min-h-0 flex-1">
      <div
        class="h-full overflow-hidden rounded-md border border-border bg-card/20"
      >
        <FileManagerContainer :node-id="nodeId" :open-path="openPath" />
      </div>
    </PageTransition>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { computed } from "vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import FileManagerContainer from "~/components/file-manager/FileManagerContainer.vue";
import { generateQuery } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";

definePageMeta({ middleware: "admin" });

const route = useRoute();
const router = useRouter();

// Deep-linked from a plugin so an admin lands on its config directory rather
// than the root of the node.
const openPath = computed(() => (useRoute().query.path as string) || undefined);

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
