import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useNuxtApp } from "#app";
import { generateMutation } from "~/graphql/graphqlGen";
import { useToast } from "~/components/ui/toast/use-toast";

export function useClipDelete() {
  const nuxtApp = useNuxtApp();
  const { toast } = useToast();
  const { t } = useI18n();
  const deleting = ref(false);

  async function deleteClip(id: string, title?: string | null) {
    if (deleting.value) {
      return false;
    }
    deleting.value = true;
    try {
      await nuxtApp.$apollo.defaultClient.mutate({
        mutation: generateMutation({
          deleteClip: [{ clip_id: id }, { success: true }],
        } as any),
      });
      toast({
        title: t("toasts.clip_deleted"),
        description: title
          ? t("toasts.clip_removed_named", { title })
          : t("toasts.highlight_removed"),
      });
      return true;
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
      return false;
    } finally {
      deleting.value = false;
    }
  }

  return { deleting, deleteClip };
}
