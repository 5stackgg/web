import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { TriangleAlert } from "lucide-vue-next";
import SanctionPlayer from "~/components/SanctionPlayer.vue";

const PLAYER = "76561198000000001";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | null = null;

afterEach(() => {
  unmount?.();
  unmount = null;
  vi.restoreAllMocks();
});

async function openDrawer(
  type: string,
  serverId?: string,
  result: { enforced: boolean; message: string } = {
    enforced: false,
    message: "warning saved",
  },
) {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  mutate = vi.fn().mockResolvedValue({
    data: {
      sanctionServerPlayer: {
        id: "sanction-1",
        ...result,
      },
    },
  });
  vi.spyOn(client, "mutate").mockImplementation(mutate);

  const wrapper = await mountSuspended(SanctionPlayer, {
    props: {
      player: { steam_id: PLAYER, name: "Player" },
      serverId,
      variant: "block",
    },
    attachTo: document.body,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
      stubs: { PlayerDisplay: true },
    },
  });
  unmount = () => wrapper.unmount();

  const vm = wrapper.vm as any;
  vm.sanctionType = type;
  vm.sanctioningPlayer = true;
  await flushPromises();
  return wrapper;
}

function drawerForm(): HTMLFormElement {
  const form = document.body.querySelector<HTMLFormElement>("form");
  expect(form, "sanction form").not.toBeNull();
  return form!;
}

async function submit(wrapper: Awaited<ReturnType<typeof openDrawer>>) {
  const run = vi.spyOn(wrapper.vm as any, "sanctionPlayer");
  drawerForm().dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
  expect(run).toHaveBeenCalledTimes(1);
  await run.mock.results[0].value;
  await flushPromises();
}

async function typeReason(value: string) {
  const input = drawerForm().querySelector<HTMLInputElement>("input")!;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await flushPromises();
}

describe("SanctionPlayer warnings", () => {
  it("offers a warning with the alert icon", async () => {
    const wrapper = await openDrawer("warning");

    expect((wrapper.vm as any).sanctions.warning).toEqual({
      icon: TriangleAlert,
      description: "Informational note on the player's record, never enforced",
    });
  });

  it("hides the duration and the server note, and explains the warning", async () => {
    await openDrawer("warning", "server-1");

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("Duration");
    expect(text).toContain(
      "A warning is saved to the player's record and notifies them. It is never enforced and never expires.",
    );
    expect(text).not.toContain("Live mute/gag enforcement");
    expect(drawerForm().textContent).toContain("Issue Warning");
  });

  it("keeps the duration for an enforced sanction", async () => {
    await openDrawer("ban");

    const text = document.body.textContent ?? "";
    expect(text).toContain("Duration");
    expect(text).not.toContain("A warning is saved to the player's record");
  });

  it("requires a reason before issuing a warning", async () => {
    const wrapper = await openDrawer("warning");

    await typeReason("   ");
    await submit(wrapper);

    expect(mutate).not.toHaveBeenCalled();
    expect(drawerForm().textContent).toContain("A reason is required");
  });

  it("does not demand a reason for an enforced sanction", async () => {
    const wrapper = await openDrawer("ban");

    await submit(wrapper);

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(drawerForm().textContent).not.toContain("A reason is required");
  });

  it("does not flag a blank reason on an enforced sanction", async () => {
    const wrapper = await openDrawer("ban");

    const { errors } = await (wrapper.vm as any).form.validate();

    expect(errors.reason).toBeUndefined();
  });

  it("issues a warning", async () => {
    const wrapper = await openDrawer("warning");

    await typeReason("Griefing");
    await submit(wrapper);

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].variables).toMatchObject({
      type: "warning",
      reason: "Griefing",
      duration: 0,
    });
  });

  it("drops a duration picked before switching to a warning", async () => {
    const wrapper = await openDrawer("warning", "server-1");
    (wrapper.vm as any).form.setFieldValue("duration", "900000");

    await typeReason("Toxic comms");
    await submit(wrapper);

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0].variables).toEqual({
      serverId: "server-1",
      steam_id: PLAYER,
      type: "warning",
      reason: "Toxic comms",
      duration: 0,
    });
  });
});

describe("SanctionPlayer on a server", () => {
  afterEach(() => {
    toast.mockReset();
  });

  it("tells the moderator why the server could not enforce it live", async () => {
    const wrapper = await openDrawer("mute", "server-1", {
      enforced: false,
      message:
        "sanction saved; the Player Management plugin is not installed on this server",
    });

    await submit(wrapper);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description:
          "sanction saved; the Player Management plugin is not installed on this server",
      }),
    );
  });

  it("keeps the toast plain once the server has applied it", async () => {
    const wrapper = await openDrawer("gag", "server-1", {
      enforced: true,
      message: "sanction saved and synced to server",
    });

    await submit(wrapper);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: undefined }),
    );
  });

  it("adds nothing when the sanction was not aimed at a server", async () => {
    const wrapper = await openDrawer("mute", undefined, {
      enforced: false,
      message: "sanction saved",
    });

    await submit(wrapper);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: undefined }),
    );
  });

  it("never repeats a warning's save message, which no server enforces", async () => {
    const wrapper = await openDrawer("warning", "server-1");

    await typeReason("Griefing");
    await submit(wrapper);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: undefined }),
    );
  });
});
