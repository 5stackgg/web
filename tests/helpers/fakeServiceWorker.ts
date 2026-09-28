import { vi } from "vitest";

export type FakeNotification = {
  tag: string;
  close: ReturnType<typeof vi.fn>;
};

export function fakeServiceWorker({
  tags = [],
  registered = true,
}: {
  tags?: string[];
  registered?: boolean;
} = {}) {
  const notifications: FakeNotification[] = tags.map((tag) => ({
    tag,
    close: vi.fn(),
  }));

  const registration = {
    getNotifications: vi.fn(async ({ tag }: { tag?: string } = {}) =>
      notifications.filter((notification) => !tag || notification.tag === tag),
    ),
  };

  const serviceWorker = {
    getRegistration: vi.fn(async () => (registered ? registration : undefined)),
  };

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  });

  return {
    notifications,
    registration,
    show(tag: string) {
      const notification = { tag, close: vi.fn() };
      notifications.push(notification);
      return notification;
    },
    serviceWorker,
    closed: () =>
      notifications
        .filter((notification) => notification.close.mock.calls.length > 0)
        .map(({ tag }) => tag),
    restore() {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    },
  };
}
