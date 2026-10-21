import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { useRouter } from "#app";
import UtilityMapPage from "~/pages/utility/[map].vue";
import metadata from "~/public/radars/metadata.json";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";

vi.mock("~/graphql/getGraphqlClient", () => ({
  default: () => ({
    query: vi.fn(async () => ({
      data: {
        utility_lineups: [],
        utility_lineups_aggregate: { aggregate: { count: 0 } },
      },
    })),
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

const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 60));
  await flushPromises();
};

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;
let wrapper: Wrapper | undefined;

function signIn(role: string, createMatchesRole: string) {
  useApplicationSettingsStore().settings = [
    { name: "public.create_matches_role", value: createMatchesRole },
  ];
  const auth = useAuthStore();
  auth.me = { steam_id: "76561198000000001", role, teams: [] } as any;
  auth.hasCheckedSession = true;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(metadata))),
  );
});

afterEach(async () => {
  wrapper?.unmount();
  wrapper = undefined;
  useAuthStore().me = undefined;
  useApplicationSettingsStore().settings = [];
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  await useRouter().replace("/");
});

async function openDiscover() {
  wrapper = await mountSuspended(UtilityMapPage, {
    route: "/utility/de_mirage?tab=discover",
    attachTo: document.body,
    global: {
      stubs: {
        UtilityLineupViewer3D: true,
        ClipPlayer: true,
        UtilityDiscoverPanel: true,
      },
    },
  });
  await settle();
  return wrapper;
}

const discoverTab = () =>
  Array.from(document.querySelectorAll("button")).find(
    (button) => button.textContent?.trim() === "Discover",
  );

describe("the lineup Discover panel and the create matches role", () => {
  it("is not offered to a player below the role the api asks for", async () => {
    signIn("user", "verified_user");

    const page = await openDiscover();

    expect(page.findComponent({ name: "UtilityDiscoverPanel" }).exists()).toBe(
      false,
    );
    expect(discoverTab()).toBeUndefined();
    expect(useRouter().currentRoute.value.query.tab).toBeUndefined();
  });

  it("is unchanged for a player at the role", async () => {
    signIn("verified_user", "verified_user");

    const page = await openDiscover();

    expect(page.findComponent({ name: "UtilityDiscoverPanel" }).exists()).toBe(
      true,
    );
    expect(discoverTab()).toBeDefined();
    expect(useRouter().currentRoute.value.query.tab).toBe("discover");
  });

  it("is unchanged for a player above the role", async () => {
    signIn("administrator", "match_organizer");

    const page = await openDiscover();

    expect(page.findComponent({ name: "UtilityDiscoverPanel" }).exists()).toBe(
      true,
    );
    expect(discoverTab()).toBeDefined();
  });
});
