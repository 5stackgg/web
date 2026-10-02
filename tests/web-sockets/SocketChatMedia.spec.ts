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
