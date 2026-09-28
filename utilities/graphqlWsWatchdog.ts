import type { Client, ClientOptions } from "graphql-ws";

type WatchedSocket = {
  close: (code?: number, reason?: string) => void;
};

export const GRAPHQL_WS_PONG_TIMEOUT_MS = 10_000;
export const GRAPHQL_WS_TIMEOUT_CLOSE_CODE = 4408;
export const GRAPHQL_WS_MAX_RETRY_WAIT_MS = 30_000;

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
  const ceiling = Math.min(1000 * 2 ** retries, GRAPHQL_WS_MAX_RETRY_WAIT_MS);
  const wait = ceiling / 2 + Math.random() * (ceiling / 2);

  return new Promise<void>((resolve) => {
    setTimeout(resolve, wait);
  });
}
