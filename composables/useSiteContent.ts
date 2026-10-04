import { ref } from "vue";
import gql from "graphql-tag";
import getGraphqlClient from "~/graphql/getGraphqlClient";
import { schemaHasType } from "~/utilities/schemaHasType";

export type SiteContentSection =
  | "tournaments"
  | "events"
  | "news"
  | "highlights";

const SECTIONS: SiteContentSection[] = [
  "tournaments",
  "events",
  "news",
  "highlights",
];
const STORAGE_KEY = "site-content";

const SITE_CONTENT_QUERY = gql`
  query SiteContent {
    siteContent {
      tournaments
      events
      news
      highlights
    }
  }
`;

function readStored(): Partial<Record<SiteContentSection, boolean>> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

// Which view-only sections have anything to show. The last answer is kept in
// localStorage and painted first: content is rarely deleted, so it's almost
// always still right, and the one refresh per load resets a section that has
// since emptied.
const sections = ref<Partial<Record<SiteContentSection, boolean>>>(
  typeof window === "undefined" ? {} : readStored(),
);
let refreshing: Promise<void> | null = null;

async function refresh() {
  const client = getGraphqlClient();
  // The API ships the action separately; until it does, nothing hides.
  if (!(await schemaHasType(client, "SiteContentOutput"))) return;
  try {
    const { data } = await client.query({
      query: SITE_CONTENT_QUERY,
      fetchPolicy: "network-only",
    });
    const content = (data as any)?.siteContent;
    if (!content) return;
    const next: Partial<Record<SiteContentSection, boolean>> = {};
    for (const section of SECTIONS) next[section] = !!content[section];
    sections.value = next;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep the remembered answer.
  }
}

export function useSiteContent() {
  if (typeof window !== "undefined" && !refreshing) {
    refreshing = refresh();
  }
  // Unknown counts as having content, so nothing hides before it has answered.
  const hasContent = (section: SiteContentSection) =>
    sections.value[section] !== false;
  return { hasContent };
}
