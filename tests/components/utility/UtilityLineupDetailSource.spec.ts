import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import UtilityLineupDetail from "~/components/utility/UtilityLineupDetail.vue";
import metadata from "~/public/radars/metadata.json";
import type { UtilityLineup } from "~/types/utility";

const base = {
  id: "l-1",
  name: "Window smoke",
  map_name: "de_mirage",
  utility_type: "Smoke",
  side: "TERRORIST",
  technique: "WalkJump",
  throw_strength: "Full",
  origin_x: -1200,
  origin_y: -1300,
  origin_z: -160,
  land_x: -800,
  land_y: -600,
  land_z: -160,
  tags: [],
  progress: [],
  visibility: "Private",
  upvotes: 0,
  author_steam_id: "9",
  author: { steam_id: "9", name: "rawr", avatar_url: null },
} as unknown as UtilityLineup;

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn(async () => ({ data: {} })),
    mutate: vi.fn(async () => ({ data: {} })),
    subscribe: () => ({
      subscribe: () => ({ unsubscribe() {} }),
    }),
  }),
}));

vi.mock("~/components/ui/sidebar/utils", async (original) => {
  const { ref } = await import("vue");
  return {
    ...(await original<Record<string, unknown>>()),
    useSidebar: () => ({ isMobile: ref(false) }),
  };
});

vi.mock("~/stores/AuthStore", () => ({
  useAuthStore: () => ({ me: { steam_id: "9" }, isRoleAbove: () => false }),
}));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadata))),
  );
});

afterEach(() => {
  document.body.innerHTML = "";
});

async function technicalDetails(originSource: string) {
  const row = { ...base, origin_source: originSource } as UtilityLineup;
  const wrapper = await mountSuspended(UtilityLineupDetail, {
    attachTo: document.body,
    props: {
      lineups: [row],
      lineupId: row.id,
      open: true,
      canReact: true,
      canPractice: false,
    },
  });
  await flushPromises();
  const toggle = wrapper
    .findAll("button[aria-expanded]")
    .find((button) => button.text().includes("Technical details"));
  await toggle!.trigger("click");
  await flushPromises();
  return wrapper.find("dl").text();
}

describe("UtilityLineupDetail source", () => {
  it.each([
    ["discovery", "Discover"],
    ["fork", "Fork"],
  ])(
    "names a %s lineup's source instead of printing its key",
    async (source, label) => {
      const details = await technicalDetails(source);

      expect(details).toContain(label);
      expect(details).not.toContain("origin_sources");
    },
  );
});
