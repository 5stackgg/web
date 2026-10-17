<script setup lang="ts">
import { ref } from "vue";
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

// Stop names what it ends: the pod, the stream for everyone watching, and the
// GPU going back. A plain Button confirms so the dialog stays up (and the
// button spins) until the mutation answers -- AlertDialogAction auto-closes.
const props = defineProps<{
  matchName: string;
  stop: () => Promise<unknown>;
}>();

const open = defineModel<boolean>("open", { default: false });

const stopping = ref(false);

async function confirm() {
  if (stopping.value) return;
  stopping.value = true;
  try {
    await props.stop();
    open.value = false;
  } finally {
    stopping.value = false;
  }
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{
          $t("pages.control_room.stop.title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.control_room.stop.description", { match: matchName }) }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter class="gap-2">
        <AlertDialogCancel :disabled="stopping">{{
          $t("pages.control_room.stop.keep")
        }}</AlertDialogCancel>
        <Button variant="destructive" :loading="stopping" @click="confirm">
          {{ $t("pages.control_room.stop.confirm") }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
