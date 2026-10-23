export interface NavSectionDraft<T> {
  id: string;
  label: string;
  items: T[];
}

export interface PlaceableApp {
  nav_group: string | null;
  nav_order: number;
}

// An app's nav group names the section it joins: a built-in one by its id or
// its label ("play", "Compete"), any other name a section of its own after the
// built-ins, and no name the Apps section at the end.
export function sectionForGroup(
  group: string | null,
  sections: Array<{ id: string; label: string }>,
): string | null {
  const name = group?.trim().toLowerCase();
  if (!name) {
    return null;
  }
  return (
    sections.find(
      (section) => section.id === name || section.label.toLowerCase() === name,
    )?.id ?? null
  );
}

// Inside a built-in section the nav order is a slot among its own pages: 1
// lands after the first page, 2 after the second, and 0 (or anything past the
// end) at the end. Apps sharing a slot keep the order they arrived in.
export function placeApps<T, A extends PlaceableApp>(
  sections: NavSectionDraft<T>[],
  apps: A[],
  toItem: (app: A) => T,
  appsLabel: string,
): NavSectionDraft<T>[] {
  const placed = sections.map((section) => ({
    ...section,
    items: [...section.items],
  }));
  const own: NavSectionDraft<T>[] = [];
  const joining = new Map<string, A[]>();

  for (const app of apps) {
    const target = sectionForGroup(app.nav_group, sections);
    if (target) {
      joining.set(target, [...(joining.get(target) ?? []), app]);
      continue;
    }
    const name = app.nav_group?.trim() ?? "";
    const id = name ? `group:${name.toLowerCase()}` : "apps";
    let section = own.find((entry) => entry.id === id);
    if (!section) {
      section = { id, label: name || appsLabel, items: [] };
      own.push(section);
    }
    section.items.push(toItem(app));
  }

  for (const [id, sectionApps] of joining) {
    const section = placed.find((entry) => entry.id === id)!;
    const pages = section.items.length;
    sectionApps
      .map((app, index) => ({
        app,
        index,
        slot: app.nav_order > 0 ? Math.min(app.nav_order, pages) : pages,
      }))
      .sort((a, b) => a.slot - b.slot || a.index - b.index)
      .forEach(({ app, slot }, inserted) => {
        section.items.splice(slot + inserted, 0, toItem(app));
      });
  }

  // The Apps catch-all always comes last, after any named groups.
  own.sort((a, b) => Number(a.id === "apps") - Number(b.id === "apps"));

  return [...placed, ...own];
}
