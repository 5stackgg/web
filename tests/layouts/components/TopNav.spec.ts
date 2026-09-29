import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed, defineComponent, h, ref } from "vue";
import { flushPromises } from "@vue/test-utils";
import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime";
import { SidebarProvider } from "@/components/ui/sidebar";
import TopNav from "~/layouts/components/TopNav.vue";
import { e_player_roles_enum } from "~/generated/zeus";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
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

describe("TopNav Watch live badge", () => {
  afterEach(() => {
    useMatchLobbyStore().liveMatchesCount = 0;
  });

  it("renders red, with none of the amber count classes left to win the cascade", async () => {
    emulateDevice({ userAgent: userAgents.desktopChrome, width: 1280 });
    useMatchLobbyStore().liveMatchesCount = 3;

    const wrapper = await mountTopNav();
    const badge = wrapper
      .findAll('a[href="/watch"] span')
      .find((span) => span.text() === "3");

    expect(badge).toBeDefined();
    const classes = badge!.classes();
    expect(classes).toEqual(
      expect.arrayContaining([
        "border-destructive/50",
        "bg-destructive/15",
        "text-destructive",
      ]),
    );
    expect(classes.filter((name) => name.includes("--tac-amber"))).toEqual([]);
  });
});

describe("TopNav between 768 and 830px", () => {
  it("treats exactly 768px as desktop, the width Tailwind's md starts at", async () => {
    emulateDevice({ userAgent: userAgents.desktopChrome, width: 768 });

    const wrapper = await mountTopNav();

    expect(wrapper.find('a[aria-label="5stack"]').exists()).toBe(true);
  });

  it("keeps 767px on the phone bar", async () => {
    emulateDevice({ userAgent: userAgents.desktopChrome, width: 767 });

    const wrapper = await mountTopNav();

    expect(wrapper.find('a[aria-label="5stack"]').exists()).toBe(false);
  });

  it("scrolls the desktop list instead of running it under the account controls", async () => {
    emulateDevice({ userAgent: userAgents.desktopChrome, width: 800 });

    const wrapper = await mountTopNav();
    const root = wrapper.find("[data-reka-navigation-menu]");

    expect(root.classes()).toContain("md:[&>div:first-child]:min-w-0");
    expect(root.find("ul").classes()).toEqual(
      expect.arrayContaining([
        "[&>li]:shrink-0",
        "md:justify-start",
        "md:overflow-x-auto",
      ]),
    );
  });

  it("lets a mouse wheel reach items cut off at the end of the list", async () => {
    emulateDevice({ userAgent: userAgents.desktopChrome, width: 800 });

    const wrapper = await mountTopNav();
    const list = wrapper.find("[data-reka-navigation-menu] ul")
      .element as HTMLElement;
    Object.defineProperty(list, "scrollWidth", { value: 600 });
    Object.defineProperty(list, "clientWidth", { value: 400 });

    const down = new WheelEvent("wheel", { deltaY: 120, cancelable: true });
    list.dispatchEvent(down);
    expect(list.scrollLeft).toBe(120);
    expect(down.defaultPrevented).toBe(true);

    list.dispatchEvent(new WheelEvent("wheel", { deltaY: 500 }));
    expect(list.scrollLeft).toBe(200);

    const pastEnd = new WheelEvent("wheel", { deltaY: 50, cancelable: true });
    list.dispatchEvent(pastEnd);
    expect(pastEnd.defaultPrevented).toBe(false);
  });

  it("carries the below-830px compaction on the wordmark and links", async () => {
    emulateDevice({ userAgent: userAgents.desktopChrome, width: 800 });

    const wrapper = await mountTopNav();
    const wordmark = wrapper.find('a[aria-label="5stack"] > span');
    const watch = wrapper.find('a[href="/watch"]');

    expect(wordmark.classes()).toContain("max-[829px]:hidden");
    expect(watch.classes()).toEqual(
      expect.arrayContaining([
        "sm:px-[0.85rem]",
        "md:max-[829px]:px-[0.55rem]",
        "md:max-[829px]:tracking-[0.12em]",
      ]),
    );
  });
});

describe("TopNav FAQ entry", () => {
  async function openCommunity(
    wrapper: Awaited<ReturnType<typeof mountTopNav>>,
  ) {
    const community = wrapper
      .findAll("button")
      .find((candidate) => candidate.text().startsWith("Community"));
    await community!.trigger("click");
    await flushPromises();

    return wrapper.find('[data-reka-navigation-menu] [id*="-content-"]');
  }

  it("reaches the FAQ from the Community menu on a signed-out phone", async () => {
    emulateDevice({ userAgent: userAgents.androidChrome, width: 390 });
    useAuthStore().me = undefined;

    const wrapper = await mountTopNav();
    const barFaq = wrapper
      .findAll("[data-reka-navigation-menu] > div > ul > li")
      .find((item) => item.find('a[href="/faq"]').exists());
    expect(barFaq?.classes()).toEqual(
      expect.arrayContaining(["hidden", "md:block"]),
    );

    const faq = (await openCommunity(wrapper)).find('a[href="/faq"]');
    expect(faq.exists()).toBe(true);
    expect(faq.text()).toContain("Support");
  });

  it("leaves it out of the desktop panel, where the bar already has it", async () => {
    emulateDevice({ userAgent: userAgents.desktopChrome, width: 1280 });

    const wrapper = await mountTopNav();

    expect((await openCommunity(wrapper)).find('a[href="/faq"]').exists()).toBe(
      false,
    );
  });
});
