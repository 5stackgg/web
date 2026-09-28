import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { Socket } from "~/web-sockets/Socket";

const HEARTBEAT_MS = 15_000;
const PONG_TIMEOUT_MS = 45_000;
const PONG_GRACE_MS = 10_000;

type Listener = (event: any) => void;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  sent: Array<{ event: string; data?: unknown }> = [];
  closeCalls = 0;
  onclose: Listener | null = null;
  onerror: Listener | null = null;

  private listeners = new Map<string, Listener[]>();

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  send(payload: string) {
    if (this.readyState === FakeWebSocket.CONNECTING) {
      throw new Error("InvalidStateError: still CONNECTING");
    }

    this.sent.push(JSON.parse(payload));
  }

  // A dead TCP connection never gets far enough to report a close.
  close() {
    this.closeCalls++;
    this.readyState = FakeWebSocket.CLOSING;
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatch("open", {});
  }

  receive(event: string, data?: unknown) {
    this.dispatch("message", { data: JSON.stringify({ event, data }) });
  }

  fail() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code: 1006 });
  }

  pings() {
    return this.sent.filter(({ event }) => event === "ping").length;
  }

  private dispatch(type: string, event: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function latest() {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

let socket: Socket;
let lifecycleSpies: Array<[EventTarget, MockInstance]> = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});

  lifecycleSpies = [
    [document, vi.spyOn(document, "addEventListener")],
    [window, vi.spyOn(window, "addEventListener")],
  ];

  FakeWebSocket.instances = [];
  socket = new Socket();
});

afterEach(() => {
  for (const [target, spy] of lifecycleSpies) {
    for (const [type, listener] of spy.mock.calls) {
      target.removeEventListener(type, listener);
    }
  }

  Reflect.deleteProperty(document, "visibilityState");
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Socket pong watchdog", () => {
  it("never reconnects a connection whose api has never answered a ping", () => {
    socket.connect();
    latest().open();

    vi.advanceTimersByTime(10 * 60_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(latest().pings()).toBeGreaterThan(30);
  });

  it("keeps a connection that keeps answering", () => {
    socket.connect();
    const connection = latest();
    connection.open();

    for (let tick = 0; tick < 40; tick++) {
      connection.receive("pong");
      vi.advanceTimersByTime(HEARTBEAT_MS);
    }

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("reconnects once an answering connection goes silent", () => {
    const offline = vi.fn();
    const online = vi.fn();
    socket.on("offline", offline);
    socket.on("online", online);

    socket.connect();
    const zombie = latest();
    zombie.open();
    zombie.receive("pong");

    vi.advanceTimersByTime(PONG_TIMEOUT_MS);

    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(HEARTBEAT_MS);

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(zombie.closeCalls).toBe(1);
    expect(offline).toHaveBeenCalledTimes(1);

    latest().open();

    expect(online).toHaveBeenCalledTimes(2);
  });

  it("rejoins its rooms on the connection that replaces a zombie", () => {
    socket.join("lobby", { type: "match", id: "match-1" });
    socket.connect();
    latest().open();
    latest().receive("pong");

    vi.advanceTimersByTime(PONG_TIMEOUT_MS + HEARTBEAT_MS);
    latest().open();

    expect(latest().sent).toContainEqual({
      event: "lobby:join",
      data: { type: "match", id: "match-1" },
    });
  });

  it("does not arm on a new connection until that connection answers", () => {
    socket.connect();
    latest().open();
    latest().receive("pong");

    vi.advanceTimersByTime(PONG_TIMEOUT_MS + HEARTBEAT_MS);

    expect(FakeWebSocket.instances).toHaveLength(2);

    latest().open();
    vi.advanceTimersByTime(10 * 60_000);

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("ignores everything a replaced connection says after it is replaced", () => {
    const event = vi.fn();
    const online = vi.fn();
    const offline = vi.fn();
    socket.on("match:updated", event);
    socket.on("online", online);
    socket.on("offline", offline);

    socket.connect();
    const replaced = latest();

    socket.connect();
    const current = latest();

    replaced.open();

    expect(online).not.toHaveBeenCalled();
    expect(replaced.sent).toEqual([]);

    current.open();

    expect(online).toHaveBeenCalledTimes(1);

    replaced.receive("match:updated", { id: "stale" });
    replaced.receive("pong");
    replaced.fail();

    expect(event).not.toHaveBeenCalled();
    expect(offline).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10 * 60_000);

    expect(FakeWebSocket.instances).toHaveLength(2);

    current.receive("match:updated", { id: "live" });

    expect(event).toHaveBeenCalledWith({ id: "live" });
  });

  it("queues events while a replacement connection is still opening", () => {
    socket.connect();
    latest().open();

    socket.connect();
    const replacement = latest();

    expect(() => {
      socket.event("match:ready", { id: "match-1" });
    }).not.toThrow();

    vi.advanceTimersByTime(HEARTBEAT_MS * 2);
    replacement.open();
    vi.advanceTimersByTime(100);

    expect(replacement.sent).toContainEqual({
      event: "match:ready",
      data: { id: "match-1" },
    });
  });

  it("keeps queued events for the next connection when one closes before flushing", () => {
    socket.event("match:ready", { id: "match-1" });
    socket.connect();
    const shortLived = latest();
    shortLived.open();
    shortLived.fail();

    vi.advanceTimersByTime(100);

    expect(shortLived.sent.map(({ event }) => event)).not.toContain(
      "match:ready",
    );

    vi.advanceTimersByTime(1_000);
    latest().open();
    vi.advanceTimersByTime(100);

    expect(latest()).not.toBe(shortLived);
    expect(latest().sent).toContainEqual({
      event: "match:ready",
      data: { id: "match-1" },
    });
  });

  it("stops the heartbeat while the connection is down", () => {
    socket.connect();
    const dropped = latest();
    dropped.open();
    const pings = dropped.pings();

    dropped.fail();
    vi.advanceTimersByTime(HEARTBEAT_MS * 2);

    expect(dropped.pings()).toBe(pings);
    expect(latest()).not.toBe(dropped);
    expect(latest().sent).toEqual([]);
  });
});

describe("Socket lifecycle recovery", () => {
  function exhaustRetries() {
    socket.connect();

    for (let attempt = 0; attempt <= 50; attempt++) {
      latest().fail();
      vi.runOnlyPendingTimers();
    }
  }

  it("gives up after 50 failed reconnects", () => {
    exhaustRetries();
    const attempts = FakeWebSocket.instances.length;

    vi.advanceTimersByTime(60 * 60_000);

    expect(attempts).toBe(51);
    expect(FakeWebSocket.instances).toHaveLength(attempts);
  });

  it("reconnects when the tab comes back after giving up, from a fresh backoff", () => {
    exhaustRetries();
    const attempts = FakeWebSocket.instances.length;

    setVisibility("hidden");

    expect(FakeWebSocket.instances).toHaveLength(attempts);

    setVisibility("visible");

    expect(FakeWebSocket.instances).toHaveLength(attempts + 1);

    latest().fail();
    vi.advanceTimersByTime(1_000);

    expect(FakeWebSocket.instances).toHaveLength(attempts + 2);
  });

  it("reconnects immediately when the network comes back", () => {
    socket.connect();

    for (let attempt = 0; attempt < 3; attempt++) {
      latest().fail();
      vi.runOnlyPendingTimers();
    }

    latest().fail();
    const attempts = FakeWebSocket.instances.length;

    window.dispatchEvent(new Event("online"));

    expect(FakeWebSocket.instances).toHaveLength(attempts + 1);

    latest().open();
    vi.advanceTimersByTime(60_000);

    expect(FakeWebSocket.instances).toHaveLength(attempts + 1);
  });

  it("leaves a connection that is still being opened alone", () => {
    socket.connect();
    latest().fail();
    vi.runOnlyPendingTimers();

    expect(FakeWebSocket.instances).toHaveLength(2);

    window.dispatchEvent(new Event("online"));
    setVisibility("visible");

    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("pings straight away when the tab comes back to a live connection", () => {
    socket.connect();
    const connection = latest();
    connection.open();
    connection.receive("pong");
    const pings = connection.pings();

    vi.advanceTimersByTime(5_000);
    setVisibility("visible");

    expect(connection.pings()).toBe(pings + 1);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("replaces a stale connection when the tab comes back", () => {
    socket.connect();
    const zombie = latest();
    zombie.open();
    zombie.receive("pong");

    vi.setSystemTime(Date.now() + 2 * 60 * 60_000);
    setVisibility("visible");
    vi.advanceTimersByTime(PONG_GRACE_MS);

    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1);

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(zombie.closeCalls).toBe(1);
  });

  it("keeps a connection that answers when the tab comes back", () => {
    socket.connect();
    const connection = latest();
    connection.open();
    connection.receive("pong");

    vi.setSystemTime(Date.now() + 2 * 60 * 60_000);
    setVisibility("visible");
    connection.receive("pong");
    vi.advanceTimersByTime(PONG_GRACE_MS + 1);

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("binds the page listeners only once", () => {
    socket.connect();
    socket.connect();
    socket.connect();

    const [, documentSpy] = lifecycleSpies[0];
    const [, windowSpy] = lifecycleSpies[1];

    expect(
      documentSpy.mock.calls.filter(([type]) => type === "visibilitychange"),
    ).toHaveLength(1);
    expect(
      windowSpy.mock.calls.filter(([type]) => type === "online"),
    ).toHaveLength(1);
  });
});

describe("Socket.isStale", () => {
  const now = 1_000_000;

  it("is never stale before the first pong", () => {
    expect(Socket.isStale(false, 0, now - 10 * 60_000, now)).toBe(false);
  });

  it("is not stale while every ping has been answered", () => {
    expect(Socket.isStale(true, now - 2 * 60_000, undefined, now)).toBe(false);
  });

  it("gives a fresh ping time to be answered", () => {
    expect(Socket.isStale(true, now - 2 * 60_000, now - 5_000, now)).toBe(
      false,
    );
  });

  it("is stale once a ping goes unanswered past the pong timeout", () => {
    expect(Socket.isStale(true, now - 46_000, now - 31_000, now)).toBe(true);
    expect(Socket.isStale(true, now - 44_000, now - 29_000, now)).toBe(false);
  });
});
