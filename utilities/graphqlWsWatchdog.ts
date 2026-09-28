import { createClient } from "graphql-ws";
import type { Client, ClientOptions } from "graphql-ws";

type WatchedSocket = {
  close: (code?: number, reason?: string) => void;
};

export const GRAPHQL_WS_KEEP_ALIVE_MS = 15_000;
export const GRAPHQL_WS_PONG_TIMEOUT_MS = 10_000;
export const GRAPHQL_WS_TIMEOUT_CLOSE_CODE = 4408;
export const GRAPHQL_WS_MAX_RETRY_WAIT_MS = 30_000;
export const GRAPHQL_WS_RETRY_JITTER_MS = 3_000;

export function createGraphqlWsWatchdog(
  timeoutMs = GRAPHQL_WS_PONG_TIMEOUT_MS,
) {
  let socket: WatchedSocket | undefined;
  let client: Pick<Client, "terminate"> | undefined;
  let pongTimer: ReturnType<typeof setTimeout> | undefined;

  function disarm() {
    clearTimeout(pongTimer);
    pongTimer = undefined;
  }

  function timedOut() {
    pongTimer = undefined;
    console.warn(`[graphql-ws] no pong within ${timeoutMs}ms, reconnecting`);

    socket?.close(GRAPHQL_WS_TIMEOUT_CLOSE_CODE, "Request Timeout");

    // A socket whose connection died never reports its close, and graphql-ws
    // only retries once it hears one.
    client?.terminate();
  }

  const on = {
    connected: (connectedSocket: unknown) => {
      socket = connectedSocket as WatchedSocket;
    },
    ping: (received: boolean) => {
      if (received) {
        return;
      }

      disarm();
      pongTimer = setTimeout(timedOut, timeoutMs);
    },
    pong: (received: boolean) => {
      if (received) {
        disarm();
      }
    },
    closed: () => {
      disarm();
      socket = undefined;
    },
  } satisfies ClientOptions["on"];

  return {
    on,
    watch(watchedClient: Pick<Client, "terminate">) {
      client = watchedClient;
    },
  };
}

export function graphqlWsRetryWait(retries: number) {
  const backoff = Math.min(
    1000 * 2 ** retries,
    GRAPHQL_WS_MAX_RETRY_WAIT_MS - GRAPHQL_WS_RETRY_JITTER_MS,
  );
  const wait = backoff + Math.random() * GRAPHQL_WS_RETRY_JITTER_MS;

  return new Promise<void>((resolve) => {
    setTimeout(resolve, wait);
  });
}

export function createWatchedGraphqlWsClient(
  options: Pick<ClientOptions, "url" | "connectionParams" | "webSocketImpl">,
) {
  const watchdog = createGraphqlWsWatchdog();

  const client = createClient({
    ...options,
    keepAlive: GRAPHQL_WS_KEEP_ALIVE_MS,
    retryAttempts: Infinity,
    retryWait: graphqlWsRetryWait,
    // The default only retries close events, and a reconnect that fails its
    // handshake reports an error first. graphql-ws still gives up on the
    // close codes it treats as fatal (auth and protocol failures).
    shouldRetry: () => true,
    on: watchdog.on,
  });

  watchdog.watch(client);

  return client;
}
