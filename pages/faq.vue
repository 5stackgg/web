<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import TacticalPageHeader from "~/components/TacticalPageHeader.vue";
import PageTransition from "~/components/ui/transitions/PageTransition.vue";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import {
  tacticalSectionLabelClasses,
  tacticalSectionTickClasses,
  tacticalSectionSeparatorClasses,
} from "~/utilities/tacticalClasses";
import { DiscordLogoIcon } from "@radix-icons/vue";
import {
  Search,
  ExternalLink,
  ArrowUpRight,
  Github,
  BookOpen,
} from "lucide-vue-next";
import { useApplicationSettingsStore } from "~/stores/ApplicationSettings";

const { t } = useI18n();
const { brandName } = useBranding();

const DOCS_URL = "https://docs.5stack.gg";

// Answers stay short and point at the real documentation rather than trying to
// restate it -- anything operational (install, hardware, ports, plugins) will
// drift here and won't there. Paths are pages that exist in the docs repo; a
// broken one is a 404 on someone else's site, so check before adding.
const doc = (path: string, label: string) => ({
  label,
  href: `${DOCS_URL}${path}`,
});

const inviteLink = computed(
  () => `https://${useRuntimeConfig().public.webDomain}/discord-invite`,
);
const githubUrl = computed(() => useApplicationSettingsStore().githubUrl);

// Every question spells its key out in a literal translate call rather than
// assembling one from an id -- scripts/check-translations.js only sees literal
// calls, so a dynamically built key would report the whole FAQ as unused copy
// and invite a future prune. Verbose, but the keys stay verifiable.
type FaqLink = { label: string; href: string };
type FaqItem = { q: string; a: string; links?: FaqLink[] };
type FaqSection = { key: string; title: string; items: FaqItem[] };

const sections = computed<FaqSection[]>(() => [
  {
    key: "about",
    title: t("faq.about.title"),
    items: [
      {
        q: t("faq.about.what_is.question"),
        a: t("faq.about.what_is.answer"),
        links: [doc("/features/", t("faq.links.features"))],
      },
      {
        q: t("faq.about.this_site.question", { brand: brandName.value }),
        a: t("faq.about.this_site.answer", { brand: brandName.value }),
      },
      {
        q: t("faq.about.cost.question"),
        a: t("faq.about.cost.answer"),
        links: [doc("/getting-started", t("faq.links.overview"))],
      },
      {
        q: t("faq.about.sign_in.question"),
        a: t("faq.about.sign_in.answer"),
      },
      {
        q: t("faq.about.games.question"),
        a: t("faq.about.games.answer"),
      },
    ],
  },
  {
    key: "playing",
    title: t("faq.playing.title"),
    items: [
      {
        q: t("faq.playing.find_match.question"),
        a: t("faq.playing.find_match.answer"),
        links: [doc("/features/quick-play", t("faq.links.matchmaking"))],
      },
      {
        q: t("faq.playing.check_in.question"),
        a: t("faq.playing.check_in.answer"),
      },
      {
        q: t("faq.playing.tournaments.question"),
        a: t("faq.playing.tournaments.answer"),
        links: [doc("/features/tournaments", t("faq.links.tournaments"))],
      },
      {
        q: t("faq.playing.stats.question"),
        a: t("faq.playing.stats.answer"),
        links: [
          { label: t("faq.links.stats_guide"), href: "/stats-guide" },
          doc(
            "/features/performance-rating",
            t("faq.links.performance_rating"),
          ),
        ],
      },
      {
        q: t("faq.playing.replays.question"),
        a: t("faq.playing.replays.answer"),
        links: [doc("/features/match-replay", t("faq.links.match_replay"))],
      },
      {
        q: t("faq.playing.highlights.question"),
        a: t("faq.playing.highlights.answer"),
        links: [doc("/features/highlights", t("faq.links.highlights"))],
      },
      {
        q: t("faq.playing.notifications.question"),
        a: t("faq.playing.notifications.answer"),
        links: [doc("/advanced/web-push", t("faq.links.web_push"))],
      },
    ],
  },
  {
    key: "hosting",
    title: t("faq.hosting.title"),
    items: [
      {
        q: t("faq.hosting.self_host.question"),
        a: t("faq.hosting.self_host.answer"),
        links: [
          doc("/install/", t("faq.links.install")),
          doc("/faq", t("faq.links.hosting_faq")),
        ],
      },
      {
        q: t("faq.hosting.requirements.question"),
        a: t("faq.hosting.requirements.answer"),
        links: [
          doc("/install/requirements", t("faq.links.requirements")),
          doc("/install/what-is-installed", t("faq.links.what_is_installed")),
        ],
      },
      {
        q: t("faq.hosting.game_servers.question"),
        a: t("faq.hosting.game_servers.answer"),
        links: [
          doc("/servers/", t("faq.links.server_setup")),
          doc("/servers/game-server-nodes/", t("faq.links.game_server_nodes")),
        ],
      },
      {
        q: t("faq.hosting.gpu.question"),
        a: t("faq.hosting.gpu.answer"),
        links: [doc("/servers/gpu-nodes", t("faq.links.gpu_nodes"))],
      },
      {
        q: t("faq.hosting.managed.question"),
        a: t("faq.hosting.managed.answer"),
        links: [doc("/install/", t("faq.links.install"))],
      },
      {
        q: t("faq.hosting.branding.question"),
        a: t("faq.hosting.branding.answer"),
        links: [doc("/features/admin/branding", t("faq.links.branding"))],
      },
      {
        q: t("faq.hosting.extend.question"),
        a: t("faq.hosting.extend.answer"),
        links: [
          doc("/plugins/", t("faq.links.panel_plugins")),
          doc(
            "/servers/game-server-nodes/plugin-runtimes",
            t("faq.links.game_plugins"),
          ),
        ],
      },
    ],
  },
]);

// Ids are stamped before any filtering so a question keeps the same accordion
// value whether or not a search is narrowing the list -- indexing into the
// filtered array instead would reshuffle ids on every keystroke and collapse
// whatever was open.
const identifiedSections = computed(() =>
  sections.value.map((section) => ({
    ...section,
    items: section.items.map((item, index) => ({
      ...item,
      id: `${section.key}-${index}`,
    })),
  })),
);

const search = ref("");

const filteredSections = computed(() => {
  const term = search.value.trim().toLowerCase();

  if (!term) {
    return identifiedSections.value;
  }

  return identifiedSections.value
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.q.toLowerCase().includes(term) ||
          item.a.toLowerCase().includes(term),
      ),
    }))
    .filter((section) => section.items.length > 0);
});

const hasResults = computed(() => filteredSections.value.length > 0);

// A search narrows to a handful of answers, so opening the matches beats making
// the player click every result. Held as real state rather than derived from the
// term, so a controlled accordion can still be collapsed by hand mid-search.
const openItems = ref<string[]>([]);

watch(search, (term) => {
  openItems.value = term.trim()
    ? filteredSections.value.flatMap((section) =>
        section.items.map((item) => item.id),
      )
    : [];
});

const docLinkClasses =
  "inline-flex items-center gap-1.5 rounded border border-border/70 bg-background/40 px-2 py-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-[hsl(var(--tac-amber)/0.5)] hover:bg-[hsl(var(--tac-amber)/0.08)] hover:text-[hsl(var(--tac-amber))]";

const supportLinks = computed(() => [
  {
    key: "discord",
    icon: DiscordLogoIcon,
    label: t("faq.support.discord"),
    href: inviteLink.value,
  },
  {
    key: "github",
    icon: Github,
    label: t("faq.support.github"),
    href: githubUrl.value,
  },
  {
    key: "docs",
    icon: BookOpen,
    label: t("faq.support.docs"),
    href: DOCS_URL,
  },
]);
</script>

<template>
  <PageTransition>
    <div class="mx-auto flex w-full max-w-[74rem] flex-col gap-6 pb-12">
      <TacticalPageHeader>
        <template #title>{{ $t("faq.title") }}</template>
      </TacticalPageHeader>

      <Card class="bg-card/20">
        <CardContent class="flex flex-col gap-4 p-4 sm:p-6">
          <p class="max-w-3xl text-sm leading-relaxed text-foreground/90">
            {{ $t("faq.intro") }}
          </p>

          <div class="relative max-w-md">
            <Search
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              v-model="search"
              type="search"
              class="pl-9"
              :placeholder="$t('faq.search_placeholder')"
            />
          </div>
        </CardContent>
      </Card>

      <div v-if="hasResults" class="flex flex-col">
        <section
          v-for="(section, sectionIndex) in filteredSections"
          :key="section.key"
          :class="sectionIndex > 0 ? tacticalSectionSeparatorClasses : ''"
          class="py-6 first:pt-0"
        >
          <div :class="tacticalSectionLabelClasses">
            <span :class="tacticalSectionTickClasses"></span>
            {{ section.title }}
          </div>

          <!-- One Accordion root wrapping a grid, rather than one root per
               column: the open set is shared state, and two roots would each
               overwrite the other's half of it on every toggle. items-start
               keeps an expanded answer from stretching its neighbour's rule
               down to match. -->
          <Accordion v-model="openItems" type="multiple">
            <div
              class="grid items-start gap-x-10 sm:grid-cols-2 [&>*:first-child]:border-t-0 sm:[&>*:nth-child(2)]:border-t-0"
            >
              <AccordionItem
                v-for="item in section.items"
                :key="item.id"
                :value="item.id"
              >
                <AccordionTrigger>{{ item.q }}</AccordionTrigger>
                <AccordionContent>
                  <p>{{ item.a }}</p>
                  <div v-if="item.links" class="mt-3 flex flex-wrap gap-2">
                    <a
                      v-for="link in item.links"
                      :key="link.href"
                      :href="link.href"
                      :target="link.href.startsWith('/') ? undefined : '_blank'"
                      :rel="
                        link.href.startsWith('/')
                          ? undefined
                          : 'noopener noreferrer'
                      "
                      :class="docLinkClasses"
                    >
                      {{ link.label }}
                      <ArrowUpRight class="h-3 w-3" />
                    </a>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </div>
          </Accordion>
        </section>
      </div>

      <Card v-else class="bg-card/20">
        <CardContent class="p-6 text-sm text-muted-foreground">
          {{ $t("faq.no_results", { term: search }) }}
        </CardContent>
      </Card>

      <section :class="tacticalSectionSeparatorClasses" class="py-6">
        <div :class="tacticalSectionLabelClasses">
          <span :class="tacticalSectionTickClasses"></span>
          {{ $t("faq.support.title") }}
        </div>
        <p class="mb-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {{ $t("faq.support.description") }}
        </p>
        <div class="flex flex-wrap gap-3">
          <a
            v-for="link in supportLinks"
            :key="link.key"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 rounded border border-[hsl(var(--tac-amber)/0.5)] bg-[hsl(var(--tac-amber)/0.1)] px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-[hsl(var(--tac-amber))] hover:bg-[hsl(var(--tac-amber)/0.18)]"
          >
            <component :is="link.icon" class="h-3.5 w-3.5" />
            {{ link.label }}
            <ExternalLink class="h-3 w-3 opacity-60" />
          </a>
        </div>
      </section>
    </div>
  </PageTransition>
</template>
