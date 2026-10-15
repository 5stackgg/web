import { LOUD_ROOM, type ChatRoomQuiet } from "~/utilities/chatRoomSettings";

// Red is for what needs you: a direct message, or a room where someone tagged
// you. Everything else a room says is the dock's white "new since you looked",
// and a room you muted says it in grey.
export type ChatBadgeTone = "red" | "fresh" | "muted";

export interface ChatBadge {
  tone: ChatBadgeTone;
  count: number;
  mention: boolean;
}

interface BadgedTab {
  id: string;
  type: string;
  lobbyId?: string;
}

// A room set to nothing takes a tag as plain chatter. A match room counts no
// chatter of its own, so there its tags are the only lines to count.
function chatterOf(unread: number, mentions: number, quiet: ChatRoomQuiet) {
  return quiet.notify === "nothing" ? Math.max(unread, mentions) : unread;
}

function tagsOf(mentions: number, quiet: ChatRoomQuiet) {
  return quiet.notify === "nothing" ? 0 : mentions;
}

export function chatTabBadge(
  tab: { type: string },
  unread: number,
  mentions: number,
  quiet: ChatRoomQuiet = LOUD_ROOM,
): ChatBadge | null {
  const tags = tagsOf(mentions, quiet);
  const chatter = chatterOf(unread, mentions, quiet);

  if (tags > 0) {
    return { tone: "red", count: tags, mention: true };
  }

  if (chatter === 0) {
    return null;
  }

  if (quiet.muted) {
    return { tone: "muted", count: chatter, mention: false };
  }

  return {
    tone: tab.type === "direct" ? "red" : "fresh",
    count: chatter,
    mention: false,
  };
}

export interface ChatCounts {
  direct: number;
  mentions: number;
  chatter: number;
}

// A muted room's chatter is left out of every total; only a tag it lets
// through is counted, in red. The Chat icon's badge and its description both
// read these, so they cannot disagree.
export function chatCounts<Tab extends BadgedTab>(
  tabs: Tab[],
  unreadCounts: Record<string, number>,
  mentionCounts: Record<string, number>,
  quietFor: (tab: Tab) => ChatRoomQuiet = () => LOUD_ROOM,
): ChatCounts {
  let direct = 0;
  let mentions = 0;
  let chatter = 0;

  for (const tab of tabs) {
    const quiet = quietFor(tab);
    const unread = unreadCounts[tab.id] ?? 0;
    const tagged = mentionCounts[tab.id] ?? 0;

    if (tab.type !== "direct") {
      mentions += tagsOf(tagged, quiet);
    }

    if (quiet.muted) {
      continue;
    }

    if (tab.type === "direct") {
      direct += unread;
      continue;
    }

    chatter += chatterOf(unread, tagged, quiet);
  }

  return { direct, mentions, chatter };
}

export function chatBadgeFor<Tab extends BadgedTab>(
  tabs: Tab[],
  unreadCounts: Record<string, number>,
  mentionCounts: Record<string, number>,
  quietFor: (tab: Tab) => ChatRoomQuiet = () => LOUD_ROOM,
): ChatBadge | null {
  const { direct, mentions, chatter } = chatCounts(
    tabs,
    unreadCounts,
    mentionCounts,
    quietFor,
  );

  if (direct + mentions > 0) {
    return { tone: "red", count: direct + mentions, mention: direct === 0 };
  }

  if (chatter > 0) {
    return { tone: "fresh", count: chatter, mention: false };
  }

  return null;
}

export function chatBadgeClass(tone: ChatBadgeTone) {
  switch (tone) {
    case "red":
      return "bg-red-500 text-white";
    case "muted":
      return "bg-zinc-700 text-zinc-300";
    default:
      return "bg-zinc-50 text-zinc-950";
  }
}
