import { afterEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ClipDetailModal from "~/components/clips/ClipDetailModal.vue";

const clip = {
  id: "c-1",
  user_steam_id: "1",
  target_steam_id: "1",
  match_map_id: "mm-1",
  title: "rawr — Best Round (3K)",
  duration_ms: 21000,
  download_url: "https://cf.test/clips/1/c-1.mp4",
  thumbnail_url: null,
  thumbnail_download_url: null,
  kills_count: 3,
  round: 8,
  views_count: 4,
  visibility: "public",
  created_at: "2026-10-07T10:00:00Z",
  user: { steam_id: "1", name: "rawr", avatar_url: null },
  target: { steam_id: "1", name: "rawr", avatar_url: null },
  match_map: null,
};

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: async () => ({ data: { player_kills: [] } }),
    subscribe: () => ({
      subscribe: ({ next }: any) => {
        setTimeout(() => next({ data: { match_clips: [clip] } }));
        return { unsubscribe() {} };
      },
    }),
  }),
}));

const auth = reactive({
  me: { steam_id: "9", role: "administrator" } as any,
  isAdmin: true,
  isRoleAbove: () => true,
});
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

const mounted: Array<{ unmount: () => void }> = [];

async function mount(...args: Parameters<typeof mountSuspended>) {
  const wrapper = await mountSuspended(...args);
  mounted.push(wrapper);
  return wrapper;
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = "";
});

async function openShareMenu() {
  await mount(ClipDetailModal, {
    props: { clipId: "c-1" },
    attachTo: document.body,
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  await flushPromises();
  document
    .querySelector("button[aria-haspopup=menu]")!
    .dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
  await flushPromises();
}

const items = () =>
  Array.from(document.querySelectorAll("[role=menuitem]")).map((item) =>
    item.textContent!.replace(/\s+/g, " ").trim(),
  );

describe("ClipDetailModal share menu", () => {
  it("gives admins visibility and delete under the link and download", async () => {
    auth.isAdmin = true;
    await openShareMenu();

    expect(items()).toEqual([
      "Copy link",
      "Download",
      "PublicListed in the highlights feed",
      "Delete clip",
    ]);
    expect(document.body.textContent).toContain("Admins only");
  });

  it("arms delete on the first press instead of deleting", async () => {
    auth.isAdmin = true;
    await openShareMenu();

    const remove = Array.from(
      document.querySelectorAll<HTMLElement>("[role=menuitem]"),
    ).find((item) => item.textContent!.includes("Delete clip"))!;
    remove.click();
    await flushPromises();

    expect(items()).toContain("Click again to delete");
  });

  it("shows everyone else only the link and the download", async () => {
    auth.isAdmin = false;
    await openShareMenu();

    expect(items()).toEqual(["Copy link", "Download"]);
    expect(document.body.textContent).not.toContain("Admins only");
  });

  it("puts kills, length and views on the video, not under the title", async () => {
    auth.isAdmin = false;
    await openShareMenu();

    expect(document.body.textContent).not.toContain("Share clip");
    expect(document.querySelector(".lucide-eye")).not.toBeNull();
  });
});
