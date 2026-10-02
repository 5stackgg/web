import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import NotificationItem from "~/components/notification/NotificationItem.vue";

const { toastMock, set } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  set: vi.fn(async () => {}),
}));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: toastMock,
}));

vi.mock("~/composables/useOrphanedScan", () => ({
  useOrphanedScan: () => ({ dialogOpen: ref(false) }),
}));

mockNuxtImport("useNotificationPreferences", () => () => ({
  preferences: ref({
    push: [],
    in_app: [
      { key: "TournamentReminder", enabled: true, defaultEnabled: true },
    ],
  }),
  loaded: ref(true),
  set,
  isAlertTypeEnabled: () => true,
}));

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  toastMock.mockClear();
  set.mockClear();
  document.body.innerHTML = "";
});

async function mountItem(type: string) {
  const wrapper = await mountSuspended(NotificationItem, {
    props: {
      notification: {
        id: "notification-1",
        title: "Tournament starting soon",
        message: "Autumn Cup starts in 30 minutes.",
        type,
        role: "user",
        steam_id: "76561198000000001",
        entity_id: null,
        is_read: false,
        deletable: true,
        created_at: "2026-10-02T12:00:00Z",
      },
    },
    global: { stubs: { NotificationContext: true } },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

async function openMenu(wrapper: Awaited<ReturnType<typeof mountItem>>) {
  const trigger = wrapper
    .findAll("button")
    .find((button) => button.text().includes("More Actions"));
  expect(trigger).toBeDefined();

  await trigger!.trigger("click", { button: 0, ctrlKey: false });
  await flushPromises();

  const items = Array.from(
    document.body.querySelectorAll<HTMLElement>("[role='menuitem']"),
  );
  expect(items.length).toBeGreaterThan(0);
  return items;
}

describe("turning a kind off from the bell", () => {
  it("turns that kind off in the bell, then offers Undo", async () => {
    const wrapper = await mountItem("TournamentReminder");
    const items = await openMenu(wrapper);

    const turnOff = items.find((item) =>
      item.textContent?.includes("Turn Off Tournament reminders"),
    );
    expect(turnOff).toBeDefined();

    turnOff!.click();
    await flushPromises();

    expect(set).toHaveBeenCalledWith("in_app", "TournamentReminder", false);

    const [options] = toastMock.mock.calls.at(-1)!;
    expect(options.title).toBe("Tournament reminders turned off");
    expect(options.description).toBe(
      "You can turn them back on in Notifications.",
    );

    await options.action.props.onClick();
    await flushPromises();

    expect(set).toHaveBeenLastCalledWith("in_app", "TournamentReminder", true);
  });

  it("offers no Turn Off for a notice the bell always shows", async () => {
    const wrapper = await mountItem("PlayerWarning");
    const items = await openMenu(wrapper);

    expect(items.some((item) => item.textContent?.includes("Turn Off"))).toBe(
      false,
    );
  });

  it("links to the Notifications page from the menu", async () => {
    const wrapper = await mountItem("PlayerWarning");
    const items = await openMenu(wrapper);

    const settings = items.find((item) =>
      item.textContent?.includes("Notification Settings"),
    );
    expect(settings?.getAttribute("href")).toBe("/settings/notifications");
  });
});
