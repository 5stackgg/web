import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import PlayerSanctions from "~/components/PlayerSanctions.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { e_player_roles_enum } from "~/generated/zeus";

const PLAYER = "76561198000000001";
const MODERATOR = "76561198000000099";

const AMBER_BAR = "bg-[hsl(var(--tac-amber))]";
const AMBER_TEXT = "text-[hsl(var(--tac-amber))]";

function sanction(
  id: string,
  type: string,
  remove_sanction_date: string | null = null,
) {
  return {
    id,
    type,
    reason: `${type} reason`,
    created_at: "2026-09-01T12:00:00Z",
    remove_sanction_date,
  };
}

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString();

let rows: any[] = [];
let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

function serve() {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  vi.spyOn(client, "subscribe").mockImplementation((options: any) => ({
    subscribe(observer: any) {
      const root = options.query.definitions[0].selectionSet.selections[0].name
        .value as string;
      const data = { [root]: root === "player_sanctions" ? rows : [] };
      Promise.resolve().then(() => observer.next({ data }));
      return { unsubscribe() {}, closed: false };
    },
  }));
  mutate = vi.fn().mockResolvedValue({
    data: { unsanctionServerPlayer: { enforced: false, message: "ok" } },
  });
  vi.spyOn(client, "mutate").mockImplementation(mutate);
}

async function mountSheet(sanctions: any[]) {
  rows = sanctions;
  useAuthStore().me = {
    steam_id: MODERATOR,
    name: "Moderator",
    role: e_player_roles_enum.moderator,
  } as unknown as ReturnType<typeof useAuthStore>["me"];
  serve();
  const wrapper = await mountSuspended(PlayerSanctions, {
    props: {
      playerId: PLAYER,
      player: { steam_id: PLAYER, name: "Player" },
      variant: "external",
      open: true,
    },
    attachTo: document.body,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: { SanctionPlayer: true, PlayerDisplay: true },
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

function cards(): HTMLElement[] {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>(
      "div.relative.overflow-hidden.rounded-lg.border.border-border",
    ),
  );
}

function typeLabelOf(el: HTMLElement) {
  return el
    .querySelector("span.text-sm.font-semibold.uppercase")
    ?.textContent?.trim();
}

function card(typeLabel: string): HTMLElement {
  const found = cards().find((el) => typeLabelOf(el) === typeLabel);
  expect(found, `card for ${typeLabel}`).toBeDefined();
  return found!;
}

function statusPill(el: HTMLElement) {
  return el.querySelector<HTMLElement>("span.rounded-full.border")!;
}

function lastSummary(wrapper: Awaited<ReturnType<typeof mountSheet>>) {
  const events = wrapper.emitted("summary") as Array<[any]>;
  return events[events.length - 1][0];
}

describe("PlayerSanctions warnings", () => {
  it("renders a warning as its own amber entry", async () => {
    await mountSheet([sanction("warning-1", "warning")]);

    const warning = card("Warning");
    const bar = warning.querySelector("span.absolute.w-1")!;
    const icon = warning.querySelector("svg.lucide-triangle-alert-icon")!;
    expect(bar.className).toContain(AMBER_BAR);
    expect(icon.getAttribute("class")).toContain(AMBER_TEXT);
    expect(statusPill(warning).textContent!.trim()).toBe("On record");
    expect(statusPill(warning).className).toContain(AMBER_TEXT);
    expect(warning.className).not.toContain("opacity-70");
    expect(warning.textContent).not.toContain("Permanent");
    expect(warning.textContent).not.toContain("Active");
    expect(warning.querySelector('[aria-label="Edit"]')).toBeNull();
    expect(warning.querySelector('[aria-label="Remove"]')).not.toBeNull();
  });

  it("keeps the edit control and permanence row on enforced sanctions", async () => {
    await mountSheet([sanction("ban-1", "ban")]);

    const ban = card("Ban");
    expect(ban.querySelector('[aria-label="Edit"]')).not.toBeNull();
    expect(ban.textContent).toContain("Permanent");
    expect(statusPill(ban).textContent!.trim()).toBe("Active");
  });

  it("tones an active ban pill destructive and milder ones amber", async () => {
    await mountSheet([
      sanction("ban-1", "ban"),
      sanction("mute-1", "mute", tomorrow()),
    ]);

    expect(statusPill(card("Ban")).className).toContain("text-destructive");
    expect(statusPill(card("Mute")).className).toContain(AMBER_TEXT);
    expect(statusPill(card("Mute")).textContent!.trim()).toBe("Active");
  });

  it("never opens the end-date editor for a warning", async () => {
    const wrapper = await mountSheet([sanction("warning-1", "warning")]);
    const vm = wrapper.vm as any;

    vm.openEditDialog(rows[0]);
    await flushPromises();

    expect(vm.editDialogOpen).toBe(false);
    expect(vm.editingSanction).toBeNull();
  });

  it("localizes every sanction type label", async () => {
    await mountSheet([
      sanction("ban-1", "ban"),
      sanction("mute-1", "mute", tomorrow()),
      sanction("gag-1", "gag", tomorrow()),
      sanction("silence-1", "silence", tomorrow()),
      sanction("warning-1", "warning"),
    ]);

    expect(cards().map(typeLabelOf)).toEqual([
      "Ban",
      "Mute",
      "Gag",
      "Silence",
      "Warning",
    ]);
  });

  it("does not flag the hero as dangerous for warnings alone", async () => {
    const wrapper = await mountSheet([
      sanction("warning-1", "warning"),
      sanction("warning-2", "warning"),
    ]);

    expect(lastSummary(wrapper)).toMatchObject({
      available: true,
      count: 2,
      hasActive: false,
    });
  });

  it("still flags the hero for an enforced sanction beside a warning", async () => {
    const wrapper = await mountSheet([
      sanction("warning-1", "warning"),
      sanction("mute-1", "mute", tomorrow()),
    ]);

    expect(lastSummary(wrapper)).toMatchObject({ count: 2, hasActive: true });
  });

  it.each([
    ["Warning", "warning-7", "warning"],
    ["Ban", "ban-3", "ban"],
  ])("removes a %s by its sanction id", async (label, id, type) => {
    await mountSheet([
      sanction("warning-7", "warning"),
      sanction("ban-3", "ban"),
    ]);

    card(label)
      .querySelector<HTMLButtonElement>('[aria-label="Remove"]')!
      .click();
    await flushPromises();

    const confirm = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        '[role="alertdialog"] button',
      ),
    ).find((button) => button.textContent?.trim() === "Confirm");
    expect(confirm, "confirm button").toBeDefined();
    confirm!.click();
    await flushPromises();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].variables).toEqual({
      serverId: null,
      steam_id: PLAYER,
      type,
      sanction_id: id,
    });
  });

  it("removes only the expired ban, not the active ban beside it", async () => {
    await mountSheet([
      sanction("ban-expired", "ban", yesterday()),
      sanction("ban-active", "ban", tomorrow()),
    ]);

    const expired = cards().find(
      (el) => statusPill(el).textContent?.trim() === "Expired",
    );
    expect(expired, "expired ban card").toBeDefined();
    expired!.querySelector<HTMLButtonElement>('[aria-label="Remove"]')!.click();
    await flushPromises();

    const confirm = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        '[role="alertdialog"] button',
      ),
    ).find((button) => button.textContent?.trim() === "Confirm");
    expect(confirm, "confirm button").toBeDefined();
    confirm!.click();
    await flushPromises();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].variables).toMatchObject({
      type: "ban",
      sanction_id: "ban-expired",
    });
  });
});
