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

describe("TopNav brand logo", () => {
  function brandLink(wrapper: Awaited<ReturnType<typeof mountTopNav>>) {
    return wrapper.find('a[aria-label="5stack"]');
  }

  it("leaves the logo off a phone so the menus fit", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 412 });

    const wrapper = await mountTopNav();

    expect(brandLink(wrapper).exists()).toBe(false);
  });

  it("keeps the full wordmark on desktop", async () => {
    emulateDevice({ userAgent: userAgents.desktopChrome, width: 1280 });

    const wrapper = await mountTopNav();
    const link = brandLink(wrapper);

    expect(link.exists()).toBe(true);
    expect(link.find("img").classes()).toContain("h-[30px]");
    expect(link.text()).toContain("5stack");
  });
});

describe("TopNav menus on a phone", () => {
  function trigger(
    wrapper: Awaited<ReturnType<typeof mountTopNav>>,
    label: string,
  ) {
    const button = wrapper
      .findAll("button")
      .find((candidate) => candidate.text().startsWith(label));
    expect(button).toBeDefined();
    return button!;
  }

  async function openMenu(
    wrapper: Awaited<ReturnType<typeof mountTopNav>>,
    label: string,
  ) {
    await trigger(wrapper, label).trigger("click");
    await flushPromises();
    const content = wrapper.find(
      '[data-reka-navigation-menu] [id*="-content-"]',
    );
    expect(content.exists()).toBe(true);
    return content;
  }

  function viewport(wrapper: Awaited<ReturnType<typeof mountTopNav>>) {
    return wrapper.find("[data-reka-navigation-menu] > div:last-child > *");
  }

  beforeEach(() => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 390 });
  });

  it("keeps the bar inside the screen instead of centring it off the edge", async () => {
    const wrapper = await mountTopNav();

    expect(wrapper.find("[data-reka-navigation-menu]").classes()).toEqual(
      expect.arrayContaining([
        "max-md:justify-start",
        "max-md:overflow-x-auto",
      ]),
    );
    expect(trigger(wrapper, "Play").classes()).toContain(
      "max-sm:[&>svg]:hidden",
    );
    expect(wrapper.find("svg.lucide-chevrons-up-down").classes()).toContain(
      "max-sm:hidden",
    );
  });

  it("pins the open panel under the bar, inside the screen", async () => {
    const wrapper = await mountTopNav();
    const play = await openMenu(wrapper, "Play");

    expect(viewport(wrapper).classes()).toEqual(
      expect.arrayContaining([
        "max-md:fixed",
        "max-md:inset-x-2",
        "max-md:top-14",
        "max-md:origin-top",
        "max-md:transition-none",
      ]),
    );
    expect(play.classes()).toEqual(
      expect.arrayContaining([
        "max-md:max-h-[calc(100dvh-4rem)]",
        "max-md:overflow-y-auto",
        "max-md:overscroll-contain",
      ]),
    );
  });

  it("strips the popover chrome off the viewport", async () => {
    const wrapper = await mountTopNav();
    await openMenu(wrapper, "Play");

    const classes = viewport(wrapper).classes();
    expect(classes).toEqual(
      expect.arrayContaining([
        "mt-0",
        "rounded-none",
        "border-0",
        "bg-transparent",
        "shadow-none",
      ]),
    );
    for (const popoverClass of [
      "mt-1.5",
      "rounded-md",
      "border",
      "bg-popover",
      "shadow",
    ]) {
      expect(classes).not.toContain(popoverClass);
    }
  });

  it("keeps the desktop panel widths and the Play hero off a phone", async () => {
    const wrapper = await mountTopNav();
    const play = await openMenu(wrapper, "Play");

    expect(play.classes()).toContain("md:min-w-[500px]");
    expect(play.classes().some((name) => name.startsWith("min-w-"))).toBe(
      false,
    );
    const hero = play.find("div.\\-my-5");
    expect(hero.text()).toContain("Play & Compete");
    expect(hero.classes()).toContain("max-md:hidden");
  });

  it("drops Community subtitles and keeps Watch in the bar only", async () => {
    const wrapper = await mountTopNav();
    const community = await openMenu(wrapper, "Community");

    expect(community.find('a[href="/players"]').exists()).toBe(true);
    expect(community.find('a[href="/watch"]').exists()).toBe(false);
    expect(wrapper.find('a[href="/watch"]').exists()).toBe(true);
    const subtitle = community
      .findAll("a span")
      .filter((span) => span.text() === "Browse and search for players");
    expect(subtitle).toHaveLength(1);
    expect(subtitle[0].classes()).toContain("max-md:hidden");
  });
});
