import { onScopeDispose, ref } from "vue";
import { useToast } from "~/components/ui/toast/use-toast";

// Shared "copy share link" plumbing for clip share buttons. Single
// source of truth for the URL format, native share-sheet fallback,
// and the brief "just copied" flash state so every surface that shows
// a share button (highlight reel, queue rows, highlight cards, the
// detail modal) gives the user the same feedback.
//
// `copiedClipId` is per-call-site (each `useClipShare()` returns its
// own ref) so multiple panes can show flashes independently without
// fighting over global state. The clipId-keyed state lets a list of
// many share buttons reactively show the checkmark on whichever one
// the user actually clicked.
export function useClipShare() {
  const { toast } = useToast();
  const copiedClipId = ref<string | null>(null);
  let copiedTimer: ReturnType<typeof setTimeout> | null = null;

  function flashCopied(clipId: string) {
    copiedClipId.value = clipId;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      copiedClipId.value = null;
      copiedTimer = null;
    }, 1500);
  }

  async function shareClip(clipId: string) {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/clips/${clipId}`;

    // Prefer the OS share sheet on touch devices (iOS/Android) — one
    // tap to Messages, Discord, etc. instead of paste-and-go.
    const isTouch =
      typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches;
    if (isTouch && typeof navigator.share === "function") {
      try {
        await navigator.share({ url });
        flashCopied(clipId);
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        // anything else → fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      flashCopied(clipId);
      toast({ title: "Link copied" });
    } catch {
      toast({
        title: "Copy failed",
        description: url,
        variant: "destructive",
      });
    }
  }

  onScopeDispose(() => {
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = null;
  });

  return { copiedClipId, shareClip };
}
