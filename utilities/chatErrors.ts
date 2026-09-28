import { toast } from "@/components/ui/toast";
import { CHAT_MESSAGE_MAX_LENGTH } from "~/constants/chat";

// Echoed by the api on `chat:ack` and `chat:error`. An api that predates it
// sends none, and only ever answered sends.
export type ChatAction = "send" | "delete" | "edit";

export interface ChatError {
  code: string;
  action?: ChatAction;
  max?: number;
  requestId?: string;
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

export function chatErrorAction(error: ChatError): ChatAction {
  return error?.action ?? "send";
}

// A delete the api can't find a message for has still left the room without
// it, which is all the moderator asked for.
export function chatErrorFailed(error: ChatError) {
  return !(chatErrorAction(error) === "delete" && error?.code === "not_found");
}

export function chatErrorTitle(error: ChatError, t: Translate): string {
  switch (chatErrorAction(error)) {
    case "delete":
      if (!chatErrorFailed(error)) {
        return t("chat.message_already_gone");
      }
      return t("chat.delete_failed");
    case "edit":
      return t("chat.edit_failed");
    case "send":
    default:
      return t("chat.send_failed");
  }
}

export function chatErrorDescription(
  error: ChatError,
  t: Translate,
): string | undefined {
  if (chatErrorAction(error) === "delete") {
    switch (error?.code) {
      case "timeout":
        return t("chat.delete_timeout");
      case "window_closed":
        return t("chat.own_message_window_closed");
      case "not_allowed":
      default:
        return undefined;
    }
  }

  if (chatErrorAction(error) === "edit") {
    switch (error?.code) {
      case "timeout":
        return t("chat.edit_timeout");
      case "window_closed":
        return t("chat.edit_window_closed");
      case "not_found":
        return t("chat.message_already_gone");
      case "too_long":
        return t("chat.message_too_long", {
          max: error.max ?? CHAT_MESSAGE_MAX_LENGTH,
        });
      case "gagged":
        return t("chat.gagged");
      case "not_allowed":
      default:
        return undefined;
    }
  }

  switch (error?.code) {
    case "too_long":
      return t("chat.message_too_long", {
        max: error.max ?? CHAT_MESSAGE_MAX_LENGTH,
      });
    case "gagged":
      return t("chat.gagged");
    // Also sent when a send queued while offline reaches the server before the
    // lobby rejoin does, so it must not tell the user they are barred.
    case "not_allowed":
    default:
      return undefined;
  }
}

export function toastChatError(error: ChatError) {
  const { $i18n } = useNuxtApp();
  const t: Translate = (key, params) => $i18n.t(key, params ?? {});

  if (!chatErrorFailed(error)) {
    toast({ title: chatErrorTitle(error, t) });
    return;
  }

  toast({
    title: chatErrorTitle(error, t),
    description: chatErrorDescription(error, t),
    variant: "destructive",
  });
}
