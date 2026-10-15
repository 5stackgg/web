// The api's ChatService.MAX_MENTIONS; it refuses a message that tags more.
export const MAX_CHAT_MENTIONS = 10;

export const MENTION_LIST_ROWS = 5;

// Long enough for any Steam name, short enough that an @ typed long ago and
// followed by a sentence stops reading as a search.
const MAX_QUERY_LENGTH = 32;

export interface ChatMention {
  steam_id: string;
  name: string;
}

export interface ChatMentionCandidate extends ChatMention {
  avatar_url?: string | null;
  team?: string | null;
  organizer?: boolean;
}

export type ChatMentionListState =
  | "rows"
  | "loading"
  | "failed"
  | "empty"
  | "limit";

export interface ChatMentionSegment {
  text: string;
  mention: ChatMention | null;
  self: boolean;
}

export interface RankedMentionCandidate<T extends ChatMention = ChatMention> {
  candidate: T;
  start: number;
  length: number;
}

// Mirrors ChatService.mentionIn: an @ that does not follow a letter or digit,
// and a name that does not run on into one.
const WORD = /[\p{L}\p{N}_]/u;

function charBefore(text: string, index: number) {
  return Array.from(text.slice(Math.max(0, index - 2), index)).at(-1) ?? "";
}

function charAfter(text: string, index: number) {
  return Array.from(text.slice(index, index + 2))[0] ?? "";
}

function mentionAt(text: string, index: number, name: string) {
  const tag = `@${name}`;

  return (
    !!name &&
    text.startsWith(tag, index) &&
    !WORD.test(charBefore(text, index)) &&
    !WORD.test(charAfter(text, index + tag.length))
  );
}

export function chatRoomTakesMentions(type: string | null | undefined) {
  return !!type && type !== "direct";
}

export function hasMention(text: string, name: string) {
  if (!name) {
    return false;
  }

  for (
    let index = text.indexOf(`@${name}`);
    index !== -1;
    index = text.indexOf(`@${name}`, index + 1)
  ) {
    if (mentionAt(text, index, name)) {
      return true;
    }
  }

  return false;
}

export function mentionsViewer(
  message: { mentions?: ChatMention[] | null } | null | undefined,
  viewerSteamId: string | null | undefined,
) {
  return (
    !!viewerSteamId &&
    (message?.mentions ?? []).some(
      ({ steam_id }) => String(steam_id) === String(viewerSteamId),
    )
  );
}

// The api keeps only the tags an edit leaves in the text, and the room is
// told only the new text, so each client works out the same answer.
export function mentionsStillIn(
  text: string,
  mentions: ChatMention[] | null | undefined,
): ChatMention[] | undefined {
  const kept = (mentions ?? []).filter(({ name }) => hasMention(text, name));

  return kept.length > 0 ? kept : undefined;
}

export function mentionSegments(
  text: string,
  mentions: ChatMention[] | null | undefined,
  viewerSteamId: string | null | undefined,
): ChatMentionSegment[] {
  const longestFirst = [...(mentions ?? [])]
    .filter(({ name }) => !!name)
    .sort((a, b) => b.name.length - a.name.length);

  if (!text || longestFirst.length === 0) {
    return [{ text, mention: null, self: false }];
  }

  const segments: ChatMentionSegment[] = [];
  let plainFrom = 0;
  let index = text.indexOf("@");

  while (index !== -1) {
    const mention = longestFirst.find(({ name }) =>
      mentionAt(text, index, name),
    );

    if (!mention) {
      index = text.indexOf("@", index + 1);
      continue;
    }

    if (index > plainFrom) {
      segments.push({
        text: text.slice(plainFrom, index),
        mention: null,
        self: false,
      });
    }

    const end = index + mention.name.length + 1;
    segments.push({
      text: text.slice(index, end),
      mention,
      self:
        !!viewerSteamId && String(mention.steam_id) === String(viewerSteamId),
    });
    plainFrom = end;
    index = text.indexOf("@", end);
  }

  if (plainFrom < text.length) {
    segments.push({ text: text.slice(plainFrom), mention: null, self: false });
  }

  return segments;
}

// The @ the caret is typing after, if it is typing after one.
export function mentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const start = before.lastIndexOf("@");

  if (start === -1 || WORD.test(charBefore(before, start))) {
    return null;
  }

  const query = before.slice(start + 1);

  if (query.length > MAX_QUERY_LENGTH || /[\r\n]/.test(query)) {
    return null;
  }

  return { start, query };
}

// Names that start with what was typed, then names with a word that does, then
// any that contain it.
export function rankMentionCandidates<T extends ChatMention>(
  candidates: T[],
  query: string,
  limit = MENTION_LIST_ROWS,
): RankedMentionCandidate<T>[] {
  const wanted = query.toLowerCase();

  return candidates
    .flatMap((candidate) => {
      const name = candidate.name.toLowerCase();
      const start = name.indexOf(wanted);

      if (start === -1) {
        return [];
      }

      const wordStart = name
        .split("")
        .findIndex(
          (_, index) =>
            index > 0 &&
            !WORD.test(name[index - 1]) &&
            name.startsWith(wanted, index),
        );

      const rank = start === 0 ? 0 : wordStart !== -1 ? 1 : 2;
      const at = rank === 1 ? wordStart : start;

      return [{ candidate, start: at, length: query.length, rank }];
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.candidate.name.localeCompare(b.candidate.name, undefined, {
          sensitivity: "base",
        }),
    )
    .slice(0, limit)
    .map(({ candidate, start, length }) => ({ candidate, start, length }));
}

export function insertMention(
  text: string,
  start: number,
  caret: number,
  name: string,
): { text: string; caret: number } {
  const rest = text.slice(caret);
  const spaced = /^\s/.test(rest);
  const inserted = `@${name}${spaced ? "" : " "}`;

  return {
    text: text.slice(0, start) + inserted + rest,
    caret: start + inserted.length + (spaced ? 1 : 0),
  };
}

// Everyone the text tags: the players picked from the list, and any member of
// the room whose name was typed out in full. A pick settles which of two
// members with the same name was meant.
export function mentionedSteamIds(
  text: string,
  picks: ChatMention[],
  candidates: ChatMention[],
): string[] {
  const steamIds = new Set<string>();
  const pickedNames = new Set<string>();

  for (const pick of picks) {
    if (hasMention(text, pick.name)) {
      steamIds.add(String(pick.steam_id));
      pickedNames.add(pick.name);
    }
  }

  for (const candidate of candidates) {
    if (!pickedNames.has(candidate.name) && hasMention(text, candidate.name)) {
      steamIds.add(String(candidate.steam_id));
    }
  }

  return [...steamIds];
}
