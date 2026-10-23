<script setup lang="ts">
import { computed, ref } from "vue";
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
import { removeGame } from "~/components/game-server-nodes/nodeActions";
import { INSPECTOR } from "~/components/game-server-nodes/nodeCopy";

// Removing CS2 or CS:GO from a node asks first. A plain Button, not
// AlertDialogAction, so the dialog stays open while the removal starts.
const props = defineProps<{
  node: { id: string; label?: string | null };
  game: "cs2" | "csgo";
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

const { t } = useI18n();
const { client } = useApolloClient();
const removing = ref(false);

const gameName = computed(() => (props.game === "csgo" ? "CS:GO" : "CS2"));

async function remove() {
  if (removing.value) {
    return;
  }
  removing.value = true;
  try {
    await removeGame(client, props.node.id, props.game);
    emit("update:open", false);
    toast({
      title: t(`${INSPECTOR}.remove_game.started`, { game: gameName.value }),
    });
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
          {{ t(`${INSPECTOR}.remove_game.title`, { game: gameName }) }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          <span class="mb-1 block font-medium text-foreground">{{
            node.label || node.id
          }}</span>
          {{ t(`${INSPECTOR}.remove_game.description`, { game: gameName }) }}
          <template v-if="game === 'cs2'">
            {{ t(`${INSPECTOR}.remove_game.cs2_returns`) }}
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="removing">
          {{ t("common.cancel") }}
        </AlertDialogCancel>
        <Button
          variant="destructive"
          data-testid="confirm-remove-game"
          @click="remove"
        >
          <Trash2 class="mr-2 h-4 w-4" />
          {{ t(`${INSPECTOR}.remove_game.action`, { game: gameName }) }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
