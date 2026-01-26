<template>
  <div class="file-manager-container h-full flex flex-col">
    <!-- Location info -->
    <div class="p-4 border-b bg-muted/50">
      <div class="text-sm text-muted-foreground">
        <span class="font-medium">Location:</span>
        <code class="ml-2 px-2 py-1 bg-background rounded text-xs">
          {{ store.isCustomPlugins ? '/opt/5stack/custom-plugins' : `/opt/5stack/servers/${serverId}` }}
        </code>
      </div>
    </div>

    <!-- Error alert -->
    <Alert v-if="store.error" variant="destructive" class="m-4">
      <AlertTriangle class="w-4 h-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {{ store.error }}
      </AlertDescription>
      <Button
        variant="outline"
        size="sm"
        class="mt-2"
        @click="store.clearError"
      >
        Dismiss
      </Button>
    </Alert>

    <!-- Main content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- File tree sidebar -->
      <FileTree />

      <!-- File details panel -->
      <FileDetailsPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import FileTree from "./FileTree.vue";
import FileDetailsPanel from "./FileDetailsPanel.vue";
import { AlertTriangle } from "lucide-vue-next";

const props = defineProps<{
  nodeId: string;
  serverId?: string;
}>();

const store = useFileManagerStore();

onMounted(() => {
  void store.initialize(props.nodeId, props.serverId);
});

onUnmounted(() => {
  // Cleanup if needed
  store.fileTree.clear();
  store.expandedPaths.clear();
});
</script>

<style scoped>
.file-manager-container {
  background: var(--background);
}
</style>
