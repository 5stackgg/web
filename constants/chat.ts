// Must match the api's ChatService.MAX_MESSAGE_LENGTH. Both sides count
// .length (UTF-16 code units) of the trimmed text.
export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export const CHAT_REMAINING_HINT_AT = 200;

// Must match the api's ChatService.REACTIONS, which refuses anything else. The
// api only sends ids; the glyphs are ours.
export const CHAT_REACTIONS = [
  { id: "thumbsup", glyph: "👍" },
  { id: "heart", glyph: "❤️" },
  { id: "laugh", glyph: "😂" },
  { id: "fire", glyph: "🔥" },
  { id: "wow", glyph: "😮" },
  { id: "sad", glyph: "😢" },
] as const;

export type ChatReaction = (typeof CHAT_REACTIONS)[number]["id"];
