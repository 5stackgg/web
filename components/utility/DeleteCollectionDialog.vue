<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "~/components/ui/toast";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { deleteUtilityCollectionMutation } from "~/graphql/utilityGraphql";
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
  collectionId: string | null;
  name?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "deleted", collectionId: string): void;
}>();

const deleting = ref(false);

const open = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      deleting.value = false;
    }
  },
);

async function confirm() {
  const id = props.collectionId;
  if (!id || deleting.value) {
    return;
  }
  deleting.value = true;
  try {
    await getGraphqlClient().mutate({
      mutation: deleteUtilityCollectionMutation,
      variables: { id },
    });
    emit("deleted", id);
    emit("update:modelValue", false);
  } catch (error: any) {
    console.error("[utility] collection delete error:", error);
    toast({
      title: t("pages.utility.collections.delete_failed"),
      description:
        error?.graphQLErrors?.[0]?.message ?? (error as Error)?.message,
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
          {{ $t("pages.utility.collections.confirm_delete", { name }) }}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("pages.utility.collections.confirm_delete_description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="deleting">
          {{ $t("common.cancel") }}
        </AlertDialogCancel>
        <!-- Plain button — reka's AlertDialogAction closes the dialog before an
             async @click handler runs, which nulls collectionId out from under
             the mutation. -->
        <button
          type="button"
          :disabled="deleting"
          class="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          @click="confirm"
        >
          {{
            deleting
              ? $t("pages.utility.collections.deleting")
              : $t("common.delete")
          }}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
