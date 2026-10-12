import { useI18n } from "vue-i18n";
import { toast } from "@/components/ui/toast";

/** Copies a link to a news post, or to one section of it. */
export function useNewsShare() {
  const { t } = useI18n();

  async function copyNewsLink(slug: string, sectionId?: string) {
    const url = `${window.location.origin}/news/${encodeURIComponent(slug)}${sectionId ? `#${sectionId}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t("toasts.link_copied") });
    } catch {
      toast({
        title: t("toasts.copy_failed"),
        description: url,
        variant: "destructive",
      });
    }
  }

  return { copyNewsLink };
}
