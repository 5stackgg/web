import { beforeEach, describe, expect, it } from "vitest";
import socket from "~/web-sockets/Socket";
import { useServerClockStore } from "~/stores/ServerClockStore";

const details = (offsetMs: number) => ({
  details: undefined,
  confirmation: undefined,
  serverNow: new Date(Date.now() + offsetMs).toISOString(),
});

// A pong for a ping sent `roundTripMs` ago, read by an api whose clock is
// `offsetMs` from this device's halfway through the trip.
function pong(offsetMs: number, roundTripMs = 20, readAt = 0.5) {
  const now = Date.now();
  socket.emit("pong", {
    serverNow: now - roundTripMs * (1 - readAt) + offsetMs,
    sentAt: now - roundTripMs,
  });
}

const offset = () => useServerClockStore().offsetMs!;

describe("Socket server clock", () => {
  beforeEach(() => {
    socket.emit("online");
  });

  it("times the api's clock from the middle of a ping's round trip", () => {
    pong(-120_000, 100);

    expect(offset()).toBeGreaterThan(-120_005);
    expect(offset()).toBeLessThan(-119_995);
  });

  it("keeps a quick pong's timing over a slow one's", () => {
    pong(-120_000, 20);
    pong(-120_000, 4_000, 0.1);

    expect(offset()).toBeGreaterThan(-120_015);
    expect(offset()).toBeLessThan(-119_985);
  });

  it("starts over when the device clock moves", () => {
    pong(-120_000);
    pong(-60_000);

    expect(offset()).toBeGreaterThan(-60_015);
    expect(offset()).toBeLessThan(-59_985);
  });

  it("keeps the last timing through a reconnect until a new one lands", () => {
    pong(-120_000);
    socket.emit("online");

    expect(offset()).toBeLessThan(-119_985);

    pong(-60_000, 4_000);

    expect(offset()).toBeGreaterThan(-60_015);
  });

  it("ignores a pong from an api that does not send its time", () => {
    pong(-120_000);
    socket.emit("pong", undefined);

    expect(offset()).toBeLessThan(-119_985);
  });

  it("keeps how far the api's clock is from a queue update", () => {
    socket.emit("matchmaking:details", details(-120_000));

    expect(offset()).toBeGreaterThan(-121_000);
    expect(offset()).toBeLessThan(-119_000);
  });

  it("is not dragged back by a queue update that was held up on the way", () => {
    socket.emit("matchmaking:details", details(-120_000));
    socket.emit("matchmaking:details", details(-135_000));

    expect(offset()).toBeGreaterThan(-121_000);
  });

  it("moves to a queue update that arrived faster", () => {
    socket.emit("matchmaking:details", details(-135_000));
    socket.emit("matchmaking:details", details(-120_000));

    expect(offset()).toBeGreaterThan(-121_000);
  });

  it("keeps the offset when a queue update carries none", () => {
    socket.emit("matchmaking:details", details(60_000));
    socket.emit("matchmaking:details", {});

    expect(offset()).toBeGreaterThan(59_000);
  });
});
