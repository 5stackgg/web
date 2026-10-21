import { afterEach, expect, it, vi } from "vitest";
import { computed, defineComponent, h, ref } from "vue";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { SidebarProvider } from "@/components/ui/sidebar";
import TopNav from "~/layouts/components/TopNav.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { emulateDevice, userAgents } from "../../helpers/pwaDevice";

mockNuxtImport("usePendingImports", () => () => ({ pendingImports: ref([]) }));
mockNuxtImport("useCurrentLeagueSeason", () => () => ({
  currentSeasonTo: computed(() => "/"),
  currentSeason: ref(null),
}));

vi.mock("@/composables/useHubState", () => ({
  useHubState: () => ({ openLastOrDefaultHub: () => {} }),
}));

const practiceChip = vi.hoisted(() => {
  let release = () => {};
  const loaded = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { loaded, release: () => release() };
});

vi.mock("~/components/utility/UtilityPracticeNav.vue", async () => {
  await practiceChip.loaded;
  return {
    __esModule: true,
    default: defineComponent({
      render: () => h("span", { "data-practice-chip": "" }),
    }),
  };
});

let unmount: (() => void) | undefined;

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

it("shows the top bar without waiting for the practice chip's code", async () => {
  emulateDevice({ userAgent: userAgents.desktopChrome, width: 1280 });
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Player",
    role: e_player_roles_enum.user,
  } as ReturnType<typeof useAuthStore>["me"];

  let shown = false;
  const mounting = mountSuspended(
    defineComponent({
      render: () => h(SidebarProvider, null, () => h(TopNav)),
    }),
    {
      global: {
        stubs: {
          MatchLobbies: true,
          DraftRoomNav: true,
          SystemStatus: true,
          PlayerDisplay: true,
          PlayerPendingImports: true,
          Logout: true,
        },
      },
    },
  ).then((wrapper) => {
    shown = true;
    return wrapper;
  });

  try {
    await vi.waitFor(() => expect(shown).toBe(true), { timeout: 2000 });
  } finally {
    practiceChip.release();
  }

  const wrapper = await mounting;
  unmount = () => wrapper.unmount();

  await vi.waitFor(() =>
    expect(wrapper.find("[data-practice-chip]").exists()).toBe(true),
  );
});
