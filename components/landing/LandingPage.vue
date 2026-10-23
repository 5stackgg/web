<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { useI18n } from "vue-i18n";
import { useMediaQuery } from "@vueuse/core";
import { ArrowRight, Play } from "lucide-vue-next";
import { DiscordLogoIcon } from "@radix-icons/vue";
import TopoBackground from "~/layouts/components/TopoBackground.vue";
import SystemAlertBanner from "~/components/SystemAlertBanner.vue";
import SteamIcon from "~/components/icons/SteamIcon.vue";
import { Button } from "~/components/ui/button";
import { TooltipProvider } from "~/components/ui/tooltip";
import { PageTransition } from "~/components/ui/transitions";
import LandingSection from "~/components/landing/LandingSection.vue";
import LandingDefer from "~/components/landing/LandingDefer.vue";
import LandingHero from "~/components/landing/LandingHero.vue";
import LandingNow from "~/components/landing/LandingNow.vue";
import LandingFooter from "~/components/landing/LandingFooter.vue";
import LandingNetworkStats from "~/components/landing/LandingNetworkStats.vue";
import { useBranding } from "~/composables/useBranding";
import { useGtm } from "~/layouts/composables/useGtm";
import { useSiteContent } from "~/composables/useSiteContent";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";
import { useAuthStore } from "~/stores/AuthStore";
import { signInWithSteam } from "~/utilities/loginLinks";

// Below the fold, each section's visual is its own chunk, fetched as it nears
// the screen.
const LandingPlay = defineAsyncComponent(
  () => import("~/components/landing/LandingPlay.vue"),
);
const LandingDraft = defineAsyncComponent(
  () => import("~/components/landing/LandingDraft.vue"),
);
const LandingVeto = defineAsyncComponent(
  () => import("~/components/landing/LandingVeto.vue"),
);
const LandingMatchPage = defineAsyncComponent(
  () => import("~/components/landing/LandingMatchPage.vue"),
);
const LandingBracket = defineAsyncComponent(
  () => import("~/components/landing/LandingBracket.vue"),
);
const LandingStream = defineAsyncComponent(
  () => import("~/components/landing/LandingStream.vue"),
);
const LandingReplay = defineAsyncComponent(
  () => import("~/components/landing/LandingReplay.vue"),
);
const LandingUtility = defineAsyncComponent(
  () => import("~/components/landing/LandingUtility.vue"),
);
const LandingCommunity = defineAsyncComponent(
  () => import("~/components/landing/LandingCommunity.vue"),
);

useGtm();

const { t } = useI18n();
const settings = useApplicationSettingsStore();
const auth = useAuthStore();
const { hasContent } = useSiteContent();
const { brandName, logoUrl } = useBranding();

const name = computed(() => brandName.value || "5Stack");
const webDomain = useRuntimeConfig().public.webDomain;
const phone = useMediaQuery("(max-width: 639px)");
const signedIn = computed(() => !!auth.me);

type Point = { key: string; on?: boolean };

function points(section: string, list: Point[]) {
  return list
    .filter((point) => point.on !== false)
    .map((point) => ({
      title: t(`pages.welcome.${section}.points.${point.key}.title`),
      body: t(`pages.welcome.${section}.points.${point.key}.body`),
    }));
}

function copy(section: string) {
  return {
    eyebrow: t(`pages.welcome.${section}.eyebrow`),
    title: t(`pages.welcome.${section}.title`),
    lede: t(`pages.welcome.${section}.lede`),
  };
}

const highlightsOn = computed(() => hasContent("highlights"));
// The inventory is a 5stack.gg app, not part of every panel.
const inventoryOn = webDomain === "5stack.gg";
const streamsGated = computed(
  () => !signedIn.value && settings.requireLoginForLiveStreams,
);

const sections = computed(() => ({
  play: points("play", [
    { key: "matchmaking", on: settings.matchmakingEnabled },
    { key: "draft" },
    { key: "scrims", on: settings.scrimFinderEnabled },
    { key: "servers" },
    { key: "check_in" },
  ]),
  match: points("match", [
    { key: "veto" },
    { key: "servers" },
    { key: "fix" },
    { key: "voice", on: settings.voiceChatEnabled },
  ]),
  match_page: points("match_page", [
    { key: "scoreboard" },
    { key: "economy" },
    { key: "head_to_head" },
    { key: "utility" },
  ]),
  compete: points("compete", [
    { key: "tournaments" },
    { key: "leagues", on: settings.leaguesEnabled },
    { key: "events", on: settings.eventsEnabled },
    { key: "awards" },
  ]),
  watch: points("watch", [
    { key: "streams" },
    { key: "match_pages" },
    { key: "povs" },
    { key: "news", on: settings.newsEnabled },
  ]),
  rewatch: points("rewatch", [
    { key: "replays" },
    { key: "highlights", on: highlightsOn.value },
    { key: "editor", on: highlightsOn.value },
  ]),
  utility: points("utility", [
    { key: "previews" },
    { key: "library" },
    { key: "executes" },
    { key: "practice" },
    { key: "solver" },
  ]),
  inventory: points("inventory", [
    { key: "craft" },
    { key: "loadouts" },
    { key: "inspect" },
    { key: "value" },
    { key: "profile" },
  ]),
  community: points("community", [
    { key: "chat" },
    { key: "voice", on: settings.voiceChatEnabled },
    { key: "teams" },
    { key: "notifications" },
    { key: "bans" },
  ]),
}));

const nav = ["play", "compete", "watch", "utility", "community"];

function primary() {
  if (signedIn.value) {
    void navigateTo("/play");
  } else {
    signInWithSteam();
  }
}

const amberButton =
  "h-11 gap-2 px-[18px] text-[15px] font-semibold bg-[hsl(var(--tac-amber))] text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]";
const outlineButton =
  "h-11 border-foreground/20 px-[18px] text-[15px] font-semibold";
</script>

<template>
  <TooltipProvider
    :skip-delay-duration="300"
    :disable-hoverable-content="true"
  >
    <TopoBackground />
    <div class="relative z-10 min-h-screen overflow-x-clip">
      <SystemAlertBanner />

      <header
        class="sticky top-0 z-40 border-b border-border/70 bg-background/90"
      >
        <div
          class="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between gap-6 px-8 max-sm:px-4"
        >
          <NuxtLink
            to="/welcome"
            class="inline-flex min-w-0 items-center gap-3"
            :aria-label="name"
          >
            <img
              :src="logoUrl || '/favicon/192.png'"
              alt=""
              width="38"
              height="38"
              class="size-[38px] shrink-0 rounded-[9px] object-cover shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_6px_18px_rgb(0_0_0/0.5)]"
            />
            <span
              class="relative truncate text-xl font-extrabold uppercase leading-none tracking-[0.08em]"
            >
              <span
                aria-hidden="true"
                class="absolute inset-0 translate-x-[2px] translate-y-[2px] text-transparent [-webkit-text-stroke:1px_hsl(var(--tac-amber)/0.55)]"
                >{{ name }}</span
              >
              <span
                class="relative bg-[linear-gradient(180deg,#fff_0%,#c9c9cf_100%)] bg-clip-text text-transparent"
                >{{ name }}</span
              >
            </span>
          </NuxtLink>
          <nav
            class="flex gap-7 max-lg:hidden"
            :aria-label="$t('pages.welcome.nav.label')"
          >
            <a
              v-for="key in nav"
              :key="key"
              :href="`#${key}`"
              class="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              {{ $t(`pages.welcome.nav.${key}`) }}
            </a>
          </nav>
          <div class="flex shrink-0 items-center gap-2.5">
            <Button
              as="a"
              variant="outline"
              size="icon-sm"
              class="border-foreground/20"
              :href="`https://${webDomain}/discord-invite`"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="$t('layouts.app_nav.footer.join_discord')"
              :title="$t('layouts.app_nav.footer.join_discord')"
            >
              <DiscordLogoIcon />
            </Button>
            <Button
              as-child
              variant="outline"
              size="sm"
              class="h-8 border-foreground/20 font-semibold max-sm:hidden"
            >
              <NuxtLink to="/watch">{{ $t("pages.welcome.nav.watch_live") }}</NuxtLink>
            </Button>
            <Button
              size="sm"
              class="h-8 gap-2 bg-[hsl(var(--tac-amber))] font-semibold text-[hsl(var(--tac-amber-foreground))] hover:bg-[hsl(var(--tac-amber)/0.9)]"
              @click="primary"
            >
              <template v-if="signedIn">
                <Play class="size-3.5 fill-current" />
                {{ $t("pages.welcome.nav.open_play") }}
              </template>
              <template v-else>
                <SteamIcon class="size-3.5" />
                {{ $t("pages.play.matchmaking.sign_in") }}
              </template>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section
          class="mx-auto grid max-w-[1320px] items-center gap-14 px-8 pb-16 pt-[72px] max-lg:gap-10 max-sm:px-4 max-sm:pt-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
        >
          <PageTransition :step="0">
            <div class="min-w-0">
              <span
                class="inline-flex items-center gap-2 text-[13px] font-semibold text-[hsl(var(--tac-amber))]"
              >
                <span
                  class="inline-block h-[2px] w-[10px] bg-[hsl(var(--tac-amber))]"
                  aria-hidden="true"
                ></span>
                {{ $t("pages.welcome.hero.eyebrow", { name }) }}
              </span>
              <h1
                class="mt-[18px] text-[56px] font-bold leading-[1.02] tracking-[-0.015em] [text-wrap:balance] max-lg:text-5xl max-sm:text-[38px]"
              >
                {{ $t("pages.welcome.hero.title") }}
              </h1>
              <p
                class="mt-4 max-w-[520px] text-lg leading-relaxed text-foreground/70"
              >
                {{
                  settings.matchmakingEnabled
                    ? $t("pages.welcome.hero.lede")
                    : $t("pages.welcome.hero.lede_draft")
                }}
              </p>
              <div class="mt-8 flex flex-wrap gap-3">
                <Button :class="amberButton" @click="primary">
                  <template v-if="signedIn">
                    <Play class="size-4 fill-current" />
                    {{ $t("pages.welcome.nav.open_play") }}
                  </template>
                  <template v-else>
                    <SteamIcon class="size-4" />
                    {{ $t("pages.play.matchmaking.sign_in") }}
                  </template>
                </Button>
                <Button as-child variant="outline" :class="[outlineButton, 'gap-2']">
                  <NuxtLink to="/watch">
                    {{ $t("pages.welcome.nav.watch_live") }}
                    <ArrowRight class="size-4" />
                  </NuxtLink>
                </Button>
              </div>
              <p v-if="!signedIn" class="mt-[18px] text-[13.5px] text-muted-foreground">
                {{ $t("layouts.app_nav.sign_in.prompt") }}
              </p>
            </div>
          </PageTransition>
          <PageTransition :step="1">
            <LandingHero />
          </PageTransition>
        </section>

        <LandingNetworkStats />

        <PageTransition :step="2">
          <div class="mx-auto max-w-[1320px] px-8 pb-20 max-sm:px-4">
            <LandingNow />
          </div>
        </PageTransition>

        <LandingSection
          id="play"
          v-bind="copy('play')"
          :lede="
            settings.matchmakingEnabled
              ? $t('pages.welcome.play.lede')
              : $t('pages.welcome.play.lede_draft')
          "
          :points="sections.play"
          :link="{ to: '/play', label: $t('pages.welcome.play.link') }"
        >
          <LandingDefer :placeholder="460">
            <LandingPlay v-if="settings.matchmakingEnabled" />
            <LandingDraft v-else />
          </LandingDefer>
        </LandingSection>

        <LandingSection
          id="match"
          wide
          v-bind="copy('match')"
          :points="sections.match"
        >
          <LandingDefer :placeholder="560">
            <LandingVeto />
          </LandingDefer>
        </LandingSection>

        <LandingSection
          id="match-page"
          wide
          v-bind="copy('match_page')"
          :points="sections.match_page"
        >
          <LandingDefer :placeholder="780">
            <LandingMatchPage />
          </LandingDefer>
        </LandingSection>

        <LandingSection
          id="compete"
          v-bind="copy('compete')"
          :points="sections.compete"
          :link="{ to: '/tournaments', label: $t('pages.welcome.compete.link') }"
        >
          <LandingDefer :placeholder="400" inert>
            <LandingBracket :hide-finished-rounds="phone" />
          </LandingDefer>
        </LandingSection>

        <LandingSection
          id="watch"
          wide
          v-bind="copy('watch')"
          :points="sections.watch"
          :link="{ to: '/watch', label: $t('pages.welcome.watch.link') }"
        >
          <LandingDefer :placeholder="700" inert>
            <LandingStream />
          </LandingDefer>
          <p v-if="streamsGated" class="mt-3 text-[13px] text-muted-foreground">
            {{ $t("pages.welcome.watch.sign_in_note") }}
          </p>
        </LandingSection>

        <LandingSection
          id="rewatch"
          wide
          v-bind="copy('rewatch')"
          :points="sections.rewatch"
          :link="
            highlightsOn
              ? { to: '/highlights', label: $t('pages.welcome.rewatch.link') }
              : null
          "
        >
          <LandingDefer :placeholder="720">
            <LandingReplay />
          </LandingDefer>
        </LandingSection>

        <LandingSection
          id="utility"
          wide
          v-bind="copy('utility')"
          :points="sections.utility"
          :link="{ to: '/utility', label: $t('pages.welcome.utility.link') }"
        >
          <LandingDefer :placeholder="700">
            <LandingUtility />
          </LandingDefer>
        </LandingSection>

        <LandingSection
          v-if="inventoryOn"
          id="inventory"
          v-bind="copy('inventory')"
          :points="sections.inventory"
          :link="
            signedIn
              ? { to: '/apps/inventory', label: $t('pages.welcome.inventory.link') }
              : null
          "
        >
          <img
            src="/landing/inventory.webp"
            alt=""
            width="1120"
            height="778"
            loading="lazy"
            decoding="async"
            class="h-auto w-full rounded-lg border border-border"
          />
        </LandingSection>

        <LandingSection
          id="community"
          flip
          broad
          v-bind="copy('community')"
          :points="sections.community"
        >
          <LandingDefer :placeholder="640" inert>
            <LandingCommunity />
          </LandingDefer>
        </LandingSection>

        <section class="mx-auto max-w-[1320px] px-8 pb-24 pt-6 max-sm:px-4">
          <div
            class="relative overflow-hidden rounded-[14px] border border-border bg-card px-12 py-14 max-sm:px-6 max-sm:py-9"
          >
            <div
              aria-hidden="true"
              class="pointer-events-none absolute inset-0 bg-[repeating-radial-gradient(ellipse_at_92%_130%,transparent_0_13px,rgb(255_255_255/0.035)_13px_14px)] [mask-image:linear-gradient(90deg,transparent_20%,#000)]"
            ></div>
            <div
              class="relative flex flex-wrap items-center justify-between gap-8"
            >
              <div class="flex flex-wrap items-center gap-5">
                <img
                  :src="logoUrl || '/favicon/192.png'"
                  alt=""
                  width="64"
                  height="64"
                  class="size-16 rounded-[14px] object-cover shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_6px_18px_rgb(0_0_0/0.5)]"
                />
                <div>
                  <p class="m-0 text-[30px] font-bold leading-tight">
                    {{ $t("pages.welcome.cta.title") }}
                  </p>
                  <p class="m-0 mt-1.5 text-[15px] text-muted-foreground">
                    {{ $t("layouts.app_nav.sign_in.prompt") }}
                  </p>
                </div>
              </div>
              <div class="flex flex-wrap gap-2.5">
                <Button :class="amberButton" @click="primary">
                  <template v-if="signedIn">
                    <Play class="size-4 fill-current" />
                    {{ $t("pages.welcome.nav.open_play") }}
                  </template>
                  <template v-else>
                    <SteamIcon class="size-4" />
                    {{ $t("pages.play.matchmaking.sign_in") }}
                  </template>
                </Button>
                <Button as-child variant="outline" :class="outlineButton">
                  <NuxtLink to="/tournaments">{{
                    $t("pages.welcome.compete.link")
                  }}</NuxtLink>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  </TooltipProvider>
</template>
