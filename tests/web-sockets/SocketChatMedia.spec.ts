import { describe, expect, it, vi } from "vitest";
import { Socket } from "~/web-sockets/Socket";

function connected() {
  const socket = new Socket();
  const send = vi.fn();
  (socket as any).connected = true;
  (socket as any).connection = { send };
  return { socket, sent: () => send.mock.calls.map(([raw]) => JSON.parse(raw)) };
}

describe("Socket.chat with media", () => {
  it("sends plain text exactly as before", () => {
    const { socket, sent } = connected();

    socket.chat("matchmaking", "lobby-1", "gg");

    expect(sent()).toEqual([
      {
        event: "lobby:chat",
        data: { id: "lobby-1", type: "matchmaking", message: "gg" },
      },
    ]);
  });

  it("sends the uploaded files by id", () => {
    const { socket, sent } = connected();

    socket.chat("matchmaking", "lobby-1", "", { attachments: ["a-1", "a-2"] });

    expect(sent()[0].data).toEqual({
      id: "lobby-1",
      type: "matchmaking",
      message: "",
      attachments: ["a-1", "a-2"],
    });
  });

  it("sends a GIF as its GIPHY id and size", () => {
    const { socket, sent } = connected();

    socket.chat("direct", "1:2", "", {
      gif: { id: "abc123", width: 480, height: 270 },
    });

    expect(sent()[0].data).toEqual({
      id: "1:2",
      type: "direct",
      message: "",
      gif: { id: "abc123", width: 480, height: 270 },
    });
  });
});

describe("Socket.sendChat", () => {
  it("sends with a requestId and settles when the room takes it", async () => {
    const { socket, sent } = connected();

    const delivered = socket.sendChat("matchmaking", "lobby-1", "", {
      attachments: ["a-1"],
    });

    const [{ event, data }] = sent();
    expect(event).toBe("lobby:chat");
    expect(data).toMatchObject({ attachments: ["a-1"], type: "matchmaking" });
    expect(typeof data.requestId).toBe("string");

    socket.resolveChatRequest({
      requestId: data.requestId,
      messageId: "m-1",
      action: "send",
    });

    await expect(delivered).resolves.toBeUndefined();
  });

  it("hands the room's refusal back to whoever sent it", async () => {
    const { socket, sent } = connected();

    const delivered = socket.sendChat("matchmaking", "lobby-1", "", {
      attachments: ["a-1"],
    });
    const [{ data }] = sent();

    expect(
      socket.rejectChatRequest({
        code: "rate_limited",
        action: "send",
        requestId: data.requestId,
      }),
    ).toBe(true);

    await expect(delivered).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("never queues a send with files while offline", async () => {
    const socket = new Socket();

    await expect(
      socket.sendChat("matchmaking", "lobby-1", "", { attachments: ["a-1"] }),
    ).rejects.toMatchObject({ code: "offline" });
  });
});
