// Must match the api's ChatService.MAX_MESSAGE_LENGTH. Both sides count
// .length (UTF-16 code units) of the trimmed text.
export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export const CHAT_REMAINING_HINT_AT = 200;

// Must match the api's ChatService.FINISHED_TOURNAMENT_CHAT_DAYS, which closes
// the room for posting and joining at the same moment.
export const FINISHED_TOURNAMENT_CHAT_MS = 7 * 24 * 60 * 60 * 1000;

// Must match the api's ChatService.REACTIONS, which refuses anything else. The
// api only sends ids; the glyphs are ours.
export const CHAT_REACTIONS = [
  { id: "thumbsup", glyph: "👍" },
  { id: "heart", glyph: "❤️" },
  { id: "laugh", glyph: "😂" },
  { id: "fire", glyph: "🔥" },
  { id: "wow", glyph: "😮" },
  { id: "sad", glyph: "😢" },
  { id: "thumbsdown", glyph: "👎" },
  { id: "skull", glyph: "💀" },
  { id: "sob", glyph: "😭" },
  { id: "rofl", glyph: "🤣" },
  { id: "angry", glyph: "😡" },
  { id: "thinking", glyph: "🤔" },
  { id: "eyes", glyph: "👀" },
  { id: "hundred", glyph: "💯" },
  { id: "target", glyph: "🎯" },
  { id: "clap", glyph: "👏" },
  { id: "pray", glyph: "🙏" },
  { id: "handshake", glyph: "🤝" },
  { id: "tada", glyph: "🎉" },
  { id: "cool", glyph: "😎" },
  { id: "salute", glyph: "🫡" },
  { id: "muscle", glyph: "💪" },
  { id: "goat", glyph: "🐐" },
  { id: "clown", glyph: "🤡" },
] as const;

export type ChatReaction = (typeof CHAT_REACTIONS)[number]["id"];
