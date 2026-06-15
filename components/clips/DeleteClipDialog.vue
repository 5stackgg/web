<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useNuxtApp } from "#app";
import { generateMutation } from "~/graphql/graphqlGen";
import { useToast } from "~/components/ui/toast/use-toast";

const { t } = useI18n();
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

const props = defineProps<{
  modelValue: boolean;
  clipId: string | null;
  title?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "deleted", clipId: string): void;
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
  const id = props.clipId;
  if (!id || deleting.value) return;
  deleting.value = true;
  try {
    await nuxtApp.$apollo.defaultClient.mutate({
      mutation: generateMutation({
        deleteClip: [{ clip_id: id }, { success: true }],
      } as any),
    });
    toast({
      title: t("toasts.clip_deleted"),
      description: props.title
        ? t("toasts.clip_removed_named", { title: props.title })
        : t("toasts.highlight_removed"),
    });
    emit("deleted", id);
    emit("update:modelValue", false);
  } catch (error) {
    console.error("[clip] delete failed:", error);
    toast({
      title: t("toasts.delete_failed"),
      description:
        (error as any)?.graphQLErrors?.[0]?.message ??
        (error as Error)?.message ??
        t("toasts.could_not_delete_clip"),
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
        <AlertDialogTitle>{{
          $t("clips.delete_dialog.title")
        }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ $t("clips.delete_dialog.description") }}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="deleting">{{
          $t("common.cancel")
        }}</AlertDialogCancel>
        <!-- Plain button — radix's AlertDialogAction auto-closes
             before the async mutation can run. -->
        <button
          type="button"
          :disabled="deleting"
          class="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          @click="confirm"
        >
          {{
            deleting
              ? $t("clips.delete_dialog.deleting")
              : $t("clips.delete_dialog.delete")
          }}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
