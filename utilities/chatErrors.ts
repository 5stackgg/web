import { toast } from "@/components/ui/toast";
import { CHAT_MESSAGE_MAX_LENGTH } from "~/constants/chat";

export interface ChatError {
  code: string;
  max?: number;
  requestId?: string;
}

export interface ChatErrorMessage {
  key: string;
  params: Record<string, unknown>;
}

export function chatErrorMessage(error: ChatError): ChatErrorMessage {
  switch (error?.code) {
    case "too_long":
      return {
        key: "chat.message_too_long",
        params: { max: error.max ?? CHAT_MESSAGE_MAX_LENGTH },
      };
    // Also sent when a send queued while offline reaches the server before the
    // lobby rejoin does, so it must not tell the user they are barred.
    case "not_allowed":
    default:
      return { key: "chat.send_failed", params: {} };
  }
}

export function toastChatError(error: ChatError) {
  const { key, params } = chatErrorMessage(error);

  toast({
    variant: "destructive",
    description: useNuxtApp().$i18n.t(key, params),
  });
}
