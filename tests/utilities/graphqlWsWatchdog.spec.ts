// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GRAPHQL_WS_KEEP_ALIVE_MS,
  GRAPHQL_WS_MAX_RETRY_WAIT_MS,
  GRAPHQL_WS_PONG_TIMEOUT_MS,
  GRAPHQL_WS_RETRY_JITTER_MS,
  GRAPHQL_WS_TIMEOUT_CLOSE_CODE,
  createGraphqlWsWatchdog,
  createWatchedGraphqlWsClient,
  graphqlWsRetryWait,
} from "~/utilities/graphqlWsWatchdog";

function watchedConnection() {
  const watchdog = createGraphqlWsWatchdog();
  const socket = { close: vi.fn() };
  const client = { terminate: vi.fn() };

  watchdog.watch(client);
  watchdog.on.connected(socket);

  return { watchdog, socket, client };
}

describe("graphql-ws watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("closes and terminates a socket that never answers its ping", () => {
    const { watchdog, socket, client } = watchedConnection();

    watchdog.on.ping(false);
    vi.advanceTimersByTime(GRAPHQL_WS_PONG_TIMEOUT_MS - 1);

    expect(socket.close).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(socket.close).toHaveBeenCalledWith(
      GRAPHQL_WS_TIMEOUT_CLOSE_CODE,
      "Request Timeout",
    );
    expect(client.terminate).toHaveBeenCalledTimes(1);
  });

  it("stands down once the pong arrives", () => {
    const { watchdog, socket, client } = watchedConnection();

    watchdog.on.ping(false);
    vi.advanceTimersByTime(GRAPHQL_WS_PONG_TIMEOUT_MS / 2);
    watchdog.on.pong(true);
    vi.advanceTimersByTime(GRAPHQL_WS_PONG_TIMEOUT_MS * 2);

    expect(socket.close).not.toHaveBeenCalled();
    expect(client.terminate).not.toHaveBeenCalled();
  });

  it("stands down when the socket closes on its own", () => {
    const { watchdog, socket, client } = watchedConnection();

    watchdog.on.ping(false);
    watchdog.on.closed({ code: 1006 });
    vi.advanceTimersByTime(GRAPHQL_WS_PONG_TIMEOUT_MS * 2);

    expect(socket.close).not.toHaveBeenCalled();
    expect(client.terminate).not.toHaveBeenCalled();
  });

  it("ignores the server's pings and our replies to them", () => {
    const { watchdog, socket, client } = watchedConnection();

    watchdog.on.ping(true);
    vi.advanceTimersByTime(GRAPHQL_WS_PONG_TIMEOUT_MS * 2);

    expect(socket.close).not.toHaveBeenCalled();

    watchdog.on.ping(false);
    watchdog.on.pong(false);
    vi.advanceTimersByTime(GRAPHQL_WS_PONG_TIMEOUT_MS);

    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(client.terminate).toHaveBeenCalledTimes(1);
  });

  it("times each ping from when it was sent", () => {
    const { watchdog, socket } = watchedConnection();

    watchdog.on.ping(false);
    vi.advanceTimersByTime(GRAPHQL_WS_PONG_TIMEOUT_MS - 1);
    watchdog.on.pong(true);
    watchdog.on.ping(false);
    vi.advanceTimersByTime(GRAPHQL_WS_PONG_TIMEOUT_MS - 1);

    expect(socket.close).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(socket.close).toHaveBeenCalledTimes(1);
  });
});

describe("graphqlWsRetryWait", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function waitedMs(retries: number, random: number) {
    vi.spyOn(Math, "random").mockReturnValue(random);

    let resolved = false;
    const started = Date.now();
    void graphqlWsRetryWait(retries).then(() => {
      resolved = true;
    });

    while (!resolved) {
      await vi.advanceTimersByTimeAsync(10);
    }

    return Date.now() - started;
  }

  it("backs off exponentially, spread by the jitter", async () => {
    expect(await waitedMs(0, 0)).toBe(1_000);
    expect(await waitedMs(0, 1)).toBe(1_000 + GRAPHQL_WS_RETRY_JITTER_MS);
    expect(await waitedMs(3, 0)).toBe(8_000);
  });

  it("never waits longer than the cap, however many retries", async () => {
    expect(await waitedMs(1_000, 1)).toBe(GRAPHQL_WS_MAX_RETRY_WAIT_MS);
    expect(await waitedMs(1_000, 0)).toBe(
      GRAPHQL_WS_MAX_RETRY_WAIT_MS - GRAPHQL_WS_RETRY_JITTER_MS,
    );
  });
});

class FakeGraphqlSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  static instances: FakeGraphqlSocket[] = [];

  readyState = FakeGraphqlSocket.CONNECTING;
  sent: Array<{ type: string }> = [];
  closes: Array<{ code?: number; reason?: string }> = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;

  constructor(public url: string) {
    FakeGraphqlSocket.instances.push(this);
  }

  send(payload: string) {
    this.sent.push(JSON.parse(payload));
  }

  // A dead TCP connection never gets far enough to report a close.
  close(code?: number, reason?: string) {
    this.closes.push({ code, reason });
    this.readyState = FakeGraphqlSocket.CLOSING;
  }

  open() {
    this.readyState = FakeGraphqlSocket.OPEN;
    this.onopen?.();
  }

  receive(message: { type: string }) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  serverClose(code: number, reason = "") {
    this.readyState = FakeGraphqlSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: code !== 1006 });
  }

  failHandshake() {
    this.readyState = FakeGraphqlSocket.CLOSED;
    this.onerror?.({ type: "error" });
    this.onclose?.({ code: 1006, reason: "", wasClean: false });
  }

  types() {
    return this.sent.map(({ type }) => type);
  }
}

describe("createWatchedGraphqlWsClient", () => {
  let unsubscribe: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    FakeGraphqlSocket.instances = [];
  });

  afterEach(() => {
    unsubscribe?.();
    unsubscribe = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function latest() {
    return FakeGraphqlSocket.instances[FakeGraphqlSocket.instances.length - 1];
  }

  async function acknowledge(socket: FakeGraphqlSocket) {
    socket.open();
    await vi.advanceTimersByTimeAsync(0);
    socket.receive({ type: "connection_ack" });
    await vi.advanceTimersByTimeAsync(0);
  }

  async function subscribed() {
    const client = createWatchedGraphqlWsClient({
      url: "wss://api.test/v1/graphql",
      webSocketImpl: FakeGraphqlSocket,
    });
    const sink = { next: vi.fn(), error: vi.fn(), complete: vi.fn() };

    unsubscribe = client.subscribe({ query: "subscription { ok }" }, sink);
    await acknowledge(latest());

    expect(latest().types()).toEqual(["connection_init", "subscribe"]);

    return sink;
  }

  it("replaces a socket that stops answering and resubscribes", async () => {
    const sink = await subscribed();
    const zombie = latest();

    await vi.advanceTimersByTimeAsync(GRAPHQL_WS_KEEP_ALIVE_MS);

    expect(zombie.types()).toContain("ping");

    await vi.advanceTimersByTimeAsync(GRAPHQL_WS_PONG_TIMEOUT_MS);

    expect(zombie.closes[0]).toEqual({
      code: GRAPHQL_WS_TIMEOUT_CLOSE_CODE,
      reason: "Request Timeout",
    });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(FakeGraphqlSocket.instances).toHaveLength(2);

    await acknowledge(latest());

    expect(latest().types()).toEqual(["connection_init", "subscribe"]);
    expect(sink.error).not.toHaveBeenCalled();
  });

  it("keeps a socket that answers every ping", async () => {
    await subscribed();
    const socket = latest();

    for (let ping = 0; ping < 4; ping++) {
      await vi.advanceTimersByTimeAsync(GRAPHQL_WS_KEEP_ALIVE_MS);
      socket.receive({ type: "pong" });
    }

    await vi.advanceTimersByTimeAsync(GRAPHQL_WS_PONG_TIMEOUT_MS);

    expect(socket.types().filter((type) => type === "ping")).toHaveLength(4);
    expect(socket.closes).toEqual([]);
    expect(FakeGraphqlSocket.instances).toHaveLength(1);
  });

  it("keeps retrying through reconnects that fail their handshake", async () => {
    const sink = await subscribed();

    latest().serverClose(1006);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(FakeGraphqlSocket.instances).toHaveLength(2);

    latest().failHandshake();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(FakeGraphqlSocket.instances).toHaveLength(3);

    await acknowledge(latest());

    expect(latest().types()).toEqual(["connection_init", "subscribe"]);
    expect(sink.error).not.toHaveBeenCalled();
  });

  it("keeps retrying past graphql-ws's default of five attempts", async () => {
    const sink = await subscribed();

    latest().serverClose(1006);

    for (let attempt = 1; attempt <= 8; attempt++) {
      await vi.advanceTimersByTimeAsync(GRAPHQL_WS_MAX_RETRY_WAIT_MS);

      expect(FakeGraphqlSocket.instances).toHaveLength(attempt + 1);

      latest().failHandshake();
    }

    await vi.advanceTimersByTimeAsync(GRAPHQL_WS_MAX_RETRY_WAIT_MS);
    await acknowledge(latest());

    expect(latest().types()).toEqual(["connection_init", "subscribe"]);
    expect(sink.error).not.toHaveBeenCalled();
  });

  it("still gives up on a close graphql-ws treats as fatal", async () => {
    const sink = await subscribed();

    latest().serverClose(4400, "Bad request");
    await vi.advanceTimersByTimeAsync(GRAPHQL_WS_MAX_RETRY_WAIT_MS);

    expect(sink.error).toHaveBeenCalledTimes(1);
    expect(FakeGraphqlSocket.instances).toHaveLength(1);
  });
});
