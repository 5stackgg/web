<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { AlertTriangle, Trash2 } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { deleteUtilityLineupMutation } from "~/graphql/utilityGraphql";

const props = defineProps<{
  lineupId: string | null;
  lineupName?: string | null;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
  deleted: [id: string];
}>();

const { t } = useI18n();
const working = ref(false);

const name = computed(
  () => props.lineupName || t("pages.utility.archive.this_lineup"),
);

// Deliberately no undo toast. Archive has one because the row comes back;
// there is nothing to put back here, and offering the same affordance for both
// is how the two actions stop reading as different.
async function destroy() {
  const id = props.lineupId;

  if (!id) {
    return;
  }

  working.value = true;

  try {
    await getGraphqlClient().mutate({
      mutation: deleteUtilityLineupMutation,
      variables: { id },
    });

    emit("deleted", id);
    open.value = false;
    toast({ title: t("pages.utility.archive.deleted", { name: name.value }) });
  } catch (error: any) {
    // A lineup an execute still points at cannot go: the database says so, and
    // the message it says it with is more use than anything invented here.
    toast({
      title: t("pages.utility.archive.delete_failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    working.value = false;
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Trash2 class="h-4 w-4 text-destructive" />
          {{ $t("pages.utility.archive.delete_title") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("pages.utility.archive.delete_description", { name }) }}
        </DialogDescription>
      </DialogHeader>

      <!-- The archive dialog's box says what survives. This one exists to say
           the opposite, in the same place, so the two are read against each
           other rather than skimmed as the same warning twice. -->
      <div
        class="flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5"
      >
        <AlertTriangle
          class="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <p class="text-xs leading-relaxed text-destructive">
          {{ $t("pages.utility.archive.loses_history") }}
        </p>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="ghost" :disabled="working" @click="open = false">
          {{ $t("common.cancel") }}
        </Button>
        <Button variant="destructive" :loading="working" @click="destroy()">
          <Trash2 class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.archive.delete_confirm") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
