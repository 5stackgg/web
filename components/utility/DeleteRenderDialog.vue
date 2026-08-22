<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useNuxtApp } from "#app";
import { deleteUtilityLineupRenderMutation } from "~/graphql/utilityRenderGraphql";
import { useToast } from "~/components/ui/toast/use-toast";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  renderId: string | null;
  title?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "deleted", renderId: string): void;
}>();

const nuxtApp = useNuxtApp();
const { toast } = useToast();
const deleting = ref(false);

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

watch(
  () => props.modelValue,
  (v) => {
    if (!v) deleting.value = false;
  },
);

async function confirm() {
  const id = props.renderId;
  if (!id || deleting.value) return;
  deleting.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: deleteUtilityLineupRenderMutation,
      variables: { render_id: id },
    });
    emit("deleted", id);
    emit("update:modelValue", false);
  } catch (error) {
    console.error("[utility-render] delete failed:", error);
    toast({
      title: t("pages.utility.render_queue.delete_failed"),
      description:
        (error as any)?.graphQLErrors?.[0]?.message ??
        (error as Error)?.message,
      variant: "destructive",
    });
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <AlertDialog :open="open" @update:open="(v) => emit('update:modelValue', v)">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          {{ $t("pages.utility.render_queue.delete_dialog.title") }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.utility.render_queue.delete_dialog.description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="deleting">
          {{ $t("common.cancel") }}
        </AlertDialogCancel>
        <!-- Plain button — radix's AlertDialogAction auto-closes before the
             async mutation can run. -->
        <button
          type="button"
          :disabled="deleting"
          class="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          @click="confirm"
        >
          {{
            deleting
              ? $t("pages.utility.render_queue.delete_dialog.deleting")
              : $t("pages.utility.render_queue.delete_dialog.delete")
          }}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
