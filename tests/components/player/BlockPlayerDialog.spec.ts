import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import BlockPlayerDialog from "~/components/player/BlockPlayerDialog.vue";
import { toast, useToast } from "~/components/ui/toast";
import { BLOCK_PLAYER_MUTATION } from "~/graphql/playerBlocks";

const graphql = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    mutate: graphql.mutate,
    subscribe: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
  }),
}));

const DANA = { steam_id: "76561198000000002", name: "Dana" };

let unmount: (() => void) | undefined;

const lastToast = () => useToast().toasts.value[0]?.title;

beforeEach(() => {
  graphql.mutate.mockReset();
  toast({ title: "earlier" });
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

async function mountDialog() {
  const onUpdate = vi.fn();
  const wrapper = await mountSuspended(BlockPlayerDialog, {
    props: { player: DANA, open: true, "onUpdate:open": onUpdate },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return { wrapper, onUpdate };
}

function dialog() {
  const element = document.body.querySelector<HTMLElement>(
    '[role="alertdialog"]',
  );
  expect(element).not.toBeNull();
  return element!;
}

function button(label: string) {
  const match = Array.from(dialog().querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  expect(match, `no "${label}" button`).toBeDefined();
  return match!;
}

describe("BlockPlayerDialog", () => {
  it("names the player and spells out what blocking does", async () => {
    await mountDialog();

    const text = dialog().textContent ?? "";
    expect(text).toContain("Block Dana?");
    expect(text).toContain(
      "Dana won't be able to message you, invite you, or send you friend requests.",
    );
    expect(text).toContain(
      "Your friendship will be removed, and unblocking won't restore it.",
    );
    expect(button("Cancel")).toBeDefined();
    expect(button("Block").className).toContain("bg-destructive");
  });

  it("blocks, then closes and confirms once the request lands", async () => {
    let settle!: (value: unknown) => void;
    graphql.mutate.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    const { onUpdate } = await mountDialog();

    button("Block").click();
    await flushPromises();

    expect(graphql.mutate).toHaveBeenCalledWith({
      mutation: BLOCK_PLAYER_MUTATION,
      variables: { steamId: DANA.steam_id },
    });
    expect(onUpdate).not.toHaveBeenCalled();

    settle({
      data: { insert_player_blocks_one: { blocked_steam_id: DANA.steam_id } },
    });
    await flushPromises();

    expect(onUpdate).toHaveBeenCalledWith(false);
    expect(lastToast()).toBe("Dana blocked");
  });

  it("stays open without a success toast when the request is refused", async () => {
    graphql.mutate.mockRejectedValue(new Error("player_blocked"));
    const { onUpdate } = await mountDialog();

    button("Block").click();
    await flushPromises();

    expect(graphql.mutate).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalledWith(false);
    expect(lastToast()).toBe("earlier");
  });

  it("cancels without blocking", async () => {
    const { onUpdate } = await mountDialog();

    button("Cancel").click();
    await flushPromises();

    expect(onUpdate).toHaveBeenCalledWith(false);
    expect(graphql.mutate).not.toHaveBeenCalled();
  });
});
