<script setup lang="ts">
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InstallPWA from "~/components/InstallPWA.vue";
import { DiscordLogoIcon } from "@radix-icons/vue";
import { Settings, LogOut, ChevronsUpDown } from "lucide-vue-next";
import PlayerDisplay from "~/components/PlayerDisplay.vue";
import { useAuthStore } from "~/stores/AuthStore";
import { useMatchLobbyStore } from "~/stores/MatchLobbyStore";
import Logout from "./Logout.vue";
import MatchLobbies from "./MatchLobbies.vue";
import SystemStatus from "./SystemStatus.vue";
import { useSidebar } from "~/components/ui/sidebar/utils";
import { NuxtImg } from "#components";
import { Button } from "@/components/ui/button";
import { Grid } from "lucide-vue-next";
import { useHubState } from "@/composables/useHubState";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import { loginLinks } from "~/utilities/loginLinks";

const { isMobile } = useSidebar();
const { openLastOrDefaultHub } = useHubState();
const { brandName, logoUrl } = useBranding();
const route = useRoute();
const authStore = useAuthStore();
const homePath = computed(() => (authStore.me ? "/me" : "/watch"));
const isHome = computed(() => {
  if (homePath.value === "/me") {
    return (
      route.path === "/me" ||
      (route.path.startsWith("/players/") &&
        String(route.params.id) === String(authStore.me?.steam_id))
    );
  }

  return route.path === homePath.value;
});

const navMenuClasses =
  "ml-1 [&>div:last-child]:top-full [&>div:last-child]:[transform:translateX(var(--tac-viewport-offset,0))] [&>div:last-child]:transition-[transform,width] [&>div:last-child]:[transition-duration:220ms] [&>div:last-child>*]:!mt-0 [&>div:last-child>*]:!rounded-none [&>div:last-child>*]:!border-0 [&>div:last-child>*]:!bg-transparent [&>div:last-child>*]:!shadow-none";

const navTickClasses =
  "nav-link-tick h-[5px] w-[5px] shrink-0 rotate-45 bg-[hsl(var(--topnav-foreground)/0.3)] transition-colors duration-150";

const navLinkClasses =
  "group relative inline-flex items-center gap-[0.55rem] rounded-none border-0 bg-transparent px-[0.85rem] py-2 font-sans text-[0.78rem] font-bold uppercase leading-none tracking-[0.18em] text-[hsl(var(--topnav-foreground)/0.78)] transition-[color,background-color,box-shadow] duration-150 hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-topnav-foreground focus-visible:bg-[hsl(var(--tac-amber)/0.08)] focus-visible:text-topnav-foreground focus-visible:outline-none [&.router-link-active]:bg-[hsl(var(--tac-amber)/0.1)] [&.router-link-active]:text-topnav-foreground [&.router-link-active]:shadow-[inset_0_-2px_0_hsl(var(--tac-amber))] [&.router-link-exact-active]:bg-[hsl(var(--tac-amber)/0.1)] [&.router-link-exact-active]:text-topnav-foreground [&.router-link-exact-active]:shadow-[inset_0_-2px_0_hsl(var(--tac-amber))] hover:[&>.nav-link-tick]:bg-[hsl(var(--tac-amber))] focus-visible:[&>.nav-link-tick]:bg-[hsl(var(--tac-amber))] [&.router-link-active>.nav-link-tick]:bg-[hsl(var(--tac-amber))] [&.router-link-exact-active>.nav-link-tick]:bg-[hsl(var(--tac-amber))]";

const navTriggerClasses =
  "nav-trigger-anchor group gap-[0.55rem] h-auto rounded-none border-0 bg-transparent px-[0.85rem] py-2 font-sans text-[0.78rem] font-bold uppercase leading-none tracking-[0.18em] text-[hsl(var(--topnav-foreground)/0.78)] transition-[color,background-color] duration-150 hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-topnav-foreground focus:bg-[hsl(var(--tac-amber)/0.08)] focus:text-topnav-foreground focus-visible:outline-none data-[state=open]:bg-[hsl(var(--tac-amber)/0.08)] data-[state=open]:text-topnav-foreground hover:[&>.nav-link-tick]:bg-[hsl(var(--tac-amber))] focus:[&>.nav-link-tick]:bg-[hsl(var(--tac-amber))] data-[state=open]:[&>.nav-link-tick]:bg-[hsl(var(--tac-amber))] [&>svg]:ml-[0.15rem] [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-60 data-[state=open]:[&>svg]:text-[hsl(var(--tac-amber))] data-[state=open]:[&>svg]:opacity-100";

const navBadgeClasses =
  "inline-flex min-w-[1.3rem] items-center justify-center gap-[0.3rem] border border-[hsl(var(--tac-amber)/0.45)] bg-[hsl(var(--tac-amber)/0.14)] px-[0.4rem] py-[0.15rem] font-sans text-[0.62rem] font-bold leading-none tracking-[0.12em] text-[hsl(var(--tac-amber))] [clip-path:polygon(4px_0,100%_0,100%_calc(100%-4px),calc(100%-4px)_100%,0_100%,0_4px)] [font-variant-numeric:tabular-nums]";

const navBadgeInlineClasses = "ml-auto";
const navBadgeLiveClasses =
  "border-[hsl(0_80%_60%/0.45)] bg-[hsl(0_80%_60%/0.12)] text-[hsl(0_80%_68%)]";
const navBadgeDotClasses =
  "h-[5px] w-[5px] rounded-full bg-current shadow-[0_0_6px_currentColor]";

const navContentClasses =
  "relative mt-0 min-w-[360px] max-w-[95vw] overflow-hidden border border-topnav-border bg-[linear-gradient(180deg,hsl(var(--topnav-background)/0.98)_0%,hsl(var(--topnav-background)/0.92)_100%)] p-0 shadow-[inset_0_1px_0_hsl(var(--tac-amber)/0.12),0_20px_40px_-12px_hsl(0_0%_0%/0.55)] [clip-path:polygon(0_0,calc(100%-12px)_0,100%_12px,100%_100%,12px_100%,0_calc(100%-12px))] [backdrop-filter:blur(8px)] [-webkit-backdrop-filter:blur(8px)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,hsl(var(--tac-amber)/0.5),transparent)]";
const playContentClasses = `${navContentClasses} min-w-[500px]`;
const communityContentClasses = `${navContentClasses} min-w-[560px]`;

const navGroupLabelClasses =
  "mb-2 inline-flex list-none items-center gap-2 px-[0.2rem] font-sans text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--topnav-foreground)/0.45)]";
const navGroupLabelTickClasses =
  "inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]";

const navItemClasses =
  "group relative flex items-center gap-[0.6rem] border border-transparent border-l-2 border-l-transparent px-[0.65rem] py-2 font-sans text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-[hsl(var(--topnav-foreground)/0.82)] no-underline transition-[color,background-color,border-color] duration-150 hover:border-l-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-topnav-foreground focus-visible:border-l-[hsl(var(--tac-amber))] focus-visible:bg-[hsl(var(--tac-amber)/0.08)] focus-visible:text-topnav-foreground focus-visible:outline-none hover:[&>.nav-item-chevron]:translate-x-[2px] hover:[&>.nav-item-chevron]:text-[hsl(var(--tac-amber))] focus-visible:[&>.nav-item-chevron]:translate-x-[2px] focus-visible:[&>.nav-item-chevron]:text-[hsl(var(--tac-amber))]";
const navItemStackedClasses = "items-start py-[0.55rem]";
const navItemChevronClasses =
  "nav-item-chevron shrink-0 translate-y-[-0.5px] text-[0.55rem] text-[hsl(var(--tac-amber)/0.65)] transition-[transform,color] duration-150";
const navItemLabelClasses = "inline-flex items-center gap-[0.45rem]";
const navItemLabelIconClasses = "gap-2";
const navItemContentClasses = "flex min-w-0 flex-1 flex-col gap-1";
const navItemSubClasses =
  "text-[0.64rem] font-medium normal-case tracking-[0.08em] text-[hsl(var(--topnav-foreground)/0.5)] [font-family:system-ui,sans-serif]";

const heroClasses =
  "relative flex min-w-[160px] max-w-[210px] flex-col items-start justify-center gap-[0.35rem] overflow-hidden border-l border-l-[hsl(var(--tac-amber)/0.3)] bg-[linear-gradient(135deg,hsl(var(--tac-amber)/0.18)_0%,hsl(var(--tac-amber)/0.04)_100%),hsl(var(--topnav-primary)/0.9)] px-[1.1rem] py-5";
const heroGridClasses =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(hsl(var(--tac-amber)/0.08)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--tac-amber)/0.08)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_30%_30%,black_0%,transparent_75%)]";
const heroLabelClasses =
  "relative inline-flex items-center gap-[0.35rem] font-sans text-[0.58rem] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--tac-amber))]";
const heroTitleClasses =
  "relative font-sans text-[1.15rem] font-bold uppercase leading-[1.05] tracking-[0.03em] text-topnav-primary-foreground [font-stretch:82%]";
const heroSubtitleClasses =
  "relative text-[0.72rem] leading-[1.35] text-[hsl(var(--topnav-primary-foreground)/0.65)]";

const topNavRightClasses = "flex items-center gap-2";
const profileButtonClasses =
  "inline-flex items-center gap-1.5 border border-transparent bg-transparent px-[0.6rem] py-[0.35rem] text-topnav-foreground transition-[background-color,border-color,color] duration-150 [clip-path:polygon(6px_0,100%_0,100%_calc(100%-6px),calc(100%-6px)_100%,0_100%,0_6px)] hover:border-[hsl(var(--tac-amber)/0.35)] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-[hsl(var(--tac-amber))]";
const loginButtonClasses =
  "group relative inline-flex items-center gap-[0.45rem] rounded-md border border-[hsl(var(--tac-amber)/0.55)] bg-[linear-gradient(180deg,hsl(var(--tac-amber)/0.14)_0%,hsl(var(--tac-amber)/0.06)_100%)] px-[0.8rem] py-[0.45rem] font-sans text-[0.68rem] font-bold uppercase tracking-[0.16em] text-topnav-foreground transition-[background-color,color,transform] duration-150 hover:bg-[linear-gradient(180deg,hsl(var(--tac-amber)/0.28)_0%,hsl(var(--tac-amber)/0.14)_100%)] active:translate-y-px sm:px-3 sm:py-[0.35rem] sm:text-[0.65rem] sm:tracking-[0.18em]";
const loginArrowClasses =
  "font-sans text-[hsl(var(--tac-amber))] transition-transform duration-150 group-hover:translate-x-[3px]";

const navMenuRef = ref<any>(null);
const viewportOffset = ref(0);

const getMenuEl = (): HTMLElement | null => {
  const menuRef = navMenuRef.value;
  return (menuRef?.$el ?? menuRef) as HTMLElement | null;
};

const updateViewportOffset = () => {
  const root = getMenuEl();
  if (!root) return;

  const list = root.querySelector<HTMLElement>("ul");
  const openTrigger = root.querySelector<HTMLElement>(
    '.nav-trigger-anchor[data-state="open"]',
  );

  if (!list || !openTrigger) return;

  const listRect = list.getBoundingClientRect();
  const triggerRect = openTrigger.getBoundingClientRect();
  viewportOffset.value = triggerRect.left - listRect.left;
};

const onMenuValueChange = (value: unknown) => {
  if (!value) return;
  requestAnimationFrame(() => requestAnimationFrame(updateViewportOffset));
};

if (import.meta.client) {
  onMounted(() => {
    window.addEventListener("resize", updateViewportOffset);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("resize", updateViewportOffset);
  });
}
</script>

<template>
  <nav
    class="sticky top-0 z-50 isolate w-full border-b border-topnav-border bg-[linear-gradient(180deg,hsl(var(--topnav-background)/0.96)_0%,hsl(var(--topnav-background)/0.82)_100%)] shadow-[inset_0_1px_0_hsl(var(--tac-amber)/0.08),0_10px_30px_-15px_hsl(0_0%_0%/0.5)] [backdrop-filter:blur(10px)_saturate(125%)] [-webkit-backdrop-filter:blur(10px)_saturate(125%)]"
    role="navigation"
  >
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-[linear-gradient(90deg,transparent_0%,hsl(var(--tac-amber)/0)_6%,hsl(var(--tac-amber)/0.55)_50%,hsl(var(--tac-amber)/0)_94%,transparent_100%)]"
    ></div>

    <div
      class="relative flex h-14 min-h-14 items-center justify-between gap-4 px-2.5 sm:h-16 sm:min-h-16 sm:px-4"
    >
      <div class="flex min-w-0 items-center gap-3">
        <NuxtLink
          v-if="!isMobile"
          :to="homePath"
          class="inline-flex select-none items-center gap-[0.7rem] text-inherit no-underline"
          :class="{ 'pointer-events-none cursor-default': isHome }"
          :tabindex="isHome ? -1 : undefined"
          :aria-label="brandName || $t('layouts.app_nav.brand')"
          :aria-current="isHome ? 'page' : undefined"
        >
          <NuxtImg
            class="h-[30px] w-[30px] shrink-0 object-contain"
            :src="logoUrl || '/favicon/64.png'"
            :alt="brandName || 'brand'"
          />

          <span
            class="relative inline-flex font-sans text-[1.1rem] font-bold uppercase leading-none tracking-[0.05em] [font-stretch:82%]"
          >
            <span
              aria-hidden="true"
              class="pointer-events-none absolute left-[2px] top-[2px] select-none text-transparent [-webkit-text-stroke:1px_hsl(var(--tac-amber)/0.4)]"
            >
              {{ brandName || $t("layouts.app_nav.brand") }}
            </span>
            <span
              class="relative bg-[linear-gradient(180deg,hsl(var(--topnav-foreground))_0%,hsl(var(--topnav-foreground)/0.72)_100%)] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
            >
              {{ brandName || $t("layouts.app_nav.brand") }}
            </span>
          </span>
        </NuxtLink>

        <span
          v-if="!isMobile"
          aria-hidden="true"
          class="mx-[0.15rem] h-[22px] w-px bg-[linear-gradient(180deg,transparent_0%,hsl(var(--topnav-border))_30%,hsl(var(--topnav-border))_70%,transparent_100%)]"
        ></span>

        <SystemStatus v-if="!isMobile" />

        <NavigationMenu
          ref="navMenuRef"
          :class="navMenuClasses"
          :style="{ '--tac-viewport-offset': `${viewportOffset}px` }"
          @update:model-value="onMenuValueChange"
        >
          <NavigationMenuList class="flex items-center gap-1">
            <NavigationMenuItem v-if="me" class="hidden md:block">
              <NavigationMenuLink as-child>
                <NuxtLink to="/me" :class="navLinkClasses">
                  <span :class="navTickClasses"></span>
                  {{ $t("layouts.top_nav.home") }}
                </NuxtLink>
              </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem class="hidden md:block">
              <NavigationMenuLink as-child>
                <NuxtLink to="/watch" :class="navLinkClasses">
                  <span :class="navTickClasses"></span>
                  {{ $t("layouts.top_nav.watch_menu") }}
                  <span
                    v-if="liveMatchesCount > 0"
                    :class="[navBadgeClasses, navBadgeLiveClasses]"
                  >
                    <span :class="navBadgeDotClasses"></span>
                    {{ liveMatchesCount }}
                  </span>
                </NuxtLink>
              </NavigationMenuLink>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger :class="navTriggerClasses">
                <span :class="navTickClasses"></span>
                {{ $t("layouts.top_nav.play_menu") }}
                <span v-if="playTotalCount > 0" :class="navBadgeClasses">
                  {{ playTotalCount }}
                </span>
              </NavigationMenuTrigger>

              <NavigationMenuContent :class="playContentClasses">
                <div class="flex w-full p-5">
                  <div class="min-w-[160px] flex-1">
                    <div :class="navGroupLabelClasses">
                      <span :class="navGroupLabelTickClasses"></span>
                      OPERATIONS
                    </div>
                    <ul class="flex flex-col gap-1">
                      <li>
                        <NavigationMenuLink as-child>
                          <NuxtLink to="/play" :class="navItemClasses">
                            <span :class="navItemChevronClasses">◢</span>
                            <span :class="navItemLabelClasses">
                              {{ $t("layouts.top_nav.play.find_match") }}
                            </span>
                            <span
                              v-if="openMatchesCount > 0"
                              :class="[navBadgeClasses, navBadgeInlineClasses]"
                            >
                              {{ openMatchesCount }}
                            </span>
                          </NuxtLink>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink as-child>
                          <NuxtLink to="/tournaments" :class="navItemClasses">
                            <span :class="navItemChevronClasses">◢</span>
                            <span :class="navItemLabelClasses">
                              {{ $t("layouts.top_nav.play.tournaments") }}
                            </span>
                            <span
                              v-if="activeTournamentsCount > 0"
                              :class="[navBadgeClasses, navBadgeInlineClasses]"
                            >
                              {{ activeTournamentsCount }}
                            </span>
                          </NuxtLink>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink as-child>
                          <NuxtLink
                            to="/public-servers"
                            :class="navItemClasses"
                          >
                            <span :class="navItemChevronClasses">◢</span>
                            <span :class="navItemLabelClasses">
                              {{ $t("layouts.top_nav.play.public_servers") }}
                            </span>
                          </NuxtLink>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </div>

                  <div :class="[heroClasses, '-my-5 -mr-5 ml-5']">
                    <div :class="heroGridClasses" aria-hidden="true"></div>
                    <div :class="heroLabelClasses">
                      <span class="text-[0.55rem] text-[hsl(var(--tac-amber))]"
                        >◢</span
                      >
                      PRIMARY
                    </div>
                    <div :class="heroTitleClasses">
                      {{ $t("layouts.top_nav.play.hero.title") }}
                    </div>
                    <div :class="heroSubtitleClasses">
                      {{ $t("layouts.top_nav.play.hero.subtitle") }}
                    </div>
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger :class="navTriggerClasses">
                <span :class="navTickClasses"></span>
                {{ $t("layouts.top_nav.community_menu") }}
              </NavigationMenuTrigger>

              <NavigationMenuContent :class="communityContentClasses">
                <div class="flex w-full flex-col gap-6 p-5 md:flex-row">
                  <div class="min-w-[160px] flex-1">
                    <div :class="navGroupLabelClasses">
                      <span :class="navGroupLabelTickClasses"></span>
                      ROSTER
                    </div>
                    <ul class="flex flex-col gap-1">
                      <li class="block md:hidden">
                        <NavigationMenuLink as-child>
                          <NuxtLink
                            to="/watch"
                            :class="[navItemClasses, navItemStackedClasses]"
                          >
                            <span :class="navItemChevronClasses">◢</span>
                            <span :class="navItemContentClasses">
                              <span :class="navItemLabelClasses">
                                {{
                                  $t("layouts.top_nav.community.watch.title")
                                }}
                                <span
                                  v-if="liveMatchesCount > 0"
                                  :class="[
                                    navBadgeClasses,
                                    navBadgeInlineClasses,
                                    navBadgeLiveClasses,
                                  ]"
                                >
                                  {{ liveMatchesCount }}
                                </span>
                              </span>
                              <span :class="navItemSubClasses">
                                {{
                                  $t("layouts.top_nav.community.watch.subtitle")
                                }}
                              </span>
                            </span>
                          </NuxtLink>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink as-child>
                          <NuxtLink
                            to="/players"
                            :class="[navItemClasses, navItemStackedClasses]"
                          >
                            <span :class="navItemChevronClasses">◢</span>
                            <span :class="navItemContentClasses">
                              <span :class="navItemLabelClasses">
                                {{
                                  $t("layouts.top_nav.community.players.title")
                                }}
                              </span>
                              <span :class="navItemSubClasses">
                                {{
                                  $t(
                                    "layouts.top_nav.community.players.subtitle",
                                  )
                                }}
                              </span>
                            </span>
                          </NuxtLink>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink as-child>
                          <NuxtLink
                            to="/teams"
                            :class="[navItemClasses, navItemStackedClasses]"
                          >
                            <span :class="navItemChevronClasses">◢</span>
                            <span :class="navItemContentClasses">
                              <span :class="navItemLabelClasses">
                                {{
                                  $t("layouts.top_nav.community.teams.title")
                                }}
                              </span>
                              <span :class="navItemSubClasses">
                                {{
                                  $t("layouts.top_nav.community.teams.subtitle")
                                }}
                              </span>
                            </span>
                          </NuxtLink>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink as-child>
                          <NuxtLink
                            to="/leaderboard"
                            :class="[navItemClasses, navItemStackedClasses]"
                          >
                            <span :class="navItemChevronClasses">◢</span>
                            <span :class="navItemContentClasses">
                              <span :class="navItemLabelClasses">
                                {{
                                  $t(
                                    "layouts.top_nav.community.leaderboard.title",
                                  )
                                }}
                              </span>
                              <span :class="navItemSubClasses">
                                {{
                                  $t(
                                    "layouts.top_nav.community.leaderboard.subtitle",
                                  )
                                }}
                              </span>
                            </span>
                          </NuxtLink>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </div>

                  <div class="min-w-[160px] flex-1">
                    <div :class="navGroupLabelClasses">
                      <span :class="navGroupLabelTickClasses"></span>
                      {{ $t("layouts.top_nav.community.social.title") }}
                    </div>
                    <ul class="flex flex-col gap-1">
                      <li>
                        <NavigationMenuLink as-child>
                          <a
                            :href="inviteLink"
                            target="_blank"
                            rel="noopener noreferrer"
                            :class="[navItemClasses, navItemStackedClasses]"
                          >
                            <span :class="navItemChevronClasses">◢</span>
                            <span :class="navItemContentClasses">
                              <span
                                :class="[
                                  navItemLabelClasses,
                                  navItemLabelIconClasses,
                                ]"
                              >
                                {{
                                  $t(
                                    "layouts.top_nav.community.social.join_discord.title",
                                  )
                                }}
                                <DiscordLogoIcon class="h-3.5 w-3.5" />
                              </span>
                              <span :class="navItemSubClasses">
                                {{
                                  $t(
                                    "layouts.top_nav.community.social.join_discord.subtitle",
                                  )
                                }}
                              </span>
                            </span>
                          </a>
                        </NavigationMenuLink>
                      </li>
                      <li v-if="showReportIssue">
                        <NavigationMenuLink as-child>
                          <a
                            :href="githubUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            :class="[navItemClasses, navItemStackedClasses]"
                          >
                            <span :class="navItemChevronClasses">◢</span>
                            <span :class="navItemContentClasses">
                              <span :class="navItemLabelClasses">GitHub</span>
                              <span :class="navItemSubClasses">
                                {{ $t("layouts.app_nav.footer.report_issue") }}
                              </span>
                            </span>
                          </a>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>

      <template v-if="me">
        <div :class="topNavRightClasses">
          <InstallPWA v-if="!isMobile" :is-menu-item="false" />
          <MatchLobbies v-if="!isMobile" />
          <Button
            variant="ghost"
            size="icon"
            class="relative h-7 w-7 md:hidden"
            @click="openLastOrDefaultHub()"
          >
            <Grid class="h-4 w-4" />
            <span class="sr-only">{{
              $t("ui.tooltips.toggle_right_sidebar")
            }}</span>
          </Button>

          <DropdownMenu v-model:open="profileMenuOpen">
            <DropdownMenuTrigger as-child>
              <button type="button" :class="profileButtonClasses">
                <PlayerDisplay
                  :player="me"
                  :show-online="false"
                  :show-name="false"
                  :show-elo="false"
                  :show-flag="false"
                  :show-role="false"
                  size="sm"
                />
                <ChevronsUpDown class="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              class="w-56 rounded-lg border border-topnav-border bg-topnav shadow-lg"
              align="end"
              :side-offset="4"
            >
              <DropdownMenuLabel class="p-3 font-normal">
                <PlayerDisplay :player="me" :show-online="false" />
              </DropdownMenuLabel>
              <DropdownMenuSeparator class="bg-topnav-border" />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  class="flex cursor-pointer gap-2 p-3"
                  as-child
                >
                  <NuxtLink
                    :to="{ name: 'settings' }"
                    class="flex items-center gap-2 transition-colors hover:text-topnav-accent"
                  >
                    <Settings class="h-4 w-4" />
                    {{ $t("layouts.app_nav.profile.my_account") }}
                  </NuxtLink>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator class="bg-topnav-border" />
              <DropdownMenuItem
                class="flex cursor-pointer gap-2 p-3 transition-colors hover:text-topnav-accent"
                @click="showLogoutModal = true"
              >
                <LogOut class="h-4 w-4" />
                {{ $t("layouts.app_nav.profile.logout") }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div
            id="right-sidebar-trigger"
            class="flex items-center justify-center"
            v-show="isMobile"
          ></div>
        </div>
        <Logout
          v-if="showLogoutModal"
          @update:open="showLogoutModal = $event"
        />
      </template>

      <template v-else>
        <div :class="topNavRightClasses">
          <button @click="signIn" :class="loginButtonClasses" type="button">
            <SteamIcon class="h-3.5 w-3.5 fill-white" />
            <span>{{ $t("layouts.top_nav.login") }}</span>
            <span :class="loginArrowClasses">→</span>
          </button>
        </div>
      </template>
    </div>

    <div
      aria-hidden="true"
      class="pointer-events-none absolute bottom-px left-2.5 right-2.5 flex items-end justify-between sm:left-6 sm:right-6"
    >
      <span
        v-for="i in 64"
        :key="i"
        class="h-[3px] w-px bg-[hsl(var(--topnav-foreground)/0.15)]"
        :class="{ 'h-1.5 bg-[hsl(var(--tac-amber)/0.45)]': i % 8 === 0 }"
      ></span>
    </div>
  </nav>
</template>

<script lang="ts">
export default {
  data() {
    return {
      showLogoutModal: false,
      profileMenuOpen: false,
    };
  },
  computed: {
    inviteLink() {
      return `https://${useRuntimeConfig().public.webDomain}/discord-invite`;
    },
    githubUrl() {
      return useApplicationSettingsStore().githubUrl;
    },
    showReportIssue() {
      return useApplicationSettingsStore().showReportIssue;
    },
    me() {
      return useAuthStore().me;
    },
    liveMatchesCount() {
      return useMatchLobbyStore().liveMatchesCount;
    },
    activeTournamentsCount() {
      const store = useMatchLobbyStore();
      return (
        store.liveTournamentsCount + store.openRegistrationTournamentsCount
      );
    },
    openMatchesCount() {
      return useMatchLobbyStore().openMatchesCount;
    },
    playTotalCount() {
      return this.openMatchesCount + this.activeTournamentsCount;
    },
  },
  methods: {
    signIn() {
      window.location.href = `${loginLinks.steam}?redirect=${encodeURIComponent(window.location.toString())}`;
    },
  },
};
</script>
