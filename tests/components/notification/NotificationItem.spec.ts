import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import NotificationItem from "~/components/notification/NotificationItem.vue";

vi.mock("~/composables/useOrphanedScan", () => ({
  useOrphanedScan: () => ({ dialogOpen: ref(false) }),
}));

const PLAYER = "76561198000000001";
const OTHER = "76561198000000002";

const AMBER_BAR = "bg-[hsl(var(--tac-amber))]";
const AMBER_TEXT = "text-[hsl(var(--tac-amber))]";

let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
});

async function mountItem(overrides: Record<string, unknown>) {
  const wrapper = await mountSuspended(NotificationItem, {
    props: {
      notification: {
        id: "notification-1",
        title: "Title",
        message: "Message",
        type: "MatchStatusChange",
        role: "user",
        steam_id: PLAYER,
        entity_id: null,
        is_read: false,
        deletable: true,
        created_at: "2026-09-28T12:00:00Z",
        ...overrides,
      },
    },
    global: { stubs: { NotificationContext: true } },
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

function accentBar(wrapper: Awaited<ReturnType<typeof mountItem>>) {
  return wrapper.find("span.absolute.inset-y-0.left-0.w-1");
}

describe("NotificationItem sanction tint", () => {
  it("gives a warning the amber accent bar, title and alert icon", async () => {
    const wrapper = await mountItem({
      type: "PlayerWarning",
      title: "You received a warning",
      entity_id: PLAYER,
    });

    expect(wrapper.classes()).toContain("overflow-hidden");
    expect(accentBar(wrapper).classes()).toContain(AMBER_BAR);
    const title = wrapper.find("h3");
    expect(title.classes()).toContain(AMBER_TEXT);
    expect(title.find("svg.lucide-triangle-alert-icon").exists()).toBe(true);
  });

  it("keeps the warning bar but mutes the title once read", async () => {
    const wrapper = await mountItem({
      type: "PlayerWarning",
      entity_id: PLAYER,
      is_read: true,
    });

    expect(accentBar(wrapper).classes()).toContain(AMBER_BAR);
    expect(wrapper.find("h3").classes()).toContain("text-muted-foreground");
    expect(wrapper.find("h3").classes()).not.toContain(AMBER_TEXT);
  });

  it("tints the banned player's own notice as a ban", async () => {
    const wrapper = await mountItem({
      type: "PlayerSanctioned",
      title: "You have been banned",
      entity_id: PLAYER,
    });

    expect(accentBar(wrapper).classes()).toContain("bg-destructive");
    const title = wrapper.find("h3");
    expect(title.classes()).toContain("text-destructive");
    expect(title.find("svg.lucide-ban-icon").exists()).toBe(true);
  });

  it("tints the admin ban alert as a ban", async () => {
    const wrapper = await mountItem({
      type: "PlayerSanctioned",
      title: "Player Banned",
      role: "administrator",
      steam_id: null,
      entity_id: OTHER,
    });

    expect(accentBar(wrapper).classes()).toContain("bg-destructive");
    expect(wrapper.find("h3").classes()).toContain("text-destructive");
  });

  it("leaves the co-player notice untinted since older ones covered mutes", async () => {
    const wrapper = await mountItem({
      type: "PlayerSanctioned",
      title: "Player Sanctioned",
      entity_id: OTHER,
    });

    expect(accentBar(wrapper).exists()).toBe(false);
    expect(wrapper.classes()).not.toContain("overflow-hidden");
    expect(wrapper.find("h3").classes()).not.toContain("text-destructive");
  });

  it("leaves other notification types unchanged", async () => {
    const wrapper = await mountItem({ type: "MatchStatusChange" });

    expect(accentBar(wrapper).exists()).toBe(false);
    expect(wrapper.find("h3 svg").exists()).toBe(false);
  });
});
