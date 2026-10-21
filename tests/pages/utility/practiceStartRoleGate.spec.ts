import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
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

const practiceSession = ref<Record<string, unknown> | null>(null);
vi.mock("~/composables/useUtilityPracticeSession", () => ({
  useUtilityPracticeSession: () => ({
    session: computed(() => practiceSession.value),
    booting: computed(() => false),
    mapName: computed(() => practiceSession.value?.map_name ?? null),
    switching: computed(() => false),
    canManage: computed(() => practiceSession.value?.can_manage === true),
  }),
}));

const settle = async () => {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 60));
  await flushPromises();
};

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>;
let wrapper: Wrapper | undefined;

function loadSettings(createMatchesRole: string) {
  const settings = useApplicationSettingsStore();
  settings.settings = [
    { name: "public.create_matches_role", value: createMatchesRole },
  ];
  settings.settingsLoaded = true;
}

function signIn(role: string, createMatchesRole: string | null) {
  if (createMatchesRole) {
    loadSettings(createMatchesRole);
  }
  const auth = useAuthStore();
  auth.me = { steam_id: "76561198000000001", role, teams: [] } as any;
  auth.hasCheckedSession = true;
}

function joinedSession() {
  return {
    id: "s-1",
    status: "Ready",
    map_name: "de_mirage",
    map_changing_at: null,
    can_manage: false,
    host: { name: "rawr" },
  };
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
  practiceSession.value = null;
  useAuthStore().me = undefined;
  useApplicationSettingsStore().settings = [];
  useApplicationSettingsStore().settingsLoaded = false;
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  await useRouter().replace("/");
});

async function openMap(route = "/utility/de_mirage") {
  wrapper = await mountSuspended(UtilityMapPage, {
    route,
    attachTo: document.body,
    global: {
      stubs: {
        UtilityLineupViewer3D: true,
        ClipPlayer: true,
        UtilityPracticePanel: true,
      },
    },
  });
  await settle();
  return wrapper;
}

const bar = (page: Wrapper) =>
  page.findComponent({ name: "UtilityPracticeBar" });

const drawerOpen = () =>
  !!document.querySelector("[data-utility-practice-open]");

const panel = (page: Wrapper) =>
  page.findComponent({ name: "UtilityPracticePanel" });

describe("the practice server bar and the create matches role", () => {
  it("is no launcher for a player below the role the api asks for", async () => {
    signIn("user", "verified_user");

    const page = await openMap();

    expect(bar(page).exists()).toBe(false);
  });

  it("is unchanged for a player at the role", async () => {
    signIn("verified_user", "verified_user");

    const page = await openMap();

    expect(bar(page).exists()).toBe(true);
    expect(bar(page).props("server")).toBe(true);
  });

  it("shows a player below the role the server somebody let them on", async () => {
    signIn("user", "verified_user");
    practiceSession.value = joinedSession();

    const page = await openMap();

    expect(bar(page).exists()).toBe(true);
    expect(bar(page).props("server")).toBe(true);
  });

  it("still opens the server panel for a player below the role following an invite", async () => {
    signIn("user", "verified_user");

    const page = await openMap("/utility/de_mirage?practice=abc123");

    expect(drawerOpen()).toBe(true);
    expect(
      page.findComponent({ name: "UtilityPracticePanel" }).props(
        "joinInviteCode",
      ),
    ).toBe("abc123");
  });

  it("puts the server panel away when a server they joined is gone", async () => {
    signIn("user", "verified_user");
    practiceSession.value = joinedSession();

    const page = await openMap();
    await bar(page).vm.$emit("toggle");
    await settle();

    expect(drawerOpen()).toBe(true);

    practiceSession.value = null;
    await settle();

    expect(drawerOpen()).toBe(false);
    expect(bar(page).exists()).toBe(false);
  });

  it("offers no way to practise a lineup or a spot to a player who cannot have a server", async () => {
    signIn("user", "verified_user");

    const page = await openMap();

    expect(
      page.findComponent({ name: "UtilityLineupDetail" }).props("canPractice"),
    ).toBe(false);
    expect(
      page.findComponent({ name: "UtilityMetaSpotView" }).props("canPractice"),
    ).toBe(false);
  });

  it("still offers them to a player at the role, and to one on a server somebody let them on", async () => {
    signIn("verified_user", "verified_user");
    const page = await openMap();

    expect(
      page.findComponent({ name: "UtilityLineupDetail" }).props("canPractice"),
    ).toBe(true);

    loadSettings("match_organizer");
    practiceSession.value = joinedSession();
    await settle();

    expect(
      page.findComponent({ name: "UtilityLineupDetail" }).props("canPractice"),
    ).toBe(true);
    expect(
      page.findComponent({ name: "UtilityMetaSpotView" }).props("canPractice"),
    ).toBe(true);
  });

  it("puts the server panel away when an invite could not be joined", async () => {
    signIn("user", "verified_user");

    const page = await openMap("/utility/de_mirage?practice=stale");
    expect(drawerOpen()).toBe(true);

    panel(page).vm.$emit("dismiss");
    await settle();

    expect(drawerOpen()).toBe(false);
  });

  it("is no launcher before the settings have said who may start one", async () => {
    signIn("user", null);

    const page = await openMap();

    expect(bar(page).exists()).toBe(false);
  });

  it("keeps an invite's server panel open while the settings arrive mid-join", async () => {
    signIn("user", null);

    await openMap("/utility/de_mirage?practice=abc123");
    expect(drawerOpen()).toBe(true);

    loadSettings("verified_user");
    await settle();

    expect(drawerOpen()).toBe(true);
  });
});
