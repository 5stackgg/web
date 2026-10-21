import MiniSearch from "minisearch";
import { e_player_roles_enum } from "~/generated/zeus";
import { useAuthStore } from "~/stores/AuthStore";

export const FAQ_DOCS_URL = "https://docs.5stack.gg";

export type FaqLink = { label: string; href: string };

export type FaqSub = { id: string; title: string };

export type FaqSection = {
  id: string;
  title: string;
  lede?: string;
  keywords?: string;
  answer?: string;
  links?: FaqLink[];
  subs?: FaqSub[];
};

export type FaqPart = {
  id: string;
  title: string;
  lede: string;
  audience?: "admin";
  sections: FaqSection[];
};

export type FaqHit = {
  id: string;
  title: string;
  part: string;
  lede?: string;
};

const doc = (path: string, label: string): FaqLink => ({
  label,
  href: `${FAQ_DOCS_URL}${path}`,
});

// Keys are spelled out as literal t() calls because check-translations only
// counts literal calls as used.
export function useFaqReader() {
  const authStore = useAuthStore();
  const isAdmin = computed(() =>
    authStore.isRoleAbove(e_player_roles_enum.administrator),
  );
  return { isAdmin };
}

export function useFaqOutline() {
  const { t } = useI18n();
  const { brandName } = useBranding();
  const { isAdmin } = useFaqReader();

  const parts = computed<FaqPart[]>(() => [
    {
      id: "start",
      title: t("faq.parts.start.title"),
      lede: t("faq.parts.start.lede"),
      sections: [
        {
          id: "something-wrong",
          title: t("faq.sections.something_wrong.title"),
          lede: t("faq.sections.something_wrong.lede"),
          keywords: t("faq.sections.something_wrong.keywords"),
        },
        {
          id: "words",
          title: t("faq.sections.words.title"),
          lede: t("faq.sections.words.lede"),
          keywords: t("faq.sections.words.keywords"),
        },
      ],
    },
    {
      id: "running",
      title: t("faq.parts.running.title"),
      lede: t("faq.parts.running.lede"),
      sections: [
        {
          id: "fix-a-problem",
          title: t("faq.sections.fix_a_problem.title"),
          lede: t("faq.sections.fix_a_problem.lede"),
          keywords: t("faq.sections.fix_a_problem.keywords"),
          subs: [
            {
              id: "fix-where",
              title: t("faq.sections.fix_a_problem.subs.where"),
            },
            {
              id: "fix-steps",
              title: t("faq.sections.fix_a_problem.subs.steps"),
            },
            { id: "fix-who", title: t("faq.sections.fix_a_problem.subs.who") },
          ],
        },
        {
          id: "restore",
          title: t("faq.sections.restore.title"),
          lede: t("faq.sections.restore.lede"),
          keywords: t("faq.sections.restore.keywords"),
          subs: [
            { id: "restore-how", title: t("faq.sections.restore.subs.how") },
            {
              id: "restore-which",
              title: t("faq.sections.restore.subs.which"),
            },
            { id: "restore-wait", title: t("faq.sections.restore.subs.wait") },
            { id: "restore-undo", title: t("faq.sections.restore.subs.undo") },
            {
              id: "restore-limits",
              title: t("faq.sections.restore.subs.limits"),
            },
          ],
        },
        {
          id: "restart-map",
          title: t("faq.sections.restart_map.title"),
          lede: t("faq.sections.restart_map.lede"),
          keywords: t("faq.sections.restart_map.keywords"),
        },
        {
          id: "veto-fix",
          title: t("faq.sections.veto_fix.title"),
          lede: t("faq.sections.veto_fix.lede"),
          keywords: t("faq.sections.veto_fix.keywords"),
          subs: [
            { id: "veto-how", title: t("faq.sections.veto_fix.subs.how") },
            { id: "veto-why", title: t("faq.sections.veto_fix.subs.why") },
            { id: "veto-more", title: t("faq.sections.veto_fix.subs.more") },
          ],
        },
        {
          id: "server",
          title: t("faq.sections.server.title"),
          lede: t("faq.sections.server.lede"),
          keywords: t("faq.sections.server.keywords"),
        },
        {
          id: "results",
          title: t("faq.sections.results.title"),
          lede: t("faq.sections.results.lede"),
          keywords: t("faq.sections.results.keywords"),
        },
        {
          id: "replay-match",
          title: t("faq.sections.replay_match.title"),
          lede: t("faq.sections.replay_match.lede"),
          keywords: t("faq.sections.replay_match.keywords"),
        },
        {
          id: "demo-match",
          title: t("faq.sections.demo_match.title"),
          lede: t("faq.sections.demo_match.lede"),
          keywords: t("faq.sections.demo_match.keywords"),
        },
      ],
    },
    {
      id: "tournaments",
      title: t("faq.parts.tournaments.title"),
      lede: t("faq.parts.tournaments.lede"),
      sections: [
        {
          id: "t-join",
          title: t("faq.sections.t_join.title"),
          lede: t("faq.sections.t_join.lede"),
          keywords: t("faq.sections.t_join.keywords"),
        },
        {
          id: "t-roster",
          title: t("faq.sections.t_roster.title"),
          lede: t("faq.sections.t_roster.lede"),
          keywords: t("faq.sections.t_roster.keywords"),
        },
        {
          id: "t-check-in",
          title: t("faq.sections.t_check_in.title"),
          lede: t("faq.sections.t_check_in.lede"),
          keywords: t("faq.sections.t_check_in.keywords"),
        },
        {
          id: "t-next-match",
          title: t("faq.sections.t_next_match.title"),
          lede: t("faq.sections.t_next_match.lede"),
          keywords: t("faq.sections.t_next_match.keywords"),
        },
        {
          id: "t-organizers",
          title: t("faq.sections.t_organizers.title"),
          lede: t("faq.sections.t_organizers.lede"),
          keywords: t("faq.sections.t_organizers.keywords"),
        },
        {
          id: "t-setup",
          title: t("faq.sections.t_setup.title"),
          lede: t("faq.sections.t_setup.lede"),
          keywords: t("faq.sections.t_setup.keywords"),
        },
        {
          id: "t-start",
          title: t("faq.sections.t_start.title"),
          lede: t("faq.sections.t_start.lede"),
          keywords: t("faq.sections.t_start.keywords"),
        },
        {
          id: "t-scheduling",
          title: t("faq.sections.t_scheduling.title"),
          lede: t("faq.sections.t_scheduling.lede"),
          keywords: t("faq.sections.t_scheduling.keywords"),
        },
        {
          id: "t-results",
          title: t("faq.sections.t_results.title"),
          lede: t("faq.sections.t_results.lede"),
          keywords: t("faq.sections.t_results.keywords"),
        },
      ],
    },
    {
      id: "playing",
      title: t("faq.playing.title"),
      lede: t("faq.parts.playing.lede"),
      sections: [
        {
          id: "find-match",
          title: t("faq.playing.find_match.question"),
          answer: t("faq.playing.find_match.answer"),
          links: [doc("/features/quick-play", t("faq.links.matchmaking"))],
        },
        {
          id: "check-in",
          title: t("faq.playing.check_in.question"),
          answer: t("faq.playing.check_in.answer"),
        },
        {
          id: "call-support",
          title: t("faq.sections.call_support.title"),
          answer: t("faq.sections.call_support.answer"),
          keywords: t("faq.sections.call_support.keywords"),
        },
        {
          id: "tournaments",
          title: t("faq.playing.tournaments.question"),
          answer: t("faq.playing.tournaments.answer"),
          links: [doc("/features/tournaments", t("faq.links.tournaments"))],
        },
        {
          id: "stats",
          title: t("faq.playing.stats.question"),
          answer: t("faq.playing.stats.answer"),
          links: [
            { label: t("faq.links.stats_guide"), href: "/stats-guide" },
            doc(
              "/features/performance-rating",
              t("faq.links.performance_rating"),
            ),
          ],
        },
        {
          id: "replays",
          title: t("faq.playing.replays.question"),
          answer: t("faq.playing.replays.answer"),
          links: [doc("/features/match-replay", t("faq.links.match_replay"))],
        },
        {
          id: "highlights",
          title: t("faq.playing.highlights.question"),
          answer: t("faq.playing.highlights.answer"),
          links: [doc("/features/highlights", t("faq.links.highlights"))],
        },
        {
          id: "notifications",
          title: t("faq.playing.notifications.question"),
          answer: t("faq.playing.notifications.answer"),
          links: [doc("/advanced/web-push", t("faq.links.web_push"))],
        },
      ],
    },
    {
      id: "about",
      title: t("faq.about.title"),
      lede: t("faq.parts.about.lede"),
      sections: [
        {
          id: "what-is",
          title: t("faq.about.what_is.question"),
          answer: t("faq.about.what_is.answer"),
          links: [doc("/features/", t("faq.links.features"))],
        },
        {
          id: "this-site",
          title: t("faq.about.this_site.question", { brand: brandName.value }),
          answer: t("faq.about.this_site.answer", { brand: brandName.value }),
        },
        {
          id: "sign-in",
          title: t("faq.about.sign_in.question"),
          answer: t("faq.about.sign_in.answer"),
        },
        {
          id: "games",
          title: t("faq.about.games.question"),
          answer: t("faq.about.games.answer"),
        },
      ],
    },
    {
      id: "hosting",
      title: t("faq.parts.hosting.title"),
      lede: t("faq.parts.hosting.lede"),
      audience: "admin",
      sections: [
        {
          id: "cost",
          title: t("faq.about.cost.question"),
          answer: t("faq.about.cost.answer"),
          links: [doc("/getting-started", t("faq.links.overview"))],
        },
        {
          id: "self-host",
          title: t("faq.hosting.self_host.question"),
          answer: t("faq.hosting.self_host.answer"),
          links: [
            doc("/install/", t("faq.links.install")),
            doc("/faq", t("faq.links.hosting_faq")),
          ],
        },
        {
          id: "requirements",
          title: t("faq.hosting.requirements.question"),
          answer: t("faq.hosting.requirements.answer"),
          links: [
            doc("/install/requirements", t("faq.links.requirements")),
            doc("/install/what-is-installed", t("faq.links.what_is_installed")),
          ],
        },
        {
          id: "game-servers",
          title: t("faq.hosting.game_servers.question"),
          answer: t("faq.hosting.game_servers.answer"),
          links: [
            doc("/servers/", t("faq.links.server_setup")),
            doc(
              "/servers/game-server-nodes/",
              t("faq.links.game_server_nodes"),
            ),
          ],
        },
        {
          id: "gpu",
          title: t("faq.hosting.gpu.question"),
          answer: t("faq.hosting.gpu.answer"),
          links: [doc("/servers/gpu-nodes", t("faq.links.gpu_nodes"))],
        },
        {
          id: "managed",
          title: t("faq.hosting.managed.question"),
          answer: t("faq.hosting.managed.answer"),
          links: [doc("/install/", t("faq.links.install"))],
        },
        {
          id: "branding",
          title: t("faq.hosting.branding.question"),
          answer: t("faq.hosting.branding.answer"),
          links: [doc("/features/admin/branding", t("faq.links.branding"))],
        },
        {
          id: "extend",
          title: t("faq.hosting.extend.question"),
          answer: t("faq.hosting.extend.answer"),
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

  return computed(() =>
    parts.value
      .filter((part) => part.audience !== "admin" || isAdmin.value)
      .map((part) =>
        isAdmin.value
          ? part
          : {
              ...part,
              sections: part.sections.map((section) => ({
                ...section,
                links: section.links?.filter(
                  (link) => !link.href.startsWith(FAQ_DOCS_URL),
                ),
              })),
            },
      ),
  );
}

export function faqSectionOf(parts: FaqPart[], anchor: string) {
  for (const part of parts) {
    for (const section of part.sections) {
      if (
        section.id === anchor ||
        section.subs?.some((sub) => sub.id === anchor)
      ) {
        return { part, section };
      }
    }
  }
  return null;
}

type FaqDocument = {
  id: string;
  title: string;
  part: string;
  lede: string;
  keywords: string;
  body: string;
};

export function useFaqSearch() {
  const outline = useFaqOutline();

  const index = computed(() => {
    const documents: FaqDocument[] = outline.value.flatMap((part) =>
      part.sections.map((section) => ({
        id: section.id,
        title: section.title,
        part: part.title,
        lede: section.lede ?? "",
        keywords: [
          section.keywords,
          ...(section.subs ?? []).map((sub) => sub.title),
        ]
          .filter(Boolean)
          .join(" "),
        body: section.answer ?? "",
      })),
    );
    const search = new MiniSearch<FaqDocument>({
      fields: ["title", "lede", "keywords", "body", "part"],
      storeFields: ["title", "part", "lede"],
      searchOptions: {
        boost: { title: 3, keywords: 2.5, lede: 1.5 },
        prefix: true,
        fuzzy: (term) => (term.length > 4 ? 0.2 : false),
        combineWith: "OR",
      },
    });
    search.addAll(documents);
    return { search, documents };
  });

  function search(
    query: string,
    limit = 6,
    options: { strict?: boolean } = {},
  ): FaqHit[] {
    const needle = query.trim();
    if (!needle || (options.strict && needle.length < 3)) {
      return [];
    }
    const { search, documents } = index.value;
    const strict = search.search(needle, { combineWith: "AND" });
    const loose = options.strict ? [] : search.search(needle);
    const floor = (loose[0]?.score ?? 0) * 0.25;
    const seen = new Set<string>();
    const hits = [
      ...strict,
      ...loose.filter((hit) => hit.score >= floor),
    ].filter((hit) => !seen.has(hit.id) && seen.add(hit.id));
    if (hits.length === 0 && !options.strict) {
      const lower = needle.toLocaleLowerCase();
      return documents
        .filter((document) =>
          [
            document.title,
            document.lede,
            document.keywords,
            document.body,
          ].some((text) => text.toLocaleLowerCase().includes(lower)),
        )
        .slice(0, limit)
        .map(({ id, title, part, lede }) => ({ id, title, part, lede }));
    }
    return hits.slice(0, limit).map((hit) => ({
      id: hit.id as string,
      title: hit.title as string,
      part: hit.part as string,
      lede: (hit.lede as string) || undefined,
    }));
  }

  return { search };
}

export function useFaqDialog() {
  const anchor = useState<string | null>("faq-dialog-anchor", () => null);
  const jump = useState<{ anchor: string; at: number } | null>(
    "faq-jump",
    () => null,
  );

  function jumpTo(id: string) {
    jump.value = { anchor: id, at: Date.now() };
  }

  function open(id: string) {
    anchor.value = id;
  }

  function close() {
    anchor.value = null;
  }

  return { anchor, jump, open, close, jumpTo };
}
