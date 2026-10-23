import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, watch } from "vue";
import { getActivePinia } from "pinia";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

type Setting = { name: string; value: string };

let feed: { next: (result: { data: { settings: Setting[] } }) => void };

// A disposed setup store is rebuilt from the state pinia kept for it.
function dropStore() {
  const store = useApplicationSettingsStore();
  store.$dispose();
  delete getActivePinia()!.state.value[store.$id];
}

function freshStore() {
  const client = useApollo().clients!.default;
  vi.spyOn(client, "subscribe").mockImplementation(
    (options: any) =>
      ({
        subscribe(observer: any) {
          const [field] = options.query.definitions[0].selectionSet.selections;
          if (field.name.value === "settings") {
            feed = observer;
          }
          return { unsubscribe() {}, closed: false };
        },
      }) as any,
  );
  dropStore();
  return useApplicationSettingsStore();
}

const send = (settings: Setting[]) =>
  feed.next({
    data: { settings: settings.map((setting) => ({ ...setting })) },
  });

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  dropStore();
  vi.restoreAllMocks();
});

// A reconnected socket subscribes again, and Hasura answers with the same rows
// as new objects. Every settings page copies the store into its form when the
// store changes, which would throw away an admin's unsaved edits.
describe("ApplicationSettings store resends", () => {
  it("keeps the settings it has when the socket sends the same ones again", async () => {
    const store = freshStore();
    send([
      { name: "public.minimum_role_to_stream", value: "user" },
      { name: "use_playcast", value: "true" },
    ]);
    const delivered = store.settings;
    const changed = vi.fn();
    watch(() => store.settings, changed);

    send([
      { name: "use_playcast", value: "true" },
      { name: "public.minimum_role_to_stream", value: "user" },
    ]);
    await nextTick();

    expect(store.settings).toBe(delivered);
    expect(changed).not.toHaveBeenCalled();
  });

  it("takes a resend that changes, adds or removes a setting", () => {
    const store = freshStore();
    send([{ name: "use_playcast", value: "true" }]);

    send([{ name: "use_playcast", value: "false" }]);
    expect(store.settings).toEqual([{ name: "use_playcast", value: "false" }]);

    send([
      { name: "use_playcast", value: "false" },
      { name: "public.minimum_role_to_stream", value: "user" },
    ]);
    expect(store.settings).toHaveLength(2);

    send([{ name: "public.minimum_role_to_stream", value: "user" }]);
    expect(store.settings).toEqual([
      { name: "public.minimum_role_to_stream", value: "user" },
    ]);
  });

  it("counts as loaded when the first delivery matches what it started with", () => {
    const store = freshStore();
    expect(store.settingsLoaded).toBe(false);

    send([]);

    expect(store.settingsLoaded).toBe(true);
  });
});
