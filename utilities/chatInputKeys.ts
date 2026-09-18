export type ChatEnterAction = "send" | "send-other" | "newline";

/**
 * What Enter means in the chat box.
 *
 * Enter sends, Shift+Enter breaks the line, and Ctrl/Cmd+Enter sends to the
 * other room (match chat from team chat and back), which wins over a line break
 * when both are held.
 *
 * A keypress that is confirming an IME candidate is never a send: in a Japanese
 * or Korean composition Enter picks the word, and sending there would cut it
 * off mid-word.
 */
export function chatEnterAction(event: KeyboardEvent): ChatEnterAction {
  if (event.metaKey || event.ctrlKey) {
    return "send-other";
  }

  if (event.isComposing) {
    return "newline";
  }

  return event.shiftKey ? "newline" : "send";
}
