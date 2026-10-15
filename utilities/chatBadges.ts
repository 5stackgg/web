// Red is for what needs you: a direct message, or a room where someone tagged
// you. Everything else a room says is the dock's white "new since you looked".
export type ChatBadgeTone = "red" | "fresh";

export interface ChatBadge {
  tone: ChatBadgeTone;
  count: number;
  mention: boolean;
}

interface BadgedTab {
  id: string;
  type: string;
}

export function chatTabBadge(
  tab: { type: string },
  unread: number,
  mentions: number,
): ChatBadge | null {
  if (tab.type === "direct") {
    return unread > 0 ? { tone: "red", count: unread, mention: false } : null;
  }

  if (mentions > 0) {
    return { tone: "red", count: mentions, mention: true };
  }

  if (unread > 0) {
    return { tone: "fresh", count: unread, mention: false };
  }

  return null;
}

export function chatBadgeFor(
  tabs: BadgedTab[],
  unreadCounts: Record<string, number>,
  mentionCounts: Record<string, number>,
): ChatBadge | null {
  let direct = 0;
  let mentions = 0;
  let chatter = 0;

  for (const tab of tabs) {
    const unread = unreadCounts[tab.id] ?? 0;

    if (tab.type === "direct") {
      direct += unread;
      continue;
    }

    mentions += mentionCounts[tab.id] ?? 0;
    chatter += unread;
  }

  if (direct + mentions > 0) {
    return { tone: "red", count: direct + mentions, mention: direct === 0 };
  }

  if (chatter > 0) {
    return { tone: "fresh", count: chatter, mention: false };
  }

  return null;
}
