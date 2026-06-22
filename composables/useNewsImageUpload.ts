import { ref } from "vue";
import { toast } from "@/components/ui/toast";

const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_SIZE = 10 * 1024 * 1024;

export function useNewsImageUpload() {
  const uploading = ref(false);

  const upload = async (file: File | Blob): Promise<string | null> => {
    if (!ACCEPT.includes(file.type)) {
      toast({
        title: useNuxtApp().$i18n.t("avatar.invalid_type") as string,
        variant: "destructive",
      });
      return null;
    }

    if (file.size > MAX_SIZE) {
      toast({
        title: useNuxtApp().$i18n.t("avatar.too_large", {
          size: Math.round(MAX_SIZE / 1024 / 1024),
        }) as string,
        variant: "destructive",
      });
      return null;
    }

    uploading.value = true;
    try {
      const apiDomain = useRuntimeConfig().public.apiDomain;
      const formData = new FormData();
      formData.append("file", file, (file as File).name || "cover.webp");

      const response = await fetch(`https://${apiDomain}/news/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { filename: string };
      return `https://${apiDomain}/news/image/${data.filename}`;
    } catch (error: any) {
      toast({
        title: useNuxtApp().$i18n.t("avatar.upload_failed") as string,
        description: error?.message,
        variant: "destructive",
      });
      return null;
    } finally {
      uploading.value = false;
    }
  };

  return { upload, uploading, accept: ACCEPT.join(",") };
}
