<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useDraftGamesStore } from "~/stores/DraftGamesStore";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

const props = defineProps<{
  roomId: string;
}>();

const open = defineModel<boolean>("open", { required: true });

const { t } = useI18n();

const canceling = ref(false);
const cancelDraft = async () => {
  if (canceling.value) {
    return;
  }
  canceling.value = true;
  try {
    await useDraftGamesStore().cancelDraftRoom(props.roomId);
    open.value = false;
    return navigateTo("/play");
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: t("common.error"),
      description: error?.message,
    });
  } finally {
    canceling.value = false;
  }
};
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ $t("draft_games.room.cancel_draft_confirm_title") }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("draft_games.room.cancel_draft_confirm_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="canceling">
          {{ $t("common.cancel") }}
        </AlertDialogCancel>
        <Button
          variant="destructive"
          :disabled="canceling"
          @click="cancelDraft"
        >
          {{ $t("draft_games.room.cancel_draft") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
