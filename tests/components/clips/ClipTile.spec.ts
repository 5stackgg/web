import { beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import ClipTile from "~/components/clips/ClipTile.vue";
import type { Clip } from "~/types/clip";

const { playClips } = vi.hoisted(() => ({ playClips: vi.fn() }));
vi.mock("~/composables/useClipModal", () => ({
  useClipModal: () => ({ playClips }),
}));

const auth = reactive({
  me: undefined as { steam_id: string } | undefined,
  isAdmin: false,
});
vi.mock("~/stores/AuthStore", () => ({ useAuthStore: () => auth }));

function makeClip(id: string, overrides: Partial<Clip> = {}): Clip {
  return {
    id,
    user_steam_id: "owner-1",
    target_steam_id: "p-1",
    title: "k1tty — Ace to close out Mirage",
    duration_ms: 24000,
    download_url: null,
    thumbnail_url: null,
    thumbnail_download_url: null,
    kills_count: 5,
    round: 22,
    views_count: 612,
    visibility: "public",
    created_at: "2026-10-02T18:00:00Z",
    user: { steam_id: "owner-1", name: "mxl0", avatar_url: null },
    target: { steam_id: "p-1", name: "k1tty", avatar_url: null },
    match_map: {
      id: "mm-1",
      lineup_1_score: 13,
      lineup_2_score: 9,
      winning_lineup_id: "l-1",
      map: { name: "de_mirage", poster: null, label: "Mirage" },
      match: {
        id: "m-1",
        status: "Finished",
        started_at: null,
        ended_at: null,
        winning_lineup_id: "l-1",
        is_tournament_match: true,
        lineup_1_id: "l-1",
        lineup_2_id: "l-2",
        lineup_1: { id: "l-1", name: "Buttah Boyz" },
        lineup_2: { id: "l-2", name: "Eco Warriors" },
        tournament_brackets: [
          { stage: { tournament: { id: "t-1", name: "Fall Cup 2026" } } },
        ],
        event_links: [{ event: { id: "e-1", name: "Northside LAN" } }],
      },
    },
    ...overrides,
  } as Clip;
}

const visibilityTrigger = (
  wrapper: Awaited<ReturnType<typeof mountSuspended>>,
) => wrapper.find("button[aria-label^='Visibility']");

beforeEach(() => {
  playClips.mockReset();
  auth.me = undefined;
  auth.isAdmin = false;
});

describe("ClipTile", () => {
  it("leads with the play: stripped title, player and kill badge", async () => {
    const wrapper = await mountSuspended(ClipTile, {
      props: { clip: makeClip("c-1") },
    });
    const text = wrapper.text();
    expect(text).toContain("Ace to close out Mirage");
    expect(text).not.toContain("k1tty — ");
    expect(text).toContain("k1tty");
    expect(text).toContain("Ace");
    expect(text).toContain("0:24");
    expect(text).toContain("Round 22 · Mirage · Northside LAN · Fall Cup 2026");
    expect(text).toContain("13–9");
  });

  it("plays the list it was picked from on a plain click", async () => {
    const queue = [makeClip("c-1"), makeClip("c-2")];
    const wrapper = await mountSuspended(ClipTile, {
      props: { clip: queue[1], queue, queueScope: "test-scope" },
    });
    const link = wrapper.find("a[href='/clips/c-2']");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(playClips).toHaveBeenCalledWith(queue, "c-2", "test-scope");
  });

  it("lets modifier clicks follow the link", async () => {
    const wrapper = await mountSuspended(ClipTile, {
      props: { clip: makeClip("c-1") },
    });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });
    wrapper.find("a[href='/clips/c-1']").element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(playClips).not.toHaveBeenCalled();
  });

  it("plays the whole group from a stacked tile", async () => {
    const group = [makeClip("c-1"), makeClip("c-2"), makeClip("c-3")];
    const wrapper = await mountSuspended(ClipTile, {
      props: { clip: group[0], group },
    });
    expect(wrapper.text()).toContain("3 plays");
    wrapper
      .find("a[href='/clips/c-1']")
      .element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    expect(playClips).toHaveBeenCalledWith(group, "c-1", null);
  });

  it("shows the visibility control to the owner and admins only", async () => {
    const clip = makeClip("c-1");

    const stranger = await mountSuspended(ClipTile, { props: { clip } });
    expect(visibilityTrigger(stranger).exists()).toBe(false);

    auth.me = { steam_id: "owner-1" };
    const owner = await mountSuspended(ClipTile, { props: { clip } });
    expect(visibilityTrigger(owner).exists()).toBe(true);

    auth.me = { steam_id: "someone-else" };
    auth.isAdmin = true;
    const admin = await mountSuspended(ClipTile, { props: { clip } });
    expect(visibilityTrigger(admin).exists()).toBe(true);
  });

  it("handles match-only clips without crashing", async () => {
    auth.me = { steam_id: "owner-1" };
    const wrapper = await mountSuspended(ClipTile, {
      props: { clip: makeClip("c-1", { visibility: "match" }) },
    });
    expect(visibilityTrigger(wrapper).attributes("aria-label")).toContain(
      "Match only",
    );
  });
});
