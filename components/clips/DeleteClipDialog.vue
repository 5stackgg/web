<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useNuxtApp } from "#app";
import { generateMutation } from "~/graphql/graphqlGen";
import { useToast } from "~/components/ui/toast/use-toast";
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

// One dialog used by both /highlights and /clips/[id]. Owns the
// mutation + toast itself so neither page has to re-implement the
// delete flow (and so a fix to the delete behavior only has to land
// in one place). Parent controls open via v-model and reacts to the
// emitted `deleted` event (e.g. to redirect or optimistically prune
// from a list).
const props = defineProps<{
  // v-model: open/closed
  modelValue: boolean;
  // Pass the id by itself OR the whole clip; we only need id + title
  // for the mutation + toast text.
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
      title: "Clip deleted",
      description: props.title
        ? `"${props.title}" was removed.`
        : "Highlight was removed.",
    });
    emit("deleted", id);
    emit("update:modelValue", false);
  } catch (error) {
    console.error("[clip] delete failed:", error);
    toast({
      title: "Delete failed",
      description:
        (error as any)?.graphQLErrors?.[0]?.message ??
        (error as Error)?.message ??
        "Could not delete clip. Try again.",
      variant: "destructive",
    });
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <AlertDialog
    :open="open"
    @update:open="(v) => emit('update:modelValue', v)"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this clip?</AlertDialogTitle>
        <AlertDialogDescription>
          The clip is removed from the library and the underlying file is
          deleted. This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="deleting">Cancel</AlertDialogCancel>
        <!-- Native button instead of <AlertDialogAction>: the radix
             AlertDialogAction primitive auto-closes on click before
             our async confirm() can run, which on slow networks
             unmounts the dialog (and our @click handler with it)
             before the mutation fires. Using a plain <button> with
             our own close-on-success keeps the dialog mounted while
             the request is in flight. -->
        <button
          type="button"
          :disabled="deleting"
          class="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          @click="confirm"
        >
          {{ deleting ? "Deleting…" : "Delete" }}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
