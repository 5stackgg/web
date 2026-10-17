<script setup lang="ts">
import { ref } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { useI18n } from "vue-i18n";
import { toast } from "@/components/ui/toast";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Trash2 } from "lucide-vue-next";
import { deleteNode } from "~/components/game-server-nodes/nodeActions";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

// Removing a node asks first and names what goes with it. A plain Button, not
// AlertDialogAction, so the dialog stays open while the delete runs.
const props = defineProps<{
  node: { id: string; label?: string | null } | null;
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  removed: [id: string];
}>();

const { t } = useI18n();
const { client } = useApolloClient();
const removing = ref(false);

async function remove() {
  if (!props.node || removing.value) {
    return;
  }
  removing.value = true;
  const id = props.node.id;
  try {
    await deleteNode(client, id);
    emit("update:open", false);
    emit("removed", id);
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("pages.game_server_nodes.toast.save_failed"),
      description: error?.message,
    });
  } finally {
    removing.value = false;
  }
}
</script>

<template>
  <AlertDialog
    :open="open"
    @update:open="(value) => !removing && emit('update:open', value)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ t("game_server.remove_node_confirm_title") }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          <span v-if="node" class="mb-1 block font-medium text-foreground">{{
            node.label || node.id
          }}</span>
          {{ t("game_server.remove_node_confirm_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="removing">
          {{ t("common.cancel") }}
        </AlertDialogCancel>
        <Button
          variant="destructive"
          data-testid="confirm-remove-node"
          @click="remove"
        >
          <Trash2 class="mr-2 h-4 w-4" />
          {{ t(`${INSPECTOR}.remove`) }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
