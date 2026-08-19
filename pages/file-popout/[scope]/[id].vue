<template>
  <div class="flex h-svh flex-col overflow-hidden bg-background text-foreground">
    <!-- Stands in for the window chrome a popup does not get. It is also the
         only thing telling you which node this window is pointed at, since
         there is no address bar to read. -->
    <header
      class="flex shrink-0 items-center gap-3 border-b border-border/60 bg-muted/30 px-4 py-2.5"
    >
      <HardDrive class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]" />

      <div class="flex min-w-0 items-baseline gap-2">
        <h1 class="truncate text-sm font-semibold">
          {{ title }}
        </h1>
        <span
          class="shrink-0 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground"
        >
          {{
            scope === "server"
              ? $t("file_manager.scope_server")
              : $t("file_manager.scope_node")
          }}
        </span>
      </div>

      <span
        v-if="openPath"
        class="ml-auto hidden min-w-0 truncate font-mono text-xs text-muted-foreground md:block"
        :title="openPath"
      >
        {{ openPath }}
      </span>
    </header>

    <div class="min-h-0 flex-1 overflow-hidden">
      <FileManagerContainer
        v-if="ready"
        :node-id="nodeId"
        :server-id="scope === 'server' ? id : undefined"
        :open-path="openPath"
        class="h-full"
      />
      <p
        v-else
        class="p-8 text-center text-sm text-muted-foreground"
      >
        {{ $t("file_manager.loading_server_info") }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { HardDrive } from "lucide-vue-next";
import FileManagerContainer from "~/components/file-manager/FileManagerContainer.vue";
import { generateQuery } from "~/graphql/graphqlGen";
import getGraphqlClient from "~/graphql/getGraphqlClient";

definePageMeta({ layout: false });

const route = useRoute();

const scope = computed(() => route.params.scope as "node" | "server");
const id = computed(() => route.params.id as string);
const openPath = computed(() => (route.query.path as string) || undefined);

const label = ref<string | null>(null);
const nodeId = ref<string>("");
const ready = ref(false);

const title = computed(() => label.value || id.value);

useHead({
  title: computed(() =>
    label.value ? `${label.value} — Files` : "Files",
  ),
});

onMounted(async () => {
  // The window is opened by an administrator, but it is also a plain URL that
  // survives a bookmark, so it re-checks rather than trusting the opener.
  const authStore = useAuthStore();

  if (!authStore.isAdmin) {
    window.close();
    return;
  }

  const client = getGraphqlClient();

  if (scope.value === "server") {
    const { data } = await client.query({
      query: generateQuery({
        servers_by_pk: [
          { id: id.value },
          { id: true, label: true, game_server_node_id: true },
        ],
      }),
    });

    if (data.servers_by_pk) {
      label.value = data.servers_by_pk.label;
      nodeId.value = data.servers_by_pk.game_server_node_id;
      ready.value = true;
    }

    return;
  }

  nodeId.value = id.value;
  ready.value = true;

  const { data } = await client.query({
    query: generateQuery({
      game_server_nodes_by_pk: [{ id: id.value }, { id: true, label: true }],
    }),
  });

  if (data.game_server_nodes_by_pk) {
    label.value = data.game_server_nodes_by_pk.label;
  }
});
</script>
