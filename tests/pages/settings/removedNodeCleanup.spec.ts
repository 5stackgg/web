import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import type { DocumentNode, FieldNode, OperationDefinitionNode } from "graphql";
import ServerSettings from "~/pages/settings/application/servers.vue";

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@/components/ui/toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/toast")>()),
  toast,
}));

type CleanupResult = {
  nodes: number;
  jobs: number;
  volume_claims: number;
  volumes: number;
  failed: number;
  node_delete_forbidden: boolean;
  recently_ready: number;
};

const NOTHING: CleanupResult = {
  nodes: 0,
  jobs: 0,
  volume_claims: 0,
  volumes: 0,
  failed: 0,
  node_delete_forbidden: false,
  recently_ready: 0,
};

const FORBIDDEN_NOTE =
  "Node entries, with their volume claims and volume records, were kept because the API has no permission to delete Kubernetes nodes. Pull and run the panel's update script (git pull && ./update.sh), then run this again.";

const recentlyReadyNote = (count: number) =>
  `Removed nodes skipped because Kubernetes reported them as Ready in the last 10 minutes: ${count}. Run this again once Kubernetes has reported them as not ready for 10 minutes.`;

let mutate: ReturnType<typeof vi.fn>;
let unmount: (() => void) | undefined;

afterEach(async () => {
  unmount?.();
  unmount = undefined;
  toast.mockReset();
  vi.restoreAllMocks();
  await flushPromises();
});

const answer = (result: Partial<CleanupResult>) => async () => ({
  data: { cleanupRemovedNodes: { ...NOTHING, ...result } },
});

async function mountPage(respond: () => Promise<unknown> = answer({})) {
  const client = (useNuxtApp() as any).$apollo.defaultClient;
  mutate = vi.fn(respond);
  vi.spyOn(client, "mutate").mockImplementation(mutate);

  const wrapper = await mountSuspended(ServerSettings, {
    attachTo: document.body,
    global: {
      mixins: (useNuxtApp().vueApp as any)._context.mixins,
    },
  });
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountPage>>;

const cleanupButton = (wrapper: Wrapper) =>
  wrapper.find<HTMLButtonElement>("#danger-zone button");

const dialog = () =>
  document.body.querySelector<HTMLElement>('[role="alertdialog"]');

function dialogButton(label: string) {
  const buttons = dialog()?.querySelectorAll<HTMLButtonElement>("button");
  return Array.from(buttons ?? []).find(
    (button) => button.textContent?.trim() === label,
  );
}

async function openDialog(wrapper: Wrapper) {
  await cleanupButton(wrapper).trigger("click");
  await flushPromises();
}

async function confirmCleanup(wrapper: Wrapper) {
  await openDialog(wrapper);
  const confirm = dialogButton("Clean Up");
  expect(confirm, "confirm button").toBeDefined();
  confirm!.click();
  await flushPromises();
}

async function runCleanup(result: Partial<CleanupResult>) {
  const wrapper = await mountPage(answer(result));
  await confirmCleanup(wrapper);
  expect(toast).toHaveBeenCalledTimes(1);
  return toast.mock.calls[0][0];
}

describe("server settings removed node cleanup", () => {
  it("asks first and never submits the settings form", async () => {
    const wrapper = await mountPage();
    const button = cleanupButton(wrapper);

    expect(button.attributes("type")).toBe("button");
    expect(button.text()).toBe("Clean Up");
    expect(button.element.closest("form")).toBeNull();

    await openDialog(wrapper);

    expect(dialog()?.textContent).toContain("Clean up removed nodes?");
    expect(mutate).not.toHaveBeenCalled();

    dialogButton("Cancel")!.click();
    await flushPromises();

    expect(dialog()).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it("sends only the cleanup mutation, with the agreed fields", async () => {
    const wrapper = await mountPage();

    await confirmCleanup(wrapper);

    expect(mutate).toHaveBeenCalledTimes(1);
    const sent = mutate.mock.calls[0][0].mutation as DocumentNode;
    expect(sent.definitions).toHaveLength(1);

    const operation = sent.definitions[0] as OperationDefinitionNode;
    expect(operation.operation).toBe("mutation");
    expect(operation.name?.value).toBe("CleanupRemovedNodes");
    expect(operation.selectionSet.selections).toHaveLength(1);

    const field = operation.selectionSet.selections[0] as FieldNode;
    expect(field.name.value).toBe("cleanupRemovedNodes");
    expect(
      field.selectionSet?.selections.map(
        (selection) => (selection as FieldNode).name.value,
      ),
    ).toEqual([
      "nodes",
      "jobs",
      "volume_claims",
      "volumes",
      "failed",
      "node_delete_forbidden",
      "recently_ready",
    ]);
    expect(dialog()).toBeNull();
  });

  it("says so when there was nothing to clean up", async () => {
    expect(await runCleanup({})).toEqual({
      title: "Nothing to clean up",
      description: "",
      variant: "default",
    });
  });

  it("lists what it removed", async () => {
    expect(
      await runCleanup({ nodes: 2, jobs: 5, volume_claims: 3, volumes: 4 }),
    ).toEqual({
      title: "Cleanup finished",
      description:
        "Node entries: 2, volume records: 4, volume claims: 3, jobs: 5.",
      variant: "default",
    });
  });

  it("explains node entries it had no permission to delete", async () => {
    expect(
      await runCleanup({
        jobs: 2,
        volume_claims: 1,
        volumes: 1,
        node_delete_forbidden: true,
      }),
    ).toEqual({
      title: "Cleanup finished",
      description: `Node entries: 0, volume records: 1, volume claims: 1, jobs: 2.\n${FORBIDDEN_NOTE}`,
      variant: "default",
    });
  });

  it("does not report nothing to clean up when node deletes were refused", async () => {
    expect(await runCleanup({ node_delete_forbidden: true })).toEqual({
      title: "Cleanup finished",
      description: FORBIDDEN_NOTE,
      variant: "default",
    });
  });

  it("flags objects it could not remove", async () => {
    expect(await runCleanup({ nodes: 1, failed: 2 })).toEqual({
      title: "Cleanup finished with errors",
      description:
        "Node entries: 1, volume records: 0, volume claims: 0, jobs: 0.\nObjects that could not be removed: 2. Check the API logs.",
      variant: "destructive",
    });
  });

  it("flags failures even when nothing was removed", async () => {
    expect(
      await runCleanup({ failed: 3, node_delete_forbidden: true }),
    ).toEqual({
      title: "Cleanup finished with errors",
      description: `${FORBIDDEN_NOTE}\nObjects that could not be removed: 3. Check the API logs.`,
      variant: "destructive",
    });
  });

  it("does not report nothing to clean up when removed nodes were skipped for being Ready too recently", async () => {
    expect(await runCleanup({ recently_ready: 2 })).toEqual({
      title: "Cleanup finished",
      description: recentlyReadyNote(2),
      variant: "default",
    });
  });

  it("lists what it removed next to the nodes that were Ready too recently", async () => {
    expect(
      await runCleanup({ nodes: 1, volumes: 2, recently_ready: 1 }),
    ).toEqual({
      title: "Cleanup finished",
      description: `Node entries: 1, volume records: 2, volume claims: 0, jobs: 0.\n${recentlyReadyNote(1)}`,
      variant: "default",
    });
  });

  it("keeps the error title when nodes were Ready too recently and deletes failed", async () => {
    expect(await runCleanup({ failed: 1, recently_ready: 1 })).toEqual({
      title: "Cleanup finished with errors",
      description: `${recentlyReadyNote(1)}\nObjects that could not be removed: 1. Check the API logs.`,
      variant: "destructive",
    });
  });

  it("reports a request that failed", async () => {
    const wrapper = await mountPage(async () => {
      throw new Error("cleanupRemovedNodes: not found");
    });

    await confirmCleanup(wrapper);

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({
      title: "Cleanup failed",
      description: "cleanupRemovedNodes: not found",
      variant: "destructive",
    });
    expect(cleanupButton(wrapper).attributes("disabled")).toBeUndefined();
  });

  it("shows that it is running until the answer arrives", async () => {
    let finish!: (value: unknown) => void;
    const wrapper = await mountPage(
      () => new Promise((resolve) => (finish = resolve)),
    );

    await confirmCleanup(wrapper);

    let button = cleanupButton(wrapper);
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.find('[role="status"]').exists()).toBe(true);
    expect(button.text()).toBe("Cleaning up...");
    expect(toast).not.toHaveBeenCalled();

    finish({ data: { cleanupRemovedNodes: NOTHING } });
    await flushPromises();

    button = cleanupButton(wrapper);
    expect(button.attributes("disabled")).toBeUndefined();
    expect(button.find('[role="status"]').exists()).toBe(false);
    expect(button.text()).toBe("Clean Up");
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
