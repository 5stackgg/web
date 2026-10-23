import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { TooltipProvider } from "~/components/ui/tooltip";
import LandingMatchPage from "~/components/landing/LandingMatchPage.vue";

const calls = vi.hoisted(() => [] as string[]);

vi.mock("@vue/apollo-composable", async (importOriginal) => {
  const name = (options: any) =>
    (options?.query ?? options?.mutation)?.definitions?.[0]?.name?.value;
  const record = (kind: string, value: unknown) => (options: any) => {
    calls.push(`${kind} ${name(options)}`);
    return value;
  };
  return {
    ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
    useApolloClient: () => ({
      client: {
        query: record("query", Promise.resolve({ data: {} })),
        mutate: record("mutate", Promise.resolve({ data: {} })),
        watchQuery: record("watchQuery", undefined),
        subscribe: record("subscribe", {
          subscribe: () => ({ unsubscribe() {} }),
        }),
      },
    }),
  };
});

// The welcome page wraps its sections in a TooltipProvider.
const Page = defineComponent({
  render: () => h(TooltipProvider, () => h(LandingMatchPage)),
});

async function settle() {
  for (let i = 0; i < 6; i++) {
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.restoreAllMocks();
});

describe("LandingMatchPage", () => {
  it("opens every tab without asking the api", async () => {
    const client = (useNuxtApp().$apollo as any).defaultClient;
    for (const method of ["query", "mutate", "subscribe", "watchQuery"]) {
      const original = client[method].bind(client);
      vi.spyOn(client, method).mockImplementation((options: any) => {
        calls.push(`$apollo.${method}`);
        return original(options);
      });
    }
    const fetches: string[] = [];
    const fetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation((input: any, init) => {
      fetches.push(String(input?.url ?? input));
      return fetch(input, init);
    });

    const wrapper = await mountSuspended(Page);
    unmount = () => wrapper.unmount();
    await settle();

    const panel = () =>
      wrapper.find('[role="tabpanel"][data-state="active"]').text();
    const button = (label: string) =>
      wrapper.findAll("button").find((entry) => entry.text() === label);

    expect(wrapper.text()).toContain("Kestrel");
    for (const lens of ["Aim", "Trades", "Utility", "Opening Duels", "General"]) {
      await button(lens)?.trigger("click");
      await settle();
      expect(panel()).toContain("kuro");
    }

    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text())).toEqual([
      "Scoreboard",
      "Economy",
      "Clutches",
      "Head to Head",
      "Roles",
      "Utility",
    ]);
    // Each tab is its own chunk, so under load it can land after a fixed wait.
    const expected: Record<string, string | RegExp> = {
      Clutches: "Ironside",
      "Head to Head": "Saffron",
      Roles: /Sniper|Entry|Support/i,
    };
    for (const tab of tabs) {
      await tab.trigger("mousedown", { button: 0 });
      await settle();
      const want = expected[tab.text()];
      if (want) {
        await vi.waitFor(() => expect(panel()).toMatch(want), { timeout: 8000 });
      }
    }

    const show = await vi.waitFor(
      () => {
        const found = wrapper
          .findAll("button")
          .find((entry) => entry.text().includes("Show"));
        expect(found).toBeTruthy();
        return found!;
      },
      { timeout: 8000 },
    );
    await show.trigger("click");
    await settle();
    await vi.waitFor(() => expect(panel()).toMatch(/Smoke|Flash/), {
      timeout: 8000,
    });

    expect(calls).toEqual([]);
    expect(fetches.filter((url) => !url.includes("/_nuxt/"))).toEqual([]);
  });
});
