/**
 * Unrated players sink to the bottom and ties fall back to name, so the order
 * is stable instead of arbitrary. `role` sorts on the numeric role_rank: the
 * role string only sorts alphabetically, and nearly everyone shares rank 0.
 */
export function playersSearchSortBy(
  field: string,
  direction: "asc" | "desc",
  eloField: string,
): string {
  if (field === "elo") {
    return `${eloField}(missing_values: last):${direction},name:asc`;
  }
  if (field === "role") {
    return `role_rank(missing_values: last):${direction},name:asc`;
  }
  return `${field}:${direction}`;
}
