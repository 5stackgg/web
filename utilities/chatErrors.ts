import { toast } from "@/components/ui/toast";
import { CHAT_MESSAGE_MAX_LENGTH } from "~/constants/chat";

export interface ChatError {
  code: string;
  max?: number;
  requestId?: string;
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

export function chatErrorMessage(error: ChatError, t: Translate): string {
  switch (error?.code) {
    case "too_long":
      return t("chat.message_too_long", {
        max: error.max ?? CHAT_MESSAGE_MAX_LENGTH,
      });
    // Also sent when a send queued while offline reaches the server before the
    // lobby rejoin does, so it must not tell the user they are barred.
    case "not_allowed":
    default:
      return t("chat.send_failed");
  }
}

export function toastChatError(error: ChatError) {
  const { $i18n } = useNuxtApp();

  toast({
    variant: "destructive",
    description: chatErrorMessage(error, (key, params) =>
      $i18n.t(key, params ?? {}),
    ),
  });
}
