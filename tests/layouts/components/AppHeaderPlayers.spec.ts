import { afterEach, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppHeader from "~/layouts/components/AppHeader.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { emulateDevice, userAgents } from "../../helpers/pwaDevice";

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

const stubs = {
  BreadCrumbs: true,
  MatchLobbies: true,
  DraftRoomNav: true,
  SystemUpdate: true,
  SystemStatus: true,
  MobileHubButton: true,
};

const signIn = (wrapper: { findAll: (selector: string) => any[] }) =>
  wrapper
    .findAll("button")
    .find((button: any) => button.text().includes("Sign in with Steam"));

let unmount: (() => void) | undefined;

function mountHeader() {
  return mountSuspended(
    defineComponent({
      render: () => h(SidebarProvider, null, () => h(AppHeader)),
    }),
    { global: { stubs } },
  ).then((wrapper) => {
    unmount = () => wrapper.unmount();
    return wrapper;
  });
}

afterEach(() => {
  unmount?.();
  unmount = undefined;
  useAuthStore().me = undefined;
  vi.restoreAllMocks();
});

it("shows the header without waiting for the practice chip's code", async () => {
  emulateDevice({ userAgent: userAgents.desktopChrome, width: 1280 });
  useAuthStore().me = {
    steam_id: "76561198000000001",
    name: "Player",
    role: e_player_roles_enum.user,
  } as ReturnType<typeof useAuthStore>["me"];

  let shown = false;
  const mounting = mountHeader().then((wrapper) => {
    shown = true;
    return wrapper;
  });

  try {
    await vi.waitFor(() => expect(shown).toBe(true), { timeout: 2000 });
  } finally {
    practiceChip.release();
  }

  const wrapper = await mounting;
  await vi.waitFor(() =>
    expect(wrapper.find("[data-practice-chip]").exists()).toBe(true),
  );
  expect(signIn(wrapper)).toBeUndefined();
});

it("gives a visitor on a phone a way to sign in from the header", async () => {
  emulateDevice({ userAgent: userAgents.iphoneSafari, width: 390 });
  practiceChip.release();

  const wrapper = await mountHeader();
  await flushPromises();

  expect(signIn(wrapper)).toBeDefined();
  expect(wrapper.find("[data-practice-chip]").exists()).toBe(false);
});

it("leaves sign-in to the nav's card on desktop", async () => {
  emulateDevice({ userAgent: userAgents.desktopChrome, width: 1280 });
  practiceChip.release();

  const wrapper = await mountHeader();
  await flushPromises();

  expect(signIn(wrapper)).toBeUndefined();
});
