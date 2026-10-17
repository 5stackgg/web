import { toast } from "@/components/ui/toast";

export async function copyText(
  text: string,
  title: string,
  failedTitle: string,
  description?: string,
) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title, description });
  } catch {
    toast({ title: failedTitle, variant: "destructive" });
  }
}
