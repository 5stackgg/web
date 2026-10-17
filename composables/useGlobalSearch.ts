import MiniSearch from "minisearch";
import entries from "#build/settings-search-index";
import { useAppSections, type AppSection } from "~/composables/useAppSections";
import {
  useAccountSettingsNav,
  useSettingsNav,
} from "~/composables/useSettingsNav";
import type { SettingsSearchHit } from "~/composables/useSettingsSearch";
import { e_player_roles_enum } from "~/generated/zeus";

export type GlobalSearchSetting = {
  id: string;
  path: string;
  label: string;
  description?: string;
  /** The settings page it is on; unset for a page itself. */
  page?: string;
  /** What to reveal once the page opens; unset for a page itself. */
  hit?: SettingsSearchHit;
};

export type GlobalSearchResults = {
  sections: AppSection[];
  account: GlobalSearchSetting[];
  application: GlobalSearchSetting[];
};

type Scope = "section" | "account" | "application";

type Document = {
  id: string;
  scope: Scope;
  label: string;
  description?: string;
  page?: string;
  group?: string;
  keywords?: string;
};

const LIMITS: Record<Scope, number> = {
  section: 6,
  account: 5,
  application: 6,
};

/**
 * One search over the pages, the player's own settings and, for
 * administrators, the application settings, each limited to what the signed-in
 * player can open. Settings are searchable by their page's name too, so
 * "voice noise" narrows to the voice page.
 */
export function useGlobalSearch() {
  const { t } = useI18n();
  const authStore = useAuthStore();
  const sections = useAppSections();
  const { items: accountPages } = useAccountSettingsNav();
  const { items: applicationPages } = useSettingsNav();

  const index = computed(() => {
    const pages = new Map<string, { scope: Scope; label: string }>();
    for (const item of accountPages.value) {
      pages.set(item.path, { scope: "account", label: item.label });
    }
    if (authStore.isRoleAbove(e_player_roles_enum.administrator)) {
      for (const item of applicationPages.value) {
        pages.set(item.path, { scope: "application", label: item.label });
      }
    }

    const documents: Document[] = [
      ...sections.value.map((section) => ({
        id: section.id,
        scope: "section" as const,
        label: section.label,
        group: section.group,
        keywords: section.keywords,
      })),
      ...[...pages].map(([path, page]) => ({
        id: path,
        scope: page.scope,
        label: page.label,
      })),
      ...entries
        .filter((entry) => pages.has(entry.path))
        .map((entry) => {
          const page = pages.get(entry.path)!;
          return {
            id: `${entry.path}:${entry.label}`,
            scope: page.scope,
            label: t(entry.label),
            description: entry.description && t(entry.description),
            page: page.label,
          };
        }),
    ];

    const search = new MiniSearch<Document>({
      fields: ["label", "description", "page", "group", "keywords"],
      storeFields: ["scope"],
      searchOptions: {
        boost: { label: 3, page: 2, group: 1.5 },
        prefix: true,
        fuzzy: (term) => (term.length > 4 ? 0.2 : false),
        combineWith: "AND",
      },
    });
    search.addAll(documents);

    return {
      search,
      documents: new Map(documents.map((document) => [document.id, document])),
      sections: new Map(sections.value.map((section) => [section.id, section])),
      pathOf: new Map(
        entries.map((entry) => [`${entry.path}:${entry.label}`, entry]),
      ),
    };
  });

  function search(query: string): GlobalSearchResults {
    const { search, documents, sections, pathOf } = index.value;
    let ids = search.search(query).map(({ id }) => id as string);

    // Scripts written without spaces (CJK) index as whole phrases, which a
    // word search can only match from the start.
    if (ids.length === 0) {
      const needle = query.trim().toLocaleLowerCase();
      ids = [...documents.values()]
        .filter((document) =>
          [
            document.label,
            document.description,
            document.page,
            document.group,
          ].some((text) => text?.toLocaleLowerCase().includes(needle)),
        )
        .map((document) => document.id);
    }

    const results: GlobalSearchResults = {
      sections: [],
      account: [],
      application: [],
    };
    for (const id of ids) {
      const document = documents.get(id)!;
      if (document.scope === "section") {
        if (results.sections.length < LIMITS.section) {
          results.sections.push(sections.get(id)!);
        }
        continue;
      }

      const list = results[document.scope];
      if (list.length >= LIMITS[document.scope]) {
        continue;
      }
      const entry = pathOf.get(id);
      list.push({
        id,
        path: entry?.path ?? id,
        label: document.label,
        description: document.description,
        page: document.page,
        hit: entry && {
          id,
          path: entry.path,
          section: entry.section,
          label: document.label,
          description: document.description,
        },
      });
    }
    return results;
  }

  return { search };
}
