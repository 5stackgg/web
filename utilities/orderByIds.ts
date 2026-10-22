// Rows fetched by id come back in no particular order; this puts them in the
// order the ids were found in. An id with no row (gone between the two reads)
// is dropped rather than left as a hole.
export function orderByIds<T extends { id: string }>(
  rows: T[],
  ids: string[],
): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}
