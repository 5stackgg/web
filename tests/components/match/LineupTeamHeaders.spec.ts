import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { defineComponent, h, type Component } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import LineupOverview from "~/components/match/LineupOverview.vue";
import LineupAimStats from "~/components/match/LineupAimStats.vue";
import LineupOpeningDuels from "~/components/match/LineupOpeningDuels.vue";
import LineupTradeStats from "~/components/match/LineupTradeStats.vue";
import { TooltipProvider } from "~/components/ui/tooltip";
import { e_match_status_enum } from "~/generated/zeus";

vi.mock("@vue/apollo-composable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vue/apollo-composable")>()),
  useApolloClient: () => ({
    client: {
      subscribe: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
    },
  }),
}));

const loadConfig = createRequire(import.meta.url)("tailwindcss/loadConfig");
const tailwindConfig = loadConfig(
  resolve(process.cwd(), "tailwind.config.js"),
);

const row = defineComponent({
  render: () => h("tr", [h("td", "player")]),
});

const stubs = {
  LineupOverviewRow: row,
  LineupOpeningDuelRow: row,
  LineupMember: true,
};

const player = (steamId: string) => ({
  steam_id: steamId,
  player: { steam_id: steamId, name: `Player ${steamId}` },
});

const lineup = (id: string, name: string, steamIds: string[]) => ({
  id,
  name,
  is_ready: true,
  lineup_players: steamIds.map(player),
});

const lineup1 = lineup("lineup-1", "Northwind", ["1", "2"]);
const lineup2 = lineup("lineup-2", "Iron Lotus", ["3", "4"]);

const match = {
  id: "match-1",
  status: e_match_status_enum.Finished,
  min_players_per_lineup: 2,
  max_players_per_lineup: 2,
  lineup_1: lineup1,
  lineup_2: lineup2,
  match_maps: [],
};

const tabs: Array<[string, Component]> = [
  ["Overview", LineupOverview],
  ["Aim", LineupAimStats],
  ["Opening Duels", LineupOpeningDuels],
  ["Trades", LineupTradeStats],
];

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  document.head.querySelector("style[data-lineup-tables]")?.remove();
  vi.restoreAllMocks();
});

// Built from the classes the table rendered, so the real cascade decides each
// border, the table body's own last-row border-0 included. Read off the
// elements: serialised HTML escapes the `&` in every arbitrary variant, and
// Tailwind would build rules for names nothing carries.
async function applyTailwind(root: Element) {
  const classes = [root, ...root.querySelectorAll("[class]")].map(
    (element) => element.getAttribute("class") ?? "",
  );
  const { css } = await postcss([
    tailwindcss({
      ...tailwindConfig,
      content: [{ raw: classes.join(" "), extension: "html" }],
    }),
  ]).process("@tailwind base;\n@tailwind utilities;", { from: undefined });
  const style = document.createElement("style");
  style.dataset.lineupTables = "";
  style.textContent = css;
  document.head.appendChild(style);
}

async function mountTable(
  component: Component,
  props: Record<string, unknown>,
) {
  const wrapper = await mountSuspended(
    defineComponent({
      render: () =>
        h(TooltipProvider, null, () =>
          h(component, { match, lineup: lineup1, ...props }),
        ),
    }),
    { global: { stubs }, attachTo: document.body },
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
  const table = wrapper.find("table").element as HTMLTableElement;
  await applyTailwind(table);
  return table;
}

function sections(table: HTMLTableElement, tag: "THEAD" | "TBODY") {
  return [...table.children].filter((child) => child.tagName === tag);
}

function lastRowBorder(body: Element) {
  const rows = body.querySelectorAll(":scope > tr");
  return getComputedStyle(rows[rows.length - 1]).borderBottomWidth;
}

describe.each(tabs)("%s tab with both teams", (_name, component) => {
  it("gives the second team's header row exactly the first team's", async () => {
    const table = await mountTable(component, { combineWith: lineup2 });
    const [first, second] = sections(table, "THEAD");

    expect(second.className).toBe(first.className);

    const firstHead = getComputedStyle(first.querySelector("th")!);
    const secondHead = getComputedStyle(second.querySelector("th")!);
    expect(secondHead.paddingTop).toBe(firstHead.paddingTop);
    expect(getComputedStyle(second).borderTopWidth).toBe(
      getComputedStyle(first).borderTopWidth,
    );
  });

  it("draws the 3px line under the first team's last player only", async () => {
    const table = await mountTable(component, { combineWith: lineup2 });
    const [first, second] = sections(table, "TBODY");

    expect(lastRowBorder(first)).toBe("3px");
    expect(lastRowBorder(second)).toBe("0px");
  });

  // A pinned cell paints above the table's collapsed row borders, so its
  // background has to stop short of them or it hides the line.
  it("keeps the row lines in the pinned player column", async () => {
    const table = await mountTable(component, { combineWith: lineup2 });

    for (const pinned of table.querySelectorAll(".sticky")) {
      expect(getComputedStyle(pinned).backgroundClip).toBe("padding-box");
    }
  });
});

describe("a one-team table", () => {
  it("has no separating line", async () => {
    const table = await mountTable(LineupOverview, {});
    const [only] = sections(table, "TBODY");

    expect(sections(table, "THEAD")).toHaveLength(1);
    expect(lastRowBorder(only)).toBe("0px");
  });
});

describe("Overview headings on a touch screen", () => {
  function touchScreen() {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: query.includes("hover: none"),
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
  }

  it("puts the info icon after the label, so the label starts over its numbers", async () => {
    touchScreen();
    const table = await mountTable(LineupOverview, { combineWith: lineup2 });
    const infos = [
      ...table.querySelectorAll("th:not(.sticky) button"),
    ].filter((button) => button.querySelector("svg.lucide-info"));

    expect(infos.length).toBeGreaterThan(0);
    for (const info of infos) {
      let box = info.parentElement!;
      while (getComputedStyle(box).display === "contents") {
        box = box.parentElement!;
      }
      expect(getComputedStyle(box).display).toBe("inline-flex");
      expect(getComputedStyle(info).order).toBe("9999");
    }
  });
});
