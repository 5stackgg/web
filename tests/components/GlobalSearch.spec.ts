import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import {
  mockNuxtImport,
  mountSuspended,
  registerEndpoint,
} from "@nuxt/test-utils/runtime";
import GlobalSearch from "~/components/GlobalSearch.vue";
import { useGlobalSearchOpen } from "~/composables/useGlobalSearchOpen";
import { useAuthStore } from "~/stores/AuthStore";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

mockNuxtImport("navigateTo", () => navigate);
mockNuxtImport("useCurrentLeagueSeason", () => () => ({
  currentSeason: ref(null),
  currentSeasonTo: ref("/league"),
}));

registerEndpoint("/api/players-search", {
  method: "POST",
  handler: () => ({ hits: [] }),
});

let unmount: (() => void) | undefined;

async function mountSearch(role: string) {
  useAuthStore().me = { steam_id: "76561198000000001", role } as any;
  const wrapper = await mountSuspended(GlobalSearch, {
    attachTo: document.body,
  });
  unmount = () => wrapper.unmount();
  return wrapper;
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}) {
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, ...init }),
  );
}

async function type(text: string) {
  const input = document.querySelector<HTMLInputElement>("[role=combobox]")!;
  input.value = text;
  input.dispatchEvent(new Event("input"));
  await nextTick();
  return input;
}

afterEach(() => {
  unmount?.();
  useGlobalSearchOpen().value = false;
  useAuthStore().me = undefined;
  navigate.mockClear();
});

describe("GlobalSearch", () => {
  it("opens on ⌘K and closes on Escape", async () => {
    await mountSearch("user");
    press(window, "k", { metaKey: true });
    await flushPromises();
    const input = document.querySelector("[role=combobox]")!;
    expect(input).not.toBeNull();

    press(input, "Escape");
    await flushPromises();
    expect(useGlobalSearchOpen().value).toBe(false);
  });

  it("walks the results with the arrow keys and opens the highlighted one", async () => {
    await mountSearch("user");
    useGlobalSearchOpen().value = true;
    await flushPromises();

    const input = await type("teams");
    const labels = [...document.querySelectorAll("[role=option]")].map(
      (option) => option.querySelector(".truncate")?.textContent?.trim(),
    );
    expect(labels.slice(0, 2)).toEqual(["Teams", "Create Team"]);

    press(input, "ArrowDown");
    await nextTick();
    expect(input.getAttribute("aria-activedescendant")).toBe(
      "global-search-option-1",
    );
    press(input, "Enter");
    expect(navigate).toHaveBeenCalledWith("/teams/create");
  });

  it("opens an application setting on its page for administrators", async () => {
    await mountSearch("administrator");
    useGlobalSearchOpen().value = true;
    await flushPromises();

    press(await type("veto pick timer"), "Enter");
    expect(navigate).toHaveBeenCalledWith("/settings/application/matchmaking");
    expect(useGlobalSearchOpen().value).toBe(false);
  });
});
