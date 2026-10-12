import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ClipDetailModal from "~/components/clips/ClipDetailModal.vue";

const { observers } = vi.hoisted(() => ({
  observers: {} as Record<
    string,
    { next: (result: any) => void; error: (error: any) => void }
  >,
}));

function clip(id: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    user_steam_id: "9",
    target_steam_id: "1",
    match_map_id: "mm-1",
    title,
    duration_ms: 21000,
    download_url: `https://cf.test/clips/1/${id}.mp4`,
    thumbnail_url: null,
    thumbnail_download_url: null,
    kills_count: 3,
    round: 8,
    views_count: 4,
    visibility: "public",
    created_at: "2026-10-07T10:00:00Z",
    user: { steam_id: "9", name: "rawr", avatar_url: null },
    target: { steam_id: "1", name: "rawr", avatar_url: null },
    match_map: null,
    ...extra,
  };
}

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: async () => ({ data: { player_kills: [], match_clips: [] } }),
    subscribe: ({ query }: any) => ({
      subscribe: (observer: any) => {
        const id = String(query.loc?.source.body ?? "").match(
          /"(c-\d+)"/,
        )?.[1];
        if (id) {
          observers[id] = observer;
        }
        return {
          unsubscribe() {
            if (id && observers[id] === observer) {
              delete observers[id];
            }
          },
        };
      },
    }),
  }),
}));

const auth = reactive({
  me: { steam_id: "9", role: "user" } as any,
  isAdmin: false,
  isRoleAbove: () => false,
});
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

let wrapper: Awaited<ReturnType<typeof mountSuspended>> | null = null;
let mutate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mutate = vi.fn().mockResolvedValue({ data: { updateClip: { success: true } } });
  vi.spyOn(
    (useNuxtApp() as any).$apollo.defaultClient,
    "mutate",
  ).mockImplementation(mutate);
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  Object.keys(observers).forEach((id) => delete observers[id]);
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

async function emit(row: ReturnType<typeof clip>) {
  observers[row.id].next({ data: { match_clips: [row] } });
  await flushPromises();
}

async function openOn(row: ReturnType<typeof clip>) {
  wrapper = await mountSuspended(ClipDetailModal, {
    props: { clipId: row.id },
    attachTo: document.body,
  });
  await flushPromises();
  await emit(row);
}

async function switchTo(id: string) {
  await wrapper!.setProps({ clipId: id });
  await flushPromises();
}

const titleInput = () =>
  document.querySelector<HTMLInputElement>("#clip-modal-title");

async function editTitle(value: string) {
  document
    .querySelector<HTMLButtonElement>('button[aria-label="Edit title"]')!
    .click();
  await flushPromises();
  const input = titleInput()!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
  await flushPromises();
}

describe("ClipDetailModal title editor", () => {
  it("closes when the modal moves to another clip, so Save can't rename it", async () => {
    await openOn(clip("c-1", "First clip"));
    await editTitle("Renamed first clip");

    await switchTo("c-2");
    await emit(clip("c-2", "Second clip"));

    expect(titleInput()).toBeNull();
    expect(document.body.textContent).toContain("Second clip");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("starts from the new clip's own title when opened again", async () => {
    await openOn(clip("c-1", "First clip"));
    await editTitle("Renamed first clip");

    await switchTo("c-2");
    await emit(clip("c-2", "Second clip"));

    document
      .querySelector<HTMLButtonElement>('button[aria-label="Edit title"]')
      ?.click();
    await flushPromises();

    expect(titleInput()?.value).toBe("Second clip");
  });

  it("does not drop the edit when the same clip ticks over", async () => {
    await openOn(clip("c-1", "First clip"));
    await editTitle("Renamed first clip");

    await emit(clip("c-1", "First clip", { views_count: 5 }));

    expect(titleInput()?.value).toBe("Renamed first clip");
  });

  it("does not carry an error from the last clip's save", async () => {
    mutate.mockRejectedValueOnce(new Error("Title is taken"));
    await openOn(clip("c-1", "First clip"));
    await editTitle("Renamed first clip");
    document
      .querySelector<HTMLFormElement>("form")!
      .dispatchEvent(new Event("submit"));
    await flushPromises();

    expect(document.body.textContent).toContain("Title is taken");

    await switchTo("c-2");
    await emit(clip("c-2", "Second clip"));

    expect(document.body.textContent).not.toContain("Title is taken");
  });
});

describe("ClipDetailModal when the next clip fails to load", () => {
  it("shows the clip as not found instead of spinning over the last one", async () => {
    await openOn(clip("c-1", "First clip"));

    await switchTo("c-2");
    observers["c-2"].error(new Error("permission denied"));
    await flushPromises();

    expect(document.body.textContent).toContain("Clip not found");
    expect(document.body.textContent).not.toContain("First clip");
  });

  it("keeps a clip that already loaded on screen when its feed errors later", async () => {
    await openOn(clip("c-1", "First clip"));

    observers["c-1"].error(new Error("socket closed"));
    await flushPromises();

    expect(document.body.textContent).toContain("First clip");
    expect(document.body.textContent).not.toContain("Clip not found");
  });

  it("loads the clip after it normally", async () => {
    await openOn(clip("c-1", "First clip"));

    await switchTo("c-2");
    observers["c-2"].error(new Error("permission denied"));
    await flushPromises();

    await switchTo("c-3");
    await emit(clip("c-3", "Third clip"));

    expect(document.body.textContent).not.toContain("Clip not found");
    expect(document.body.textContent).toContain("Third clip");
  });
});
