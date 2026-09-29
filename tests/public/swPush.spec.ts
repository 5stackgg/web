// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../public/sw-push.js"),
  "utf8",
);

type Shown = {
  title: string;
  tag?: string;
  data: Record<string, unknown>;
  options: Record<string, unknown>;
  close: ReturnType<typeof vi.fn>;
};

function loadWorker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  let onScreen: Shown[] = [];

  const registration = {
    showNotification: vi.fn(
      async (title: string, options: Record<string, any>) => {
        const shown: Shown = {
          title,
          tag: options.tag,
          data: options.data,
          options,
          close: vi.fn(() => {
            onScreen = onScreen.filter((entry) => entry !== shown);
          }),
        };

        onScreen = [
          ...onScreen.filter(
            (entry) => !options.tag || entry.tag !== options.tag,
          ),
          shown,
        ];
      },
    ),
    getNotifications: vi.fn(async (filter: { tag?: string } = {}) =>
      onScreen.filter((entry) => !filter.tag || entry.tag === filter.tag),
    ),
  };

  const self = {
    registration,
    location: { hostname: "5stack.gg" },
    clients: { matchAll: vi.fn(async () => []), openWindow: vi.fn() },
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener;
    },
  };

  new Function("self", "navigator", source)(self, {});

  const push = (payload: Record<string, unknown>) => {
    let settled = false;
    let visibleWhenSettled: number | undefined;
    let done: Promise<unknown> = Promise.resolve();

    listeners.push({
      data: { json: () => payload, text: () => JSON.stringify(payload) },
      waitUntil: (promise: Promise<unknown>) => {
        done = promise.then(() => {
          settled = true;
          visibleWhenSettled = onScreen.length;
        });
      },
    });

    return {
      done,
      isSettled: () => settled,
      visibleWhenSettled: () => visibleWhenSettled,
    };
  };

  return {
    registration,
    push,
    onScreen: () => onScreen,
  };
}

const NOW = new Date("2026-09-28T12:00:00.000Z");

const inSeconds = (seconds: number) =>
  new Date(NOW.getTime() + seconds * 1000).toISOString();

const matchFound = (overrides: Record<string, unknown> = {}) => ({
  title: "Match found",
  body: "Your Competitive match is ready — accept within 30s",
  tag: "MatchFound:confirmation-1",
  threadKey: "MatchFound:confirmation-1",
  url: "/play",
  renotify: true,
  actions: [],
  urgent: true,
  ttl: 30,
  expiresAt: inSeconds(30),
  ...overrides,
});

const chatMessage = {
  title: "Luke",
  body: "gg",
  tag: "chat:lobby:abc",
  threadKey: "chat:lobby:abc",
  url: "/chat/abc",
  renotify: true,
  actions: [],
};

describe("sw-push", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rings an urgent push: vibrates and stays on screen", async () => {
    const worker = loadWorker();

    worker.push(matchFound());
    await vi.advanceTimersByTimeAsync(0);

    const [title, options] = worker.registration.showNotification.mock.calls[0];

    expect(title).toBe("Match found");
    expect(options).toMatchObject({
      tag: "MatchFound:confirmation-1",
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      data: { url: "/play", threadKey: "MatchFound:confirmation-1" },
    });
  });

  it("leaves every other push as it was", async () => {
    const worker = loadWorker();

    worker.push(chatMessage);
    await vi.advanceTimersByTimeAsync(0);

    const [, options] = worker.registration.showNotification.mock.calls[0];

    expect(options).not.toHaveProperty("requireInteraction");
    expect(options).not.toHaveProperty("vibrate");
    expect(options).toMatchObject({ tag: "chat:lobby:abc", renotify: true });
  });

  it("closes the notification at expiresAt", async () => {
    const worker = loadWorker();

    worker.push(matchFound());
    await vi.advanceTimersByTimeAsync(29_999);

    expect(worker.onScreen()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);

    expect(worker.onScreen()).toHaveLength(0);
    expect(worker.registration.getNotifications).toHaveBeenCalledWith({
      tag: "MatchFound:confirmation-1",
    });
  });

  it("settles the push event while the ring is still on screen, or Chrome counts it as silent", async () => {
    const worker = loadWorker();

    const event = worker.push(matchFound());
    await vi.advanceTimersByTimeAsync(0);

    expect(event.isSettled()).toBe(true);
    expect(event.visibleWhenSettled()).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("sets no timer without expiresAt", async () => {
    const worker = loadWorker();

    const event = worker.push(chatMessage);
    await event.done;

    expect(event.isSettled()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(worker.registration.getNotifications).not.toHaveBeenCalled();
    expect(worker.onScreen()).toHaveLength(1);
  });

  it("caps the wait when the device clock runs behind the server's", async () => {
    const worker = loadWorker();

    worker.push(matchFound({ expiresAt: inSeconds(600) }));
    await vi.advanceTimersByTimeAsync(59_999);

    expect(worker.onScreen()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);

    expect(worker.onScreen()).toHaveLength(0);
  });

  it("still shows a ring for a moment when the device clock runs ahead", async () => {
    const worker = loadWorker();

    const event = worker.push(matchFound({ expiresAt: inSeconds(-5) }));
    await vi.advanceTimersByTimeAsync(0);

    expect(event.isSettled()).toBe(true);
    expect(event.visibleWhenSettled()).toBe(1);

    await vi.advanceTimersByTimeAsync(4_999);

    expect(worker.onScreen()).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);

    expect(worker.onScreen()).toHaveLength(0);
  });

  it("does not let a superseded push close the one that replaced it", async () => {
    const worker = loadWorker();

    worker.push(matchFound());
    await vi.advanceTimersByTimeAsync(10_000);
    worker.push(matchFound({ body: "again", expiresAt: inSeconds(40) }));
    await vi.advanceTimersByTimeAsync(20_000);

    expect(worker.onScreen().map(({ options }) => options.body)).toEqual([
      "again",
    ]);

    await vi.advanceTimersByTimeAsync(10_000);

    expect(worker.onScreen()).toHaveLength(0);
  });

  it("ignores an expiresAt that is not a timestamp", async () => {
    const worker = loadWorker();

    const event = worker.push(matchFound({ expiresAt: "soon" }));
    await event.done;

    expect(vi.getTimerCount()).toBe(0);
    expect(worker.onScreen()).toHaveLength(1);
  });
});
