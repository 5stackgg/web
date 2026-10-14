import { beforeEach, describe, expect, it } from "vitest";
import socket from "~/web-sockets/Socket";
import { useMatchmakingStore } from "~/stores/MatchmakingStore";

const details = (offsetMs: number) => ({
  details: undefined,
  confirmation: undefined,
  serverNow: new Date(Date.now() + offsetMs).toISOString(),
});

const offset = () => useMatchmakingStore().serverClockOffsetMs!;

describe("Socket matchmaking:details clock", () => {
  beforeEach(() => {
    useMatchmakingStore().serverClockOffsetMs = null;
  });

  it("keeps how far the api's clock is from this device's", () => {
    socket.emit("matchmaking:details", details(-120_000));

    expect(offset()).toBeGreaterThan(-121_000);
    expect(offset()).toBeLessThan(-119_000);
  });

  it("is not dragged back by an update that was held up on the way", () => {
    socket.emit("matchmaking:details", details(-120_000));
    socket.emit("matchmaking:details", details(-135_000));

    expect(offset()).toBeGreaterThan(-121_000);
  });

  it("moves to a reading that arrived faster", () => {
    socket.emit("matchmaking:details", details(-135_000));
    socket.emit("matchmaking:details", details(-120_000));

    expect(offset()).toBeGreaterThan(-121_000);
  });

  it("starts over when the socket reconnects", () => {
    socket.emit("matchmaking:details", details(-120_000));
    socket.emit("online");
    socket.emit("matchmaking:details", details(-135_000));

    expect(offset()).toBeLessThan(-134_000);
  });

  it("keeps the offset when an update carries none", () => {
    socket.emit("matchmaking:details", details(60_000));
    socket.emit("matchmaking:details", {});

    expect(offset()).toBeGreaterThan(59_000);
  });
});
