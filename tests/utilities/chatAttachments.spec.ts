import { describe, expect, it } from "vitest";
import {
  chatAttachmentKind,
  chatComposerCanSend,
  chatGifUrl,
  chatMediaLabel,
  chatRoomTakesAttachments,
  formatChatDuration,
  pickChatFiles,
  type ChatAttachmentConfig,
  type ChatTrayItem,
} from "~/utilities/chatAttachments";

const MB = 1024 * 1024;

const config: ChatAttachmentConfig = {
  max_files: 4,
  max_file_bytes: 100 * MB,
  part_size: 8 * MB,
  mime_types: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ],
  gifs: true,
};

const file = (name: string, type: string, size = 1024) =>
  ({ name, type, size }) as File;

const item = (status: ChatTrayItem["status"]): ChatTrayItem => ({
  key: status,
  name: "smoke.png",
  kind: "image",
  size: 1,
  status,
  progress: status === "done" ? 1 : 0,
});

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

describe("which rooms take attachments", () => {
  it.each(["matchmaking", "tournament", "organizers", "draft", "direct"])(
    "lets %s attach",
    (type) => {
      expect(chatRoomTakesAttachments(type)).toBe(true);
    },
  );

  // Both are relayed into the game server, which shows only text.
  it.each(["match", "match_team", undefined, ""])("keeps %s text-only", (type) => {
    expect(chatRoomTakesAttachments(type)).toBe(false);
  });
});

describe("picking files", () => {
  it("takes images and videos the api accepts", () => {
    const picked = pickChatFiles(
      [file("a.png", "image/png"), file("b.mov", "video/quicktime")],
      0,
      config,
    );

    expect(picked.accepted.map(({ name }) => name)).toEqual(["a.png", "b.mov"]);
    expect(picked.rejected).toEqual([]);
  });

  it("turns away anything else", () => {
    const pdf = file("rules.pdf", "application/pdf");
    const svg = file("logo.svg", "image/svg+xml");

    expect(pickChatFiles([pdf, svg], 0, config).rejected).toEqual([
      { file: pdf, reason: "type" },
      { file: svg, reason: "type" },
    ]);
  });

  it("holds every file to the operator's limit", () => {
    const exact = file("exact.mp4", "video/mp4", 100 * MB);
    const over = file("over.mp4", "video/mp4", 100 * MB + 1);

    const picked = pickChatFiles([exact, over], 0, config);

    expect(picked.accepted).toEqual([exact]);
    expect(picked.rejected).toEqual([{ file: over, reason: "size" }]);
  });

  it("refuses an empty file", () => {
    const empty = file("empty.png", "image/png", 0);

    expect(pickChatFiles([empty], 0, config).rejected).toEqual([
      { file: empty, reason: "size" },
    ]);
  });

  it("stops at four, counting what the tray already holds", () => {
    const files = ["a", "b", "c"].map((name) => file(`${name}.png`, "image/png"));

    const picked = pickChatFiles(files, 2, config);

    expect(picked.accepted.map(({ name }) => name)).toEqual(["a.png", "b.png"]);
    expect(picked.rejected).toEqual([{ file: files[2], reason: "count" }]);
  });

  it("takes nothing before the limits are known", () => {
    const png = file("a.png", "image/png");

    expect(pickChatFiles([png], 0, null)).toEqual({
      accepted: [],
      rejected: [{ file: png, reason: "type" }],
    });
  });
});

describe("sending", () => {
  it("needs text or something attached", () => {
    expect(chatComposerCanSend("", [])).toBe(false);
    expect(chatComposerCanSend("   ", [])).toBe(false);
    expect(chatComposerCanSend("gg", [])).toBe(true);
    expect(chatComposerCanSend("", [item("done")])).toBe(true);
  });

  it("waits for every upload to finish", () => {
    expect(chatComposerCanSend("gg", [item("done"), item("uploading")])).toBe(
      false,
    );
  });

  it("waits for a failed upload to be retried or removed", () => {
    expect(chatComposerCanSend("gg", [item("failed")])).toBe(false);
  });
});

describe("kinds", () => {
  it.each([
    ["image/png", "image"],
    ["image/gif", "image"],
    ["video/webm", "video"],
    ["video/quicktime", "video"],
    ["audio/mpeg", null],
  ])("reads %s as %s", (mime, kind) => {
    expect(chatAttachmentKind(mime)).toBe(kind);
  });
});

describe("GIPHY", () => {
  it("builds the media url from the id alone", () => {
    expect(chatGifUrl("abc123", "full")).toBe(
      "https://i.giphy.com/media/abc123/giphy.webp",
    );
    expect(chatGifUrl("abc123", "preview")).toBe(
      "https://i.giphy.com/media/abc123/200w.webp",
    );
  });

  it("never builds a url from something that is not a GIPHY id", () => {
    expect(chatGifUrl("../../evil", "full")).toBe("");
    expect(chatGifUrl("https://evil.example/x", "full")).toBe("");
  });
});

describe("what a message without text is called", () => {
  it("says Attachment, or how many", () => {
    expect(
      chatMediaLabel({ message: "", attachments: [{} as any] } as any, t),
    ).toBe("chat.attachments.label");
    expect(
      chatMediaLabel(
        { message: "", attachments: [{}, {}, {}] as any } as any,
        t,
      ),
    ).toBe('chat.attachments.label_count {"count":3}');
  });

  it("says GIF", () => {
    expect(
      chatMediaLabel(
        { message: "", gif: { id: "a", width: 1, height: 1 } } as any,
        t,
      ),
    ).toBe("chat.gifs.label");
  });

  it("prefers the text", () => {
    expect(
      chatMediaLabel(
        { message: "look", attachments: [{} as any] } as any,
        t,
      ),
    ).toBe("look");
  });
});

describe("durations", () => {
  it.each([
    [0, "0:00"],
    [14_000, "0:14"],
    [61_500, "1:01"],
    [3_725_000, "1:02:05"],
    [undefined, ""],
  ])("shows %p as %p", (ms, label) => {
    expect(formatChatDuration(ms)).toBe(label);
  });
});
