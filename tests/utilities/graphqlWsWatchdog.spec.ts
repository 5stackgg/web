// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GRAPHQL_WS_MAX_RETRY_WAIT_MS,
  GRAPHQL_WS_PONG_TIMEOUT_MS,
  GRAPHQL_WS_TIMEOUT_CLOSE_CODE,
  createGraphqlWsWatchdog,
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

  it("backs off exponentially", async () => {
    expect(await waitedMs(0, 1)).toBeLessThanOrEqual(1_000);
    expect(await waitedMs(3, 1)).toBeLessThanOrEqual(8_000);
    expect(await waitedMs(3, 0)).toBeGreaterThanOrEqual(4_000);
  });

  it("never waits longer than the cap, however many retries", async () => {
    expect(await waitedMs(1_000, 1)).toBeLessThanOrEqual(
      GRAPHQL_WS_MAX_RETRY_WAIT_MS,
    );
    expect(await waitedMs(1_000, 0)).toBeGreaterThanOrEqual(
      GRAPHQL_WS_MAX_RETRY_WAIT_MS / 2,
    );
  });
});
