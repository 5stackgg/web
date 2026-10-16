import MiniSearch from "minisearch";
import entries from "#build/settings-search-index";
import { useSettingsNav } from "~/composables/useSettingsNav";

export type SettingsSearchHit = {
  id: string;
  path: string;
  section?: string;
  label: string;
  description?: string;
};

export type SettingsSearchGroup = {
  path: string;
  label: string;
  hits: SettingsSearchHit[];
};

type SettingsSearchDocument = SettingsSearchHit & { page: string };

const MAX_HITS = 40;

// The setting a result was opened for, kept until its page has rendered it.
const target = ref<SettingsSearchHit>();

/**
 * Searches the application settings index (built from the settings pages by
 * modules/settings-search) in the active locale. A page's name is searchable
 * on every setting it holds, so "discord webhook" narrows to Discord's webhooks.
 */
export function useSettingsSearch() {
  const { t } = useI18n();
  const { items } = useSettingsNav();

  const index = computed(() => {
    const pages = new Map(items.value.map((item) => [item.path, item.label]));
    const documents: SettingsSearchDocument[] = [
      ...items.value.map((item) => ({
        id: item.path,
        path: item.path,
        label: item.label,
        page: item.label,
      })),
      ...entries
        .filter((entry) => pages.has(entry.path))
        .map((entry) => ({
          id: `${entry.path}:${entry.label}`,
          path: entry.path,
          section: entry.section,
          label: t(entry.label),
          description: entry.description && t(entry.description),
          page: pages.get(entry.path)!,
        })),
    ];

    const search = new MiniSearch<SettingsSearchDocument>({
      fields: ["label", "description", "page"],
      storeFields: ["path", "section", "label", "description"],
      searchOptions: {
        boost: { label: 3, page: 2 },
        prefix: true,
        fuzzy: (term) => (term.length > 4 ? 0.2 : false),
        combineWith: "AND",
      },
    });
    search.addAll(documents);

    return { search, documents, pages };
  });

  function search(query: string): SettingsSearchGroup[] {
    const { search, documents, pages } = index.value;
    let hits: SettingsSearchHit[] = search
      .search(query)
      .map(({ id, path, section, label, description }) => ({
        id,
        path,
        section,
        label,
        description,
      }));

    // Scripts written without spaces (CJK) index as whole phrases, which a
    // word search can only match from the start.
    if (hits.length === 0) {
      const needle = query.trim().toLocaleLowerCase();
      hits = documents.filter((document) =>
        [document.label, document.description, document.page].some((text) =>
          text?.toLocaleLowerCase().includes(needle),
        ),
      );
    }

    const groups = new Map<string, SettingsSearchGroup>();
    for (const hit of hits.slice(0, MAX_HITS)) {
      const group = groups.get(hit.path) ?? {
        path: hit.path,
        label: pages.get(hit.path)!,
        hits: [],
      };
      groups.set(hit.path, group);
      // The page itself is the group's heading, not a row under it.
      if (hit.id !== hit.path) {
        group.hits.push(hit);
      }
    }
    return [...groups.values()];
  }

  // A fresh object each time, so opening the same result twice reveals twice.
  function select(hit: SettingsSearchHit | undefined) {
    target.value = hit && { ...hit };
  }

  return { search, select };
}

// Pages render their settings once their data arrives, so the label is waited
// for rather than looked up once.
const REVEAL_TIMEOUT = 5000;

function findLabel(scope: HTMLElement, label: string) {
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (walker.currentNode.textContent?.trim() === label) {
      return walker.currentNode.parentElement;
    }
  }
}

function flash(element: Element, className: string) {
  element.classList.remove(className);
  void (element as HTMLElement).offsetWidth;
  element.classList.add(className);
  // animationend bubbles, and the row holds the label's own animation.
  const end = (event: Event) => {
    if (event.target === element) {
      element.classList.remove(className);
      element.removeEventListener("animationend", end);
    }
  };
  element.addEventListener("animationend", end);
}

function bringIntoView(element: Element, block: ScrollLogicalPosition) {
  element.scrollIntoView({
    block,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}

function reveal(pane: HTMLElement, hit: SettingsSearchHit) {
  const section = hit.section
    ? pane.querySelector<HTMLElement>(`#${CSS.escape(hit.section)}`)
    : null;
  const label =
    (section && findLabel(section, hit.label)) || findLabel(pane, hit.label);
  if (!label) {
    return false;
  }
  // Rendered but folded away or on a closed tab: land on its section.
  if (!label.getClientRects().length) {
    if (section) {
      bringIntoView(section, "start");
    }
    return true;
  }

  // The row is the nearest box holding the label and its description too.
  let row = label.parentElement ?? label;
  for (
    let element = label.parentElement;
    hit.description && element && element !== pane;
    element = element.parentElement
  ) {
    if (element.textContent?.includes(hit.description)) {
      row = element;
      break;
    }
  }

  bringIntoView(row, "center");
  flash(row, "settings-search-hit");
  flash(label, "settings-search-hit-label");
  return true;
}

/**
 * Brings the setting a search result was opened for into view once its page
 * has rendered it, and marks it. `container` holds the settings panes, each
 * tagged with `data-settings-pane` set to its route.
 */
export function useSettingsSearchReveal(container: Ref<HTMLElement | null>) {
  let stop: (() => void) | undefined;

  watch(
    target,
    (hit) => {
      stop?.();
      if (!hit || !container.value) {
        return;
      }

      const pane = () =>
        container.value?.querySelector<HTMLElement>(
          `[data-settings-pane="${hit.path}"]`,
        );
      const attempt = () => {
        const current = pane();
        if (current && reveal(current, hit)) {
          stop?.();
        }
      };

      const observer = new MutationObserver(attempt);
      // Never rendered, most likely behind a switch that is off: its section
      // is the nearest place to land.
      const timeout = setTimeout(() => {
        const section =
          hit.section && pane()?.querySelector(`#${CSS.escape(hit.section)}`);
        if (section) {
          bringIntoView(section, "start");
        }
        stop?.();
      }, REVEAL_TIMEOUT);
      stop = () => {
        observer.disconnect();
        clearTimeout(timeout);
        stop = undefined;
      };

      observer.observe(container.value, { childList: true, subtree: true });
      attempt();
    },
    { flush: "post" },
  );

  onBeforeUnmount(() => stop?.());
}
