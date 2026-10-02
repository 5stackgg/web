import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import NotificationStack from "~/components/notification/NotificationStack.vue";

const { toastMock, state } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  state: {
    preferences: null as any,
    calls: [] as Array<[string, string, boolean]>,
  },
}));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast: toastMock,
}));

vi.mock("~/composables/useOrphanedScan", () => ({
  useOrphanedScan: () => ({ dialogOpen: ref(false) }),
}));

mockNuxtImport("useNotificationPreferences", () => () => ({
  preferences: state.preferences,
  loaded: ref(true),
  set: async (channel: string, key: string, enabled: boolean) => {
    state.calls.push([channel, key, enabled]);
    const row = state.preferences.value[channel].find(
      (entry: { key: string }) => entry.key === key,
    );
    if (row) {
      row.enabled = enabled;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  },
  isAlertTypeEnabled: () => true,
}));

const toggle = (key: string) => ({ key, enabled: true, defaultEnabled: true });

const notification = (id: string, type: string, created_at: string) => ({
  id,
  title: type,
  message: type,
  type,
  role: "user",
  steam_id: "76561198000000001",
  entity_id: "tournament-1",
  is_read: false,
  deletable: true,
  created_at,
});

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  toastMock.mockClear();
  state.calls = [];
  document.body.innerHTML = "";
});

// The stack is fed what the bell would show, so turning a kind off drops it
// and the next row's kind slides into the top card, the way the panel does.
async function mountStack(rows: ReturnType<typeof notification>[]) {
  const Bell = defineComponent({
    setup() {
      const visible = computed(() =>
        rows.filter(
          (row) =>
            state.preferences.value.in_app.find(
              (entry: { key: string }) => entry.key === row.type,
            )?.enabled !== false,
        ),
      );
      return () => h(NotificationStack, { notifications: visible.value });
    },
  });

  const wrapper = await mountSuspended(Bell, {
    global: { stubs: { NotificationContext: true } },
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

const kebab = (wrapper: Awaited<ReturnType<typeof mountStack>>) =>
  wrapper
    .findAll("button")
    .find((button) => button.text().includes("More Actions"));

const menuItems = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>("[role='menuitem']"));

describe("Turn Off on a stacked notification", () => {
  it("undoes the kind that was turned off, not the one that replaced it", async () => {
    state.preferences = ref({
      push: [],
      in_app: [
        toggle("TournamentCheckInClosing"),
        toggle("TournamentCheckInOpen"),
        toggle("TournamentReminder"),
      ],
    });

    const wrapper = await mountStack([
      notification("3", "TournamentCheckInClosing", "2026-10-02T12:03:00Z"),
      notification("2", "TournamentCheckInOpen", "2026-10-02T12:02:00Z"),
      notification("1", "TournamentReminder", "2026-10-02T12:01:00Z"),
    ]);

    await kebab(wrapper)!.trigger("click", { button: 0, ctrlKey: false });
    await flushPromises();

    menuItems()
      .find((item) => item.textContent?.includes("Turn Off Check-in closing"))!
      .click();
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();

    expect(state.calls).toEqual([
      ["in_app", "TournamentCheckInClosing", false],
    ]);

    const [options] = toastMock.mock.calls.at(-1)!;
    expect(options.title).toBe("Check-in closing turned off");

    await options.action.props.onClick();
    await flushPromises();

    expect(state.calls.at(-1)).toEqual([
      "in_app",
      "TournamentCheckInClosing",
      true,
    ]);
  });

  it("opens the menu from the keyboard without expanding the stack", async () => {
    state.preferences = ref({
      push: [],
      in_app: [toggle("TournamentReminder")],
    });

    const wrapper = await mountStack([
      notification("2", "TournamentReminder", "2026-10-02T12:02:00Z"),
      notification("1", "TournamentReminder", "2026-10-02T12:01:00Z"),
    ]);

    await kebab(wrapper)!.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(kebab(wrapper)?.element.closest("[role='button']")).not.toBeNull();
    expect(menuItems().length).toBeGreaterThan(0);
  });
});
