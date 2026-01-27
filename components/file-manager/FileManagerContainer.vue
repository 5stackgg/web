<template>
  <div class="h-full flex flex-col">
    <!-- Location info -->
    <div class="p-4 border-b bg-muted/50">
      <div class="text-sm text-muted-foreground">
        <span class="font-medium">Location:</span>
        <code class="ml-2 px-2 py-1 bg-background rounded text-xs">
          {{
            store.isCustomPlugins
              ? "/opt/5stack/custom-plugins"
              : `/opt/5stack/servers/${serverId}`
          }}
        </code>
      </div>
    </div>

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
import { onMounted, onUnmounted, watch } from "vue";
import FileTree from "./FileTree.vue";
import FileDetailsPanel from "./FileDetailsPanel.vue";
import { toast } from "@/components/ui/toast";

const props = defineProps<{
  nodeId: string;
  serverId?: string;
}>();

const store = useFileManagerStore();

// Watch for errors and show them as toasts
watch(
  () => store.error,
  (error) => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
      // Clear the error from store after showing toast
      store.clearError();
    }
  },
);

onMounted(() => {
  void store.initialize(props.nodeId, props.serverId);
});

onUnmounted(() => {
  // Cleanup if needed
  store.fileTree.clear();
  store.expandedPaths.clear();
});
</script>
