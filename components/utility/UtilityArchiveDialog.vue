<script setup lang="ts">
import { computed, h, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Archive, RotateCcw } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { ToastAction, toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { archiveUtilityLineupMutation } from "~/graphql/utilityGraphql";

const props = defineProps<{
  lineupId: string | null;
  lineupName?: string | null;
}>();

const open = defineModel<boolean>("open", { default: false });

const emit = defineEmits<{
  archived: [id: string];
}>();

const { t } = useI18n();
const working = ref(false);

const name = computed(
  () => props.lineupName || t("pages.utility.archive.this_lineup"),
);

async function archive() {
  const id = props.lineupId;

  if (!id) {
    return;
  }

  working.value = true;

  try {
    await getGraphqlClient().mutate({
      mutation: archiveUtilityLineupMutation,
      variables: { id, archived_at: new Date().toISOString() },
    });

    emit("archived", id);
    open.value = false;

    // The undo lives in the toast rather than a trash view: the window in which
    // somebody wants it back is measured in seconds, and a second place to go
    // looking for archived lineups is a second thing to explain.
    toast({
      title: t("pages.utility.archive.done", { name: name.value }),
      // The Toaster renders this with <component :is>, so it has to be a real
      // component rather than a {label, onClick} bag.
      action: h(
        ToastAction,
        {
          altText: t("pages.utility.archive.undo"),
          onClick: () => void restore(id),
        },
        () => t("pages.utility.archive.undo"),
      ),
    });
  } catch (error: any) {
    toast({
      title: t("pages.utility.archive.failed"),
      description: error?.message,
      variant: "destructive",
    });
  } finally {
    working.value = false;
  }
}

async function restore(id: string) {
  try {
    await getGraphqlClient().mutate({
      mutation: archiveUtilityLineupMutation,
      variables: { id, archived_at: null },
    });
    toast({ title: t("pages.utility.archive.restored") });
  } catch (error: any) {
    toast({
      title: t("pages.utility.archive.restore_failed"),
      description: error?.message,
      variant: "destructive",
    });
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Archive class="h-4 w-4 text-[hsl(var(--tac-amber))]" />
          {{ $t("pages.utility.archive.title") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("pages.utility.archive.description", { name }) }}
        </DialogDescription>
      </DialogHeader>

      <!-- Says what survives, because "delete" and "archive" imply different
           things and the difference matters to anyone who has drilled it. -->
      <div
        class="flex items-start gap-2.5 rounded-md border border-border bg-foreground/5 px-3 py-2.5"
      >
        <RotateCcw
          class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <p class="text-xs leading-relaxed text-muted-foreground">
          {{ $t("pages.utility.archive.keeps_history") }}
        </p>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="ghost" :disabled="working" @click="open = false">
          {{ $t("common.cancel") }}
        </Button>
        <Button variant="destructive" :loading="working" @click="archive()">
          <Archive class="mr-1 h-4 w-4" />
          {{ $t("pages.utility.archive.confirm") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
