import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import NotificationStack from "~/components/notification/NotificationStack.vue";

vi.mock("~/composables/useOrphanedScan", () => ({
  useOrphanedScan: () => ({ dialogOpen: ref(false) }),
}));

const ADMIN_ALERT = {
  type: "PlayerSanctioned",
  title: "Player Banned",
  role: "administrator",
  steam_id: null,
  entity_id: "76561198000000002",
};

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

function notification(id: string, overrides: Record<string, unknown>) {
  return {
    id,
    title: "Title",
    message: "Message",
    type: "MatchStatusChange",
    role: "user",
    steam_id: "76561198000000001",
    entity_id: null,
    is_read: false,
    deletable: true,
    created_at: "2026-09-28T12:00:00Z",
    ...overrides,
  };
}

async function mountStack(top: Record<string, unknown>) {
  const wrapper = await mountSuspended(NotificationStack, {
    props: {
      notifications: [
        notification("top", top),
        notification("older", { ...top, created_at: "2026-09-27T12:00:00Z" }),
      ],
    },
    global: { stubs: { NotificationContext: true } },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

function topCard(wrapper: Awaited<ReturnType<typeof mountStack>>) {
  return wrapper.find('[role="button"]');
}

describe("NotificationStack collapsed sanction tint", () => {
  it("tints a collapsed stack of ban alerts", async () => {
    const wrapper = await mountStack(ADMIN_ALERT);

    const card = topCard(wrapper);
    expect(card.classes()).toContain("overflow-hidden");
    expect(card.find("span.absolute.w-1").classes()).toContain(
      "bg-destructive",
    );
    expect(card.find("h3").classes()).toContain("text-destructive");
    expect(card.find("h3 svg.lucide-ban-icon").exists()).toBe(true);
  });

  it("leaves other collapsed stacks untinted", async () => {
    const wrapper = await mountStack({ entity_id: "match-1" });

    const card = topCard(wrapper);
    expect(card.classes()).not.toContain("overflow-hidden");
    expect(card.find("span.absolute.w-1").exists()).toBe(false);
    expect(card.find("h3 svg").exists()).toBe(false);
  });
});
