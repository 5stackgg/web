import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { SidebarProvider } from "@/components/ui/sidebar";
import TopNav from "~/layouts/components/TopNav.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { emulateDevice, fakePwa, userAgents } from "../../helpers/pwaDevice";

mockNuxtImport("usePendingImports", () => () => ({ pendingImports: ref([]) }));
mockNuxtImport("useCurrentLeagueSeason", () => () => ({
  currentSeasonTo: computed(() => "/"),
  currentSeason: ref(null),
}));

vi.mock("@/composables/useHubState", () => ({
  useHubState: () => ({ openLastOrDefaultHub: () => {} }),
}));

const stubs = {
  MatchLobbies: true,
  DraftRoomNav: true,
  SystemStatus: true,
  PlayerDisplay: true,
  PlayerPendingImports: true,
  Logout: true,
};

let pwa: ReturnType<typeof fakePwa> | undefined;
let unmount: (() => void) | undefined;

beforeEach(() => {
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Player",
    role: e_player_roles_enum.user,
  } as ReturnType<typeof useAuthStore>["me"];
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  pwa?.restore();
  pwa = undefined;
  vi.restoreAllMocks();
});

async function mountTopNav() {
  const wrapper = await mountSuspended(
    defineComponent({
      render: () => h(SidebarProvider, null, () => h(TopNav)),
    }),
    { global: { stubs } },
  );
  unmount = () => wrapper.unmount();
  await flushPromises();
  return wrapper;
}

async function openProfileMenu(
  wrapper: Awaited<ReturnType<typeof mountTopNav>>,
) {
  const trigger = wrapper.find('button[aria-haspopup="menu"]');
  expect(trigger.exists()).toBe(true);
  await trigger.trigger("click");
  await flushPromises();
  expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
}

function menuInstallRow() {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((item) => item.textContent?.trim() === "Install App");
}

describe("TopNav install entry", () => {
  it("gives a phone-width player an Install App entry in the profile menu", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });
    pwa = fakePwa({ showInstallPrompt: true });

    const wrapper = await mountTopNav();
    await openProfileMenu(wrapper);

    expect(menuInstallRow()).toBeDefined();
  });

  it("keeps the desktop header button and leaves the menu alone", async () => {
    emulateDevice({ userAgent: userAgents.desktopChrome, width: 1280 });
    pwa = fakePwa({ showInstallPrompt: true });

    const wrapper = await mountTopNav();

    expect(wrapper.find("svg.lucide-monitor-down").exists()).toBe(true);

    await openProfileMenu(wrapper);

    expect(menuInstallRow()).toBeUndefined();
  });

  it("offers nothing to a phone already running the installed app", async () => {
    emulateDevice({
      userAgent: userAgents.androidChrome,
      width: 412,
      standalone: true,
    });
    pwa = fakePwa({ showInstallPrompt: false });

    const wrapper = await mountTopNav();
    await openProfileMenu(wrapper);

    expect(menuInstallRow()).toBeUndefined();
  });
});
