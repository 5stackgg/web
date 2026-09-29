import type { ChatTab } from "~/composables/useChatTabs";

// Your own rooms first. Organizer and tournament rooms are broadcast channels,
// so landing on one by default put the least personal room in front of the
// lobby you are actually in. Conversations are not channels at all, so they sit
// below every channel behind a divider.
function chatTabWeight(tab: ChatTab) {
  if (tab.id.startsWith("matchmaking:")) {
    return 0;
  }
  if (tab.type === "match") {
    return 1;
  }
  if (tab.type === "direct") {
    return 3;
  }
  return 2;
}

export function orderChatTabs(tabs: readonly ChatTab[]): ChatTab[] {
  return [...tabs].sort((a, b) => {
    const wa = chatTabWeight(a);
    const wb = chatTabWeight(b);
    if (wa !== wb) {
      return wa - wb;
    }
    // Conversations sit in the order the player dragged them into; channels
    // are not arrangeable and stay alphabetical.
    if (a.type === "direct" && b.type === "direct") {
      return (a.position ?? 0) - (b.position ?? 0);
    }
    return a.label.localeCompare(b.label);
  });
}
