<template>
  <div class="h-full flex flex-col">
    <!-- Location info -->
    <div class="p-4 border-b bg-muted/50">
      <div class="text-sm text-muted-foreground">
        <span class="font-medium">{{ $t("file_manager.location") }}:</span>
        <code class="ml-2 px-2 py-1 bg-background rounded text-xs">
          {{
            store.isCustomPlugins
              ? "/opt/5stack/custom-plugins"
              : `/opt/5stack/servers/${serverId}`
          }}
        </code>
      </div>
    </div>

    <!-- A deep link can point at a directory the plugin has not written yet.
         That is a normal state, not an error, so it offers the one action that
         resolves it instead of a red failure. -->
    <div
      v-if="store.missingPath"
      class="flex flex-wrap items-center gap-3 border-b border-[hsl(var(--tac-amber)/0.35)] bg-[hsl(var(--tac-amber)/0.06)] px-4 py-3"
    >
      <FolderPlus class="h-4 w-4 shrink-0 text-[hsl(var(--tac-amber))]" />

      <div class="min-w-0 flex-1">
        <p class="text-sm">{{ $t("file_manager.missing_path") }}</p>
        <code class="break-all font-mono text-xs text-muted-foreground">
          {{ store.missingPath }}
        </code>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" @click="store.missingPath = null">
          {{ $t("file_manager.missing_path_dismiss") }}
        </Button>
        <Button
          variant="tactical"
          size="sm"
          :loading="creatingMissing"
          @click="createMissing"
        >
          {{ $t("file_manager.missing_path_create") }}
        </Button>
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
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { FolderPlus } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import FileTree from "./FileTree.vue";
import FileDetailsPanel from "./FileDetailsPanel.vue";
import { toast } from "@/components/ui/toast";

const creatingMissing = ref(false);

async function createMissing() {
  creatingMissing.value = true;

  try {
    await store.createMissingPath();
  } catch (error: any) {
    toast({
      title: error?.message || t("file_manager_store.create_directory_failed"),
      variant: "destructive",
    });
  } finally {
    creatingMissing.value = false;
  }
}

const { t } = useI18n();

const props = defineProps<{
  nodeId: string;
  serverId?: string;
  openPath?: string;
}>();

const store = useFileManagerStore();

// Watch for errors and show them as toasts
watch(
  () => store.error,
  (error) => {
    if (error) {
      toast({
        title: t("common.error"),
        description: error,
        variant: "destructive",
      });
      // Clear the error from store after showing toast
      store.clearError();
    }
  },
);

onMounted(() => {
  void store.initialize(props.nodeId, props.serverId, props.openPath);
});

onUnmounted(() => {
  // a new container may already have initialized if the pages overlap during transition
  if (
    store.nodeId === props.nodeId &&
    store.serverId === (props.serverId || null)
  ) {
    store.reset();
  }
});
</script>
